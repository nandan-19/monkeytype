import {
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomResponse,
} from "@monkeytype/contracts/compete";
import { MonkeyRequest } from "../types";
import { MonkeyResponse } from "../../utils/monkey-response";
import * as RaceRoomService from "../../services/race-room";
import MonkeyError from "../../utils/error";
import { RoomIdPathSchema } from "@monkeytype/contracts/compete";
import { z } from "zod";

type RoomIdParams = z.infer<typeof RoomIdPathSchema>;

export async function createRoom(
  req: MonkeyRequest<undefined, CreateRoomRequest>,
): Promise<CreateRoomResponse> {
  const { config, words } = req.body;

  // No auth required — anyone can create a room (anonymous)
  const room = await RaceRoomService.createRoom(config, words, "");

  return new MonkeyResponse("Room created", { roomId: room.id });
}

export async function getRoom(
  req: MonkeyRequest<undefined, undefined, RoomIdParams>,
): Promise<GetRoomResponse> {
  const { roomId } = req.params;
  const room = await RaceRoomService.getRoom(roomId);
  if (!room) {
    throw new MonkeyError(404, "Room not found or expired");
  }
  return new MonkeyResponse("Room retrieved", room);
}
