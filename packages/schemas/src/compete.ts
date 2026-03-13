import { z } from "zod";

export const RaceModeSchema = z.enum(["time", "words"]);
export type RaceMode = z.infer<typeof RaceModeSchema>;

export const RaceConfigSchema = z.object({
  mode: RaceModeSchema,
  mode2: z.number().int().positive(),
  language: z.string().min(1),
});
export type RaceConfig = z.infer<typeof RaceConfigSchema>;

export const ParticipantStatusSchema = z.enum([
  "waiting",
  "racing",
  "finished",
]);
export type ParticipantStatus = z.infer<typeof ParticipantStatusSchema>;

export const RaceResultSchema = z.object({
  wpm: z.number(),
  rawWpm: z.number(),
  acc: z.number(),
  timestamp: z.number(),
});
export type RaceResult = z.infer<typeof RaceResultSchema>;

export const ParticipantSchema = z.object({
  socketId: z.string(),
  name: z.string().min(1).max(20),
  progress: z.number().min(0).max(100),
  wpm: z.number().min(0),
  status: ParticipantStatusSchema,
  result: RaceResultSchema.optional(),
  isCreator: z.boolean(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const RaceStatusSchema = z.enum([
  "waiting",
  "countdown",
  "racing",
  "finished",
]);
export type RaceStatus = z.infer<typeof RaceStatusSchema>;

export const RaceRoomSchema = z.object({
  id: z.string().length(6),
  creatorSocketId: z.string(),
  config: RaceConfigSchema,
  words: z.array(z.string()),
  status: RaceStatusSchema,
  participants: z.array(ParticipantSchema),
  startedAt: z.number().optional(),
  createdAt: z.number(),
});
export type RaceRoom = z.infer<typeof RaceRoomSchema>;
