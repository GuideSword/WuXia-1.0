import { z } from 'zod';
import { createGame } from './engine/lifecycle';
import type { GameState } from './model';

const COUNTS = z.record(z.string(), z.number().int().nonnegative());
const PERMANENT = z.object({
  coins: z.number().int().nonnegative(),
  stash: COUNTS,
  learnedArts: z.array(z.string()),
  heardRumors: z.array(z.string()),
  confirmedRumors: z.array(z.string()),
  flags: z.array(z.string()),
  relations: z.record(z.string(), z.number().int()),
  raids: z.number().int().nonnegative(),
});
const BATTLE = z.object({
  npcId: z.string(),
  enemyHp: z.number().int(),
  round: z.number().int().positive(),
  intent: z.enum(['strike', 'heavy', 'guard']),
  defending: z.boolean(),
});
const RUN = z.object({
  locationId: z.string(),
  hp: z.number().int().min(0).max(100),
  heat: z.number().int().min(0).max(100),
  coins: z.number().int().nonnegative(),
  inventory: COUNTS,
  loot: COUNTS,
  pendingRumors: z.array(z.string()),
  flags: z.array(z.string()),
  seed: z.number().int(),
  battle: BATTLE.nullable(),
});
const RESULT = z.object({
  success: z.boolean(),
  coins: z.number().int().nonnegative(),
  loot: COUNTS,
  rumors: z.array(z.string()),
  lost: COUNTS,
  route: z.string().nullable(),
  message: z.string(),
});
const GAME = z.object({
  phase: z.enum(['town', 'rumors', 'prep', 'explore', 'combat', 'result', 'error']),
  permanent: PERMANENT,
  run: RUN.nullable(),
  safeLocationId: z.string(),
  selectedRumorId: z.string().nullable(),
  lastResult: RESULT.nullable(),
  notice: z.string().nullable(),
});
const ENVELOPE = z.object({ schemaVersion: z.literal(1), game: GAME });

const CURRENT = 'wuxia.current';
const GOOD = 'wuxia.lastKnownGood';
const PENDING = 'wuxia.pending';

function parseEnvelope(text: string): GameState {
  try {
    const parsed: unknown = JSON.parse(text);
    const game = ENVELOPE.parse(parsed).game;
    if (!game.permanent.learnedArts.includes('basic_sword')) game.permanent.learnedArts.unshift('basic_sword');
    return game;
  } catch (error) {
    throw new Error(`存档校验失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export function saveGame(storage: Storage, game: GameState): void {
  const payload = JSON.stringify({ schemaVersion: 1, game });
  parseEnvelope(payload);
  storage.setItem(PENDING, payload);
  parseEnvelope(storage.getItem(PENDING) ?? '');
  const previous = storage.getItem(CURRENT);
  if (previous) {
    try { parseEnvelope(previous); storage.setItem(GOOD, previous); }
    catch { if (!storage.getItem(GOOD)) storage.setItem(GOOD, payload); }
  } else {
    storage.setItem(GOOD, payload);
  }
  storage.setItem(CURRENT, payload);
  storage.removeItem(PENDING);
}

export function loadGame(storage: Storage, onRecovery?: () => void): GameState {
  const current = storage.getItem(CURRENT);
  const backup = storage.getItem(GOOD);
  if (!current && !backup) return createGame();
  if (current) {
    try { return parseEnvelope(current); } catch { /* 保留原文，尝试安全副本 */ }
  }
  if (backup) {
    try {
      const game = parseEnvelope(backup);
      onRecovery?.();
      return game;
    } catch { /* 两份皆损坏时禁止静默清档 */ }
  }
  throw new Error('当前存档和上一稳定存档均损坏，请先导出备份再处理。');
}
