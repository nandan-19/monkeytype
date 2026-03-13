import { JSXElement, Show } from "solid-js";
import { envConfig } from "virtual:env-config";

import { getActivePage, getIsScreenshotting } from "../../../signals/core";
import { showModal } from "../../../stores/modals";
import { cn } from "../../../utils/cn";
import { isDevEnvironment } from "../../../utils/misc";
import { raceStore } from "../../../services/race-socket";
import * as RaceMode from "../../../test/race-mode";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";
import { ScrollToTop } from "../footer/ScrollToTop";
import { Banners } from "./Banners";
import { FpsCounter } from "./FpsCounter";
import { LoaderBar } from "./LoaderBar";
import { MediaQueryDebugger } from "./MediaQueryDebugger";
import { Notifications } from "./Notifications";

export function Overlays(): JSXElement {
  return (
    <>
      <ScrollToTop />
      <button
        type="button"
        id="commandLineMobileButton"
        class={cn(
          "fixed bottom-8 left-8 z-99 hidden h-12 w-12 rounded-full bg-main text-center leading-12 text-bg",
          {
            "opacity-0": getIsScreenshotting(),
          },
        )}
        onClick={() => {
          showModal("Commandline");
        }}
        tabIndex="-1"
      >
        <Fa icon="fa-terminal" />
      </button>
      <Banners />
      <Notifications />
      <MediaQueryDebugger />
      <LoaderBar />
      <FpsCounter />
      <RaceLiveOverlay />
      <Show when={isDevEnvironment()}>
        <DevButtons />
      </Show>
    </>
  );
}

function RaceLiveOverlay(): JSXElement {
  const shouldShow = (): boolean => {
    return (
      getActivePage() === "test" &&
      RaceMode.isRaceMode() &&
      raceStore.state === "racing" &&
      raceStore.room !== null
    );
  };

  const participants = () =>
    [...(raceStore.room?.participants ?? [])].sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      return b.wpm - a.wpm;
    });

  return (
    <Show when={shouldShow()}>
      <div class="fixed right-4 top-28 z-999 max-h-[70vh] w-72 overflow-auto rounded-xl border border-(--sub-alt-color) bg-(--bg-color)/95 p-4 shadow-xl backdrop-blur-sm">
        <p class="mb-3 text-xs font-semibold uppercase text-(--sub-color)">
          Live Race
        </p>
        <div class="flex flex-col gap-3">
          {participants().map((p) => (
            <div>
              <div class="mb-1 flex items-center justify-between text-xs">
                <span
                  class={cn(
                    "max-w-[140px] truncate",
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
                  class="h-full rounded-full bg-(--main-color) transition-all duration-200"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Show>
  );
}

function DevButtons(): JSXElement {
  return (
    <div class="fixed top-30 left-0 z-10000 flex w-max flex-col gap-2 text-xs">
      <Button
        href={`${envConfig.backendUrl}/configure/`}
        balloon={{
          text: "Configure server",
          position: "right",
        }}
        fa={{
          icon: "fa-server",
        }}
        class="rounded-tl-none rounded-bl-none p-2"
      />
      <Button
        balloon={{
          text: "Dev options",
          position: "right",
        }}
        onClick={() => showModal("DevOptions")}
        fa={{
          icon: "fa-flask",
        }}
        class="rounded-tl-none rounded-bl-none p-2"
      />
    </div>
  );
}
