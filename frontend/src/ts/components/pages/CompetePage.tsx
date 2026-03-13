/**
 * CompetePage.tsx
 * Main SolidJS component for the live typing race feature.
 *
 * State machine:
 *   idle → lobby → countdown → racing → finished
 */

import {
  JSXElement,
  Show,
  For,
  createEffect,
  onMount,
  onCleanup,
  createSignal,
} from "solid-js";
import { getActivePage } from "../../signals/core";
import { envConfig } from "virtual:env-config";
import {
  raceStore,
  connect,
  disconnect,
  joinRoom,
  updateConfig,
  startRace,
  isMySocketCreator,
} from "../../services/race-socket";
import * as RaceMode from "../../test/race-mode";
import * as TestLogic from "../../test/test-logic";
import type { RaceConfig } from "@monkeytype/schemas/compete";
import { cn } from "../../utils/cn";
import { Fa } from "../common/Fa";
import { Button } from "../common/Button";
import {
  showNoticeNotification,
  showErrorNotification,
} from "../../stores/notifications";

const API_URL = envConfig.backendUrl;

// ─── Room ID from URL ─────────────────────────────────────────────────────────

function getRoomIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/compete\/([A-Za-z0-9]{6})$/);
  return match?.[1] ?? null;
}

// ─── Name entry modal ─────────────────────────────────────────────────────────

