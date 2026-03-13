import { Socket, Server as SocketIoServer } from "socket.io";
import { RaceConfig, RaceResult, Participant } from "@monkeytype/schemas/compete";
import * as RaceRoomService from "../../services/race-room";
import Logger from "../../utils/logger";

// ─── Typed event maps ───────────────────────────────────────────────────────

export interface ClientToServerEvents {
  joinRoom: (roomId: string, name: string) => void;
  updateConfig: (config: RaceConfig) => void;
  startRace: () => void;
  progressUpdate: (data: { wordIndex: number; wpm: number }) => void;
  testComplete: (result: RaceResult) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (room: RaceRoomService.PublicRaceRoom) => void;
  raceStarted: (data: { words: string[]; config: RaceConfig; startAt: number }) => void;
  countdown: (secondsLeft: number) => void;
  raceFinished: (participants: Participant[]) => void;
  error: (message: string) => void;
}

// ─── Handler registration ────────────────────────────────────────────────────

export function registerRaceHandlers(
  io: SocketIoServer,
  socket: Socket,
): void {
  socket.on("joinRoom", async (roomId: string, name: string) => {
    try {
      const trimmedName = String(name).trim().slice(0, 20);
      if (!trimmedName) {
        socket.emit("error", "Name is required");
        return;
      }

      const room = await RaceRoomService.getRoom(roomId);
      if (!room) {
        socket.emit("error", "Room not found or expired");
        return;
      }

      if (room.status !== "waiting") {
        socket.emit("error", "Race already started");
        return;
      }

      if (room.participants.length >= 8) {
        socket.emit("error", "Room is full (max 8 participants)");
        return;
      }

      // Remove any stale entry for this socket (reconnect case)
      const existing = room.participants.findIndex(
        (p) => p.socketId === socket.id,
      );
      if (existing !== -1) {
        room.participants.splice(existing, 1);
      }

      const isFirst = room.participants.length === 0;
      if (isFirst) {
        // The room is created before any socket joins, so assign creator on first join.
        room.creatorSocketId = socket.id;
      }
      const participant: Participant = {
        socketId: socket.id,
        name: trimmedName,
        progress: 0,
        wpm: 0,
        status: "waiting",
        isCreator: socket.id === room.creatorSocketId,
      };

      room.participants.push(participant);
      await RaceRoomService.saveRoom(room);

      await socket.join(roomId);
      io.to(roomId).emit("roomUpdate", RaceRoomService.toPublic(room));
    } catch (e) {
      Logger.error(`joinRoom error: ${String(e)}`);
      socket.emit("error", "Internal error");
    }
  });

  socket.on("updateConfig", async (config: RaceConfig) => {
    try {
      const roomId = getRoomIdForSocket(socket);
      if (!roomId) return;

      const room = await RaceRoomService.getRoom(roomId);
      if (!room) return;
      if (room.creatorSocketId !== socket.id) {
        socket.emit("error", "Only the creator can update config");
        return;
      }
      if (room.status !== "waiting") {
        socket.emit("error", "Cannot change config after race started");
        return;
      }

      room.config = config;
      await RaceRoomService.saveRoom(room);
      io.to(roomId).emit("roomUpdate", RaceRoomService.toPublic(room));
    } catch (e) {
      Logger.error(`updateConfig error: ${String(e)}`);
    }
  });

  socket.on("startRace", async () => {
    try {
      const roomId = getRoomIdForSocket(socket);
      if (!roomId) return;

      const room = await RaceRoomService.getRoom(roomId);
      if (!room) return;
      if (room.creatorSocketId !== socket.id) {
        socket.emit("error", "Only the creator can start the race");
        return;
      }
      if (room.status !== "waiting") {
        socket.emit("error", "Race already started");
        return;
      }
      if (room.participants.length < 2) {
        socket.emit("error", "Need at least 2 participants to start");
        return;
      }

      room.status = "countdown";
      await RaceRoomService.saveRoom(room);

      // 3-second countdown
      for (let i = 3; i > 0; i--) {
        io.to(roomId).emit("countdown", i);
        await sleep(1000);
      }

      // Re-fetch in case of stale state during countdown
      const freshRoom = await RaceRoomService.getRoom(roomId);
      if (!freshRoom || freshRoom.status !== "countdown") return;

      freshRoom.status = "racing";
      freshRoom.startedAt = Date.now();
      for (const p of freshRoom.participants) {
        p.status = "racing";
      }
      await RaceRoomService.saveRoom(freshRoom);

      const startAt = Date.now() + 500; // small buffer for clients to prepare
      io.to(roomId).emit("raceStarted", {
        words: freshRoom.words,
        config: freshRoom.config,
        startAt,
      });
    } catch (e) {
      Logger.error(`startRace error: ${String(e)}`);
    }
  });

  socket.on(
    "progressUpdate",
    async (data: { wordIndex: number; wpm: number }) => {
      try {
        const roomId = getRoomIdForSocket(socket);
        if (!roomId) return;

        const room = await RaceRoomService.getRoom(roomId);
        if (!room || room.status !== "racing") return;

        const participant = room.participants.find(
          (p) => p.socketId === socket.id,
        );
        if (!participant || participant.status !== "racing") return;

        const wordCount = room.words.length;
        participant.progress = Math.round(
          Math.min((data.wordIndex / wordCount) * 100, 99),
        );
        participant.wpm = Math.max(0, Math.round(data.wpm));

        await RaceRoomService.saveRoom(room);

        // Broadcast only to other participants (save bandwidth)
        socket.to(roomId).emit("roomUpdate", RaceRoomService.toPublic(room));
      } catch (e) {
        // Silently ignore progress update errors to avoid spamming logs
      }
    },
  );

  socket.on("testComplete", async (result: RaceResult) => {
    try {
      const roomId = getRoomIdForSocket(socket);
      if (!roomId) return;

      const room = await RaceRoomService.getRoom(roomId);
      if (!room || room.status !== "racing") return;

      const participant = room.participants.find(
        (p) => p.socketId === socket.id,
      );
      if (!participant || participant.status !== "racing") return;

      participant.status = "finished";
      participant.progress = 100;
      participant.wpm = Math.max(0, Math.round(result.wpm));
      participant.result = {
        wpm: result.wpm,
        rawWpm: result.rawWpm,
        acc: result.acc,
        timestamp: result.timestamp,
      };

      const allDone = room.participants.every((p) => p.status === "finished");
      if (allDone) {
        room.status = "finished";
      }

      await RaceRoomService.saveRoom(room);
      io.to(roomId).emit("roomUpdate", RaceRoomService.toPublic(room));

      if (allDone) {
        io.to(roomId).emit("raceFinished", room.participants);
      }
    } catch (e) {
      Logger.error(`testComplete error: ${String(e)}`);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      for (const roomId of rooms) {
        const room = await RaceRoomService.getRoom(roomId);
        if (!room) continue;

        const wasCreator = room.creatorSocketId === socket.id;
        room.participants = room.participants.filter(
          (p) => p.socketId !== socket.id,
        );

        if (room.participants.length === 0) {
          await RaceRoomService.deleteRoom(roomId);
          continue;
        }

        if (wasCreator) {
          // Promote next participant to creator
          const newCreator = room.participants[0];
          if (newCreator) {
            room.creatorSocketId = newCreator.socketId;
            newCreator.isCreator = true;
          }
        }

        await RaceRoomService.saveRoom(room);
        io.to(roomId).emit("roomUpdate", RaceRoomService.toPublic(room));
      }
    } catch (e) {
      Logger.error(`disconnect cleanup error: ${String(e)}`);
    }
  });
}

function getRoomIdForSocket(socket: Socket): string | null {
  const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
  return rooms[0] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
