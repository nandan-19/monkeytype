import { io, Socket } from "socket.io-client";
import { createStore } from "solid-js/store";
import { envConfig } from "virtual:env-config";
import type {
  RaceConfig,
  RaceResult,
  RaceStatus,
  Participant,
} from "@monkeytype/schemas/compete";

// ─── Public room type (words stripped by server) ────────────────────────────
export type PublicRaceRoom = {
  id: string;
  creatorSocketId: string;
  config: RaceConfig;
  status: RaceStatus;
  participants: Participant[];
  startedAt?: number;
  createdAt: number;
  wordCount: number;
};

// ─── State ────────────────────────────────────────────────────────────────────

export type CompeteState =
  | "idle"
  | "lobby"
  | "countdown"
  | "racing"
  | "finished";

type RaceState = {
  room: PublicRaceRoom | null;
  state: CompeteState;
  words: string[];
  raceConfig: RaceConfig | null;
  raceStartAt: number | null;
  countdownSeconds: number;
  error: string | null;
  mySocketId: string | null;
};

const initState: RaceState = {
  room: null,
  state: "idle",
  words: [],
  raceConfig: null,
  raceStartAt: null,
  countdownSeconds: 0,
  error: null,
  mySocketId: null,
};

const [raceStore, setRaceStore] = createStore<RaceState>({ ...initState });

export { raceStore };

// ─── Race complete callback ──────────────────────────────────────────────────

let onRaceCompleteCallbacks: ((result: RaceResult) => void)[] = [];

export function onRaceComplete(cb: (result: RaceResult) => void): () => void {
  onRaceCompleteCallbacks.push(cb);
  return () => {
    onRaceCompleteCallbacks = onRaceCompleteCallbacks.filter((c) => c !== cb);
  };
}

// ─── Socket instance ─────────────────────────────────────────────────────────

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connect(): void {
  if (socket?.connected) return;

  socket = io(envConfig.backendUrl, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    setRaceStore("mySocketId", socket?.id ?? null);
  });

  socket.on("roomUpdate", (room: PublicRaceRoom) => {
    setRaceStore("room", room);
    if (
      room.status === "racing" &&
      raceStore.state !== "racing" &&
      raceStore.state !== "finished"
    ) {
      setRaceStore("state", "racing");
    }
  });

  socket.on(
    "raceStarted",
    (data: { words: string[]; config: RaceConfig; startAt: number }) => {
      setRaceStore("words", data.words);
      setRaceStore("raceConfig", data.config);
      setRaceStore("raceStartAt", data.startAt);
      setRaceStore("state", "racing");
    },
  );

  socket.on("countdown", (secondsLeft: number) => {
    setRaceStore("countdownSeconds", secondsLeft);
    setRaceStore("state", "countdown");
  });

  socket.on("raceFinished", (_participants: Participant[]) => {
    setRaceStore("state", "finished");
  });

  socket.on("error", (message: string) => {
    setRaceStore("error", message);
  });

  socket.on("disconnect", () => {
    setRaceStore("mySocketId", null);
  });
}

export function disconnect(): void {
  socket?.disconnect();
  socket = null;
  setRaceStore({ ...initState });
}

// ─── Socket actions ──────────────────────────────────────────────────────────

export function joinRoom(roomId: string, name: string): void {
  socket?.emit("joinRoom", roomId, name);
  setRaceStore("state", "lobby");
  setRaceStore("error", null);
}

export function updateConfig(config: RaceConfig): void {
  socket?.emit("updateConfig", config);
}

export function startRace(): void {
  socket?.emit("startRace");
}

export function sendProgress(wordIndex: number, wpm: number): void {
  socket?.emit("progressUpdate", { wordIndex, wpm });
}

export function sendComplete(result: RaceResult): void {
  socket?.emit("testComplete", result);
  // Notify local race-mode callbacks
  for (const cb of onRaceCompleteCallbacks) {
    cb(result);
  }
}

// ─── Accessors ────────────────────────────────────────────────────────────────

export function isMySocketCreator(): boolean {
  if (!raceStore.room || !raceStore.mySocketId) return false;
  return raceStore.room.creatorSocketId === raceStore.mySocketId;
}