function NameModal(props: {
  onSubmit: (name: string) => void;
}): JSXElement {
  const [name, setName] = createSignal("");
  const submit = (): void => {
    const n = name().trim();
    if (!n) return;
    props.onSubmit(n);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div class="flex w-80 flex-col gap-4 rounded-xl bg-(--bg-color) p-6 shadow-xl">
        <h2 class="text-xl font-bold text-(--main-color)">Enter your name</h2>
        <input
          class="rounded bg-(--sub-alt-color) px-3 py-2 text-(--text-color) outline-none"
          maxLength={20}
          placeholder="Your name (max 20 chars)"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={(el: any) => setTimeout(() => el?.focus(), 50)}
        />
        <Button text="Join Race" onClick={submit} />
      </div>
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function Lobby(): JSXElement {
  const room = () => raceStore.room;
  const isCreator = isMySocketCreator;
  const canStart = () => (room()?.participants.length ?? 0) >= 2;

  const [config, setConfig] = createSignal<RaceConfig>(
    room()?.config ?? { mode: "time", mode2: 60, language: "english" },
  );

  const roomUrl = () =>
    `${window.location.origin}/compete/${room()?.id ?? ""}`;

  const copyLink = (): void => {
    void navigator.clipboard.writeText(roomUrl()).then(() => {
      showNoticeNotification("Room link copied!", { durationMs: 2000 });
    });
  };

  const applyConfig = (): void => {
    updateConfig(config());
  };

  const modeOptions: { label: string; mode: "time" | "words"; mode2: number }[] = [
    { label: "15s", mode: "time", mode2: 15 },
    { label: "30s", mode: "time", mode2: 30 },
    { label: "60s", mode: "time", mode2: 60 },
    { label: "120s", mode: "time", mode2: 120 },
    { label: "25 words", mode: "words", mode2: 25 },
    { label: "50 words", mode: "words", mode2: 50 },
    { label: "100 words", mode: "words", mode2: 100 },
  ];

  return (
    <div class="flex flex-col gap-8">
      {/* Header */}
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-(--main-color)">
          <Fa icon="fa-flag" class="mr-2" />
          Race Lobby
        </h1>
        <Button
          text="Copy Link"
          fa={{ icon: "fa-link" }}
          onClick={copyLink}
        />
      </div>

      {/* Room ID */}
      <div class="rounded-lg bg-(--sub-alt-color) px-5 py-3 text-center font-mono text-2xl tracking-widest text-(--text-color)">
        {room()?.id}
      </div>

      {/* Config (creator only) */}
      <Show when={isCreator()}>
        <div class="rounded-xl bg-(--sub-alt-color) p-5">
          <p class="mb-3 text-sm font-semibold uppercase text-(--sub-color)">
            Test Config
          </p>
          <div class="flex flex-wrap gap-2">
            <For each={modeOptions}>
              {(opt) => (
                <button
                  class={cn(
                    "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                    config().mode === opt.mode && config().mode2 === opt.mode2
                      ? "bg-(--main-color) text-(--bg-color)"
                      : "bg-(--bg-color) text-(--sub-color) hover:text-(--text-color)",
                  )}
                  onClick={() => {
                    setConfig({ ...config(), mode: opt.mode, mode2: opt.mode2 });
                    applyConfig();
                  }}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Current config for non-creators */}
      <Show when={!isCreator() && room()}>
        <div class="rounded-xl bg-(--sub-alt-color) p-4 text-center text-(--sub-color)">
          Mode:{" "}
          <span class="font-semibold text-(--text-color)">
            {room()?.config.mode} {room()?.config.mode2}
          </span>
        </div>
      </Show>

      {/* Participants */}
      <div class="rounded-xl bg-(--sub-alt-color) p-5">
        <p class="mb-3 text-sm font-semibold uppercase text-(--sub-color)">
          Participants ({room()?.participants.length ?? 0}/8)
        </p>
        <div class="flex flex-col gap-2">
          <For each={room()?.participants ?? []}>
            {(p) => (
              <div class="flex items-center gap-3 rounded-lg bg-(--bg-color) px-4 py-2">
                <Show when={p.isCreator}>
                  <Fa icon="fa-crown" class="text-(--main-color)" />
                </Show>
                <Show when={!p.isCreator}>
                  <Fa icon="fa-user" class="text-(--sub-color)" />
                </Show>
                <span class="flex-1 text-(--text-color)">{p.name}</span>
                <Show when={p.socketId === raceStore.mySocketId}>
                  <span class="text-xs text-(--sub-color)">(you)</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Start button (creator only) */}
      <Show when={isCreator()}>
        <Button
          text={canStart() ? "Start Race" : "Waiting for players (need ≥2)"}
          fa={{ icon: "fa-play" }}
          disabled={!canStart()}
          onClick={startRace}
          class="w-full py-3 text-lg"
        />
      </Show>
      <Show when={!isCreator()}>
        <p class="text-center text-(--sub-color)">
          Waiting for the creator to start the race…
        </p>
      </Show>

      {/* Error */}
      <Show when={raceStore.error}>
        <div class="rounded-lg bg-red-500/20 px-4 py-2 text-center text-red-400">
          {raceStore.error}
        </div>
      </Show>
    </div>
  );
}

// ─── Countdown overlay ────────────────────────────────────────────────────────

function CountdownOverlay(): JSXElement {
  return (
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div class="text-center">
        <p class="mb-2 text-lg text-(--sub-color)">Race starting in…</p>
        <p class="text-8xl font-bold text-(--main-color)">
          {raceStore.countdownSeconds}
        </p>
      </div>
    </div>
  );
}

// ─── Progress overlay during race ─────────────────────────────────────────────

function RaceOverlay(): JSXElement {
  const participants = () => raceStore.room?.participants ?? [];

  const sorted = () =>
    [...participants()].sort((a, b) => b.progress - a.progress);

  return (
    <div class="fixed right-4 top-20 z-30 w-56 rounded-xl bg-(--bg-color)/90 p-4 shadow-xl backdrop-blur-sm">
      <p class="mb-3 text-xs font-semibold uppercase text-(--sub-color)">
        Race Progress
      </p>
      <div class="flex flex-col gap-3">
        <For each={sorted()}>
          {(p) => (
            <div>
              <div class="mb-1 flex justify-between text-xs">
                <span
                  class={cn(
                    "max-w-[110px] truncate",
                    p.socketId === raceStore.mySocketId
                      ? "font-bold text-(--main-color)"
                      : "text-(--text-color)",
                  )}
                >
                  {p.name}
                </span>
                <span class="text-(--sub-color)">{Math.round(p.wpm)} wpm</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-(--sub-alt-color)">
                <div
                  class="h-full rounded-full bg-(--main-color) transition-all duration-300"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results(props: { onPlayAgain: () => void; onNewRoom: () => void }): JSXElement {
  const participants = () => raceStore.room?.participants ?? [];

  const sorted = () =>
    [...participants()]
      .filter((p) => p.result !== undefined)
      .sort((a, b) => (b.result?.wpm ?? 0) - (a.result?.wpm ?? 0));

  const rankEmoji = (i: number): string => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `${i + 1}.`;
  };

  return (
    <div class="flex flex-col gap-8">
      <h1 class="text-center text-3xl font-bold text-(--main-color)">
        Race Results
      </h1>

      <div class="flex flex-col gap-3">
        <For each={sorted()}>
          {(p, i) => (
            <div
              class={cn(
                "flex items-center gap-4 rounded-xl px-5 py-4",
                p.socketId === raceStore.mySocketId
                  ? "bg-(--main-color)/20"
                  : "bg-(--sub-alt-color)",
              )}
            >
              <span class="text-2xl">{rankEmoji(i())}</span>
              <span class="flex-1 font-semibold text-(--text-color)">
                {p.name}
                <Show when={p.socketId === raceStore.mySocketId}>
                  <span class="ml-2 text-xs text-(--sub-color)">(you)</span>
                </Show>
              </span>
              <div class="text-right">
                <p class="text-xl font-bold text-(--main-color)">
                  {Math.round(p.result?.wpm ?? 0)} wpm
                </p>
                <p class="text-sm text-(--sub-color)">
                  {Math.round(p.result?.rawWpm ?? 0)} raw ·{" "}
                  {Math.round(p.result?.acc ?? 0)}% acc
                </p>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="flex gap-4">
        <Button
          text="New Room"
          fa={{ icon: "fa-plus" }}
          class="flex-1"
          onClick={props.onNewRoom}
        />
        <Button
          text="Play Again"
          fa={{ icon: "fa-redo" }}
          class="flex-1"
          onClick={props.onPlayAgain}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CompetePage(): JSXElement {
  const isOpen = () => getActivePage() === "compete";
  const [showNameModal, setShowNameModal] = createSignal(false);
  const [pendingRoomId, setPendingRoomId] = createSignal<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = createSignal(false);

  onMount(() => {
    connect();
  });

  onCleanup(() => {
    RaceMode.exitRaceMode();
    disconnect();
  });

  // When page becomes visible, check if there's a room ID in URL
  createEffect(() => {
    if (!isOpen()) return;
    const roomId = getRoomIdFromUrl();
    if (roomId && raceStore.state === "idle") {
      setPendingRoomId(roomId);
      setShowNameModal(true);
    }
  });

  // When racing starts, enter race mode on the test engine
  createEffect(() => {
    if (raceStore.state === "racing" && raceStore.words.length > 0) {
      const cfg = raceStore.raceConfig;
      if (!cfg) return;
      RaceMode.enterRaceMode(raceStore.words, cfg, raceStore.raceStartAt ?? undefined);
      // Navigate to test and trigger restart
      void import("../../controllers/page-controller").then(
        ({ change }) => {
          void change("test", {});
        },
      );
    }
    if (raceStore.state === "finished") {
      RaceMode.exitRaceMode();
    }
  });

  const handleNameSubmit = async (name: string): Promise<void> => {
    const roomId = pendingRoomId();
    setShowNameModal(false);
    if (roomId) {
      joinRoom(roomId, name);
    }
  };

  const handleCreateRoom = async (): Promise<void> => {
    if (isCreatingRoom()) return;
    setIsCreatingRoom(true);

    try {
      // Generate words using existing language data
      const { generateWords } = await import("../../test/words-generator");
      const { getLanguage } = await import("../../utils/json-data");
      const language = await getLanguage("english");
      const gen = await generateWords(language);
      const words = gen.words.slice(0, 100);

      const response = await fetch(`${API_URL}/compete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { mode: "time", mode2: 60, language: "english" },
          words,
        }),
      });

      const json = (await response.json()) as { data: { roomId: string } };
      const roomId = json.data?.roomId;

      if (!roomId) {
        showErrorNotification("Failed to create room");
        return;
      }

      window.history.pushState({}, "", `/compete/${roomId}`);
      setPendingRoomId(roomId);
      setShowNameModal(true);
    } catch (e) {
      showErrorNotification("Failed to create room", { error: e as Error });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handlePlayAgain = (): void => {
    const roomId = raceStore.room?.id ?? null;
    if (!roomId) return;
    // Reset room state — just rejoin with same name
    const myName =
      raceStore.room?.participants.find(
        (p) => p.socketId === raceStore.mySocketId,
      )?.name ?? "Player";
    joinRoom(roomId, myName);
  };

  const handleNewRoom = (): void => {
    void handleCreateRoom();
  };

  return (
    <div
      class="mx-auto flex max-w-2xl flex-col gap-8 p-8"
      classList={{ hidden: !isOpen() }}
    >
      {/* Show name modal when needed */}
      <Show when={showNameModal()}>
        <NameModal onSubmit={(n) => void handleNameSubmit(n)} />
      </Show>

      {/* Countdown overlay */}
      <Show when={raceStore.state === "countdown"}>
        <CountdownOverlay />
      </Show>

      {/* Progress overlay during racing */}
      <Show when={raceStore.state === "racing"}>
        <RaceOverlay />
      </Show>

      {/* Idle state — landing / create room */}
      <Show when={raceStore.state === "idle"}>
        <div class="flex flex-col items-center gap-8 py-16 text-center">
          <div>
            <h1 class="mb-2 text-4xl font-bold text-(--main-color)">
              <Fa icon="fa-users" class="mr-3" />
              Race Mode
            </h1>
            <p class="text-(--sub-color)">
              Invite friends and race to the finish. Same words, live progress.
            </p>
          </div>
          <Button
            text={isCreatingRoom() ? "Creating…" : "Create Room"}
            fa={{ icon: "fa-plus" }}
            disabled={isCreatingRoom()}
            onClick={() => void handleCreateRoom()}
            class="px-8 py-3 text-lg"
          />
          <p class="text-sm text-(--sub-color)">
            Or open a room link someone shared with you.
          </p>
        </div>
      </Show>

      {/* Lobby */}
      <Show when={raceStore.state === "lobby"}>
        <Lobby />
      </Show>

      {/* Results */}
      <Show when={raceStore.state === "finished"}>
        <Results onPlayAgain={handlePlayAgain} onNewRoom={handleNewRoom} />
      </Show>
    </div>
  );
}
