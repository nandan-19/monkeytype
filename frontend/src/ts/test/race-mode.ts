/**
 * race-mode.ts
 * Bridges the typing test engine with the live race feature.
 *
 * When race mode is active:
 *  - Words are pre-supplied (same for all participants).
 *  - Config changes are blocked.
 *  - After finish, results are emitted via socket instead of saved to DB.
 */

import type { RaceConfig } from "@monkeytype/schemas/compete";

let _isRaceMode = false;
let _words: string[] = [];
let _config: RaceConfig | null = null;
let _startAt: number | null = null;

export function enterRaceMode(
  words: string[],
  config: RaceConfig,
  startAt?: number,
): void {
  _isRaceMode = true;
  _words = words;
  _config = config;
  _startAt = startAt ?? null;
}

export function exitRaceMode(): void {
  _isRaceMode = false;
  _words = [];
  _config = null;
  _startAt = null;
}

export function isRaceMode(): boolean {
  return _isRaceMode;
}

export function getRaceWords(): string[] {
  return _words;
}

export function getRaceConfig(): RaceConfig | null {
  return _config;
}

export function getRaceStartAt(): number | null {
  return _startAt;
}
