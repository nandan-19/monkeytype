import * as RedisClient from "../init/redis";
import { RaceRoom, Participant } from "@monkeytype/schemas/compete";

const ROOM_TTL_SECONDS = 7200; // 2 hours
const ROOM_KEY_PREFIX = "monkeytype:race:";

// PublicRaceRoom strips word list to save bandwidth on roomUpdate events
export type PublicRaceRoom = Omit<RaceRoom, "words"> & {
  wordCount: number;
};

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function generateRoomId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function createRoom(
  config: RaceRoom["config"],
  words: string[],
  creatorSocketId: string,
): Promise<RaceRoom> {
  const connection = RedisClient.getConnection();

  let roomId = generateRoomId();
  // Ensure uniqueness
  if (connection) {
    let attempts = 0;
    while (attempts < 5) {
      const existing = await connection.get(roomKey(roomId));
      if (!existing) break;
      roomId = generateRoomId();
      attempts++;
    }
  }

  const room: RaceRoom = {
    id: roomId,
    creatorSocketId,
    config,
    words,
    status: "waiting",
    participants: [],
    createdAt: Date.now(),
  };

  await saveRoom(room);
  return room;
}

export async function getRoom(roomId: string): Promise<RaceRoom | null> {
  const connection = RedisClient.getConnection();
  if (!connection) return null;

  const data = await connection.get(roomKey(roomId));
  if (!data) return null;

  try {
    return JSON.parse(data) as RaceRoom;
  } catch {
    return null;
  }
}

export async function saveRoom(room: RaceRoom): Promise<void> {
  const connection = RedisClient.getConnection();
  if (!connection) return;

  await connection.setex(
    roomKey(room.id),
    ROOM_TTL_SECONDS,
    JSON.stringify(room),
  );
}

export async function deleteRoom(roomId: string): Promise<void> {
  const connection = RedisClient.getConnection();
  if (!connection) return;

  await connection.del(roomKey(roomId));
}

export function toPublic(room: RaceRoom): PublicRaceRoom {
  const { words, ...rest } = room;
  return { ...rest, wordCount: words.length };
}
