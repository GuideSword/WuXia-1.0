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
const LEGACY = z.object({ schemaVersion: z.literal(0), game: GAME.extend({ permanent: PERMANENT.partial({ learnedArts: true, heardRumors: true, confirmedRumors: true, flags: true, relations: true, raids: true }) }) });

const CURRENT = 'wuxia.current';
const GOOD = 'wuxia.lastKnownGood';
const PENDING = 'wuxia.pending';

export function parseImport(text: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('存档 JSON 无法解析');
  }
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed)) throw new Error('存档版本缺失');
  const version = (parsed as { schemaVersion: unknown }).schemaVersion;
  if (version !== 0 && version !== 1) throw new Error(`不支持的存档版本：${String(version)}`);
  try {
    const game = version === 1 ? ENVELOPE.parse(parsed).game : (() => {
      const legacy = LEGACY.parse(parsed).game;
      return GAME.parse({ ...legacy, permanent: { ...createGame().permanent, ...legacy.permanent } });
    })();
    if (!game.permanent.learnedArts.includes('basic_sword')) game.permanent.learnedArts.unshift('basic_sword');
    if (['explore', 'combat'].includes(game.phase) !== !!game.run) throw new Error('存档阶段与本局状态不一致');
    if (game.phase === 'combat' && !game.run?.battle) throw new Error('战斗阶段缺少敌方状态');
    if (game.phase === 'explore' && game.run?.battle) throw new Error('探索阶段存在未结束战斗');
    if (game.phase === 'result' && !game.lastResult) throw new Error('结算阶段缺少结果');
    return game;
  } catch (error) {
    throw new Error(`存档校验失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export function exportSave(game: GameState): string {
  const text = JSON.stringify({ schemaVersion: 1, game }, null, 2);
  parseImport(text);
  return text;
}

export function commitImport(storage: Storage, game: GameState): void {
  saveGame(storage, game);
}

export function saveGame(storage: Storage, game: GameState): void {
  const payload = JSON.stringify({ schemaVersion: 1, game });
  parseImport(payload);
  storage.setItem(PENDING, payload);
  parseImport(storage.getItem(PENDING) ?? '');
  const previous = storage.getItem(CURRENT);
  if (previous) {
    try { parseImport(previous); storage.setItem(GOOD, previous); }
    catch {
      try { parseImport(storage.getItem(GOOD) ?? ''); }
      catch { storage.setItem(GOOD, payload); }
    }
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
    try { return parseImport(current); } catch { /* 保留原文，尝试安全副本 */ }
  }
  if (backup) {
    try {
      const game = parseImport(backup);
      onRecovery?.();
      return game;
    } catch { /* 两份皆损坏时禁止静默清档 */ }
  }
  throw new Error('当前存档和上一稳定存档均损坏，请先导出备份再处理。');
}
