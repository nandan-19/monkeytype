import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  CommonResponses,
  meta,
  MonkeyResponseSchema,
  responseWithData,
} from "./util/api";
import { RaceConfigSchema, RaceRoomSchema } from "@monkeytype/schemas/compete";

const c = initContract();

export const CreateRoomRequestSchema = z.object({
  config: RaceConfigSchema,
  words: z.array(z.string()).min(1).max(500),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const CreateRoomResponseSchema = responseWithData(
  z.object({ roomId: z.string().length(6) }),
);
export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

export const GetRoomResponseSchema = responseWithData(RaceRoomSchema);
export type GetRoomResponse = z.infer<typeof GetRoomResponseSchema>;

export const RoomIdPathSchema = z.object({ roomId: z.string().length(6) });

export const competeContract = c.router(
  {
    createRoom: {
      summary: "create race room",
      description: "Create a new race room, storing config and words in Redis",
      method: "POST",
      path: "/",
      body: CreateRoomRequestSchema.strict(),
      responses: {
        200: CreateRoomResponseSchema,
      },
      metadata: meta({
        authenticationOptions: { isPublic: true },
        rateLimit: "competeCreate",
      }),
    },
    getRoom: {
      summary: "get race room",
      description: "Get the current state of a race room",
      method: "GET",
      path: "/:roomId",
      pathParams: RoomIdPathSchema.strict(),
      responses: {
        200: GetRoomResponseSchema,
        404: MonkeyResponseSchema.describe("Room not found"),
      },
      metadata: meta({
        authenticationOptions: { isPublic: true },
        rateLimit: "competeGet",
      }),
    },
  },
  { pathPrefix: "/compete" },
);
