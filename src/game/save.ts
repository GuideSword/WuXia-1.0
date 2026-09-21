import { z } from 'zod';
import { createGame } from './engine/lifecycle';
import type { GameState } from './model';
import { loadBundledContent } from './content/load';
import { assertCopyRegistry } from './engine/copies';
import { totalWeight } from './engine/inventory';

const COUNTS = z.record(z.string(), z.number().int().nonnegative());
const PERMANENT_V1 = z.object({
  coins: z.number().int().nonnegative(),
  stash: COUNTS,
  learnedArts: z.array(z.string()),
  heardRumors: z.array(z.string()),
  confirmedRumors: z.array(z.string()),
  flags: z.array(z.string()),
  relations: z.record(z.string(), z.number().int()),
  raids: z.number().int().nonnegative(),
});
const COPY_POSITION = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('source') }),
  z.object({ kind: z.literal('bag') }),
  z.object({ kind: z.literal('pocket') }),
  z.object({ kind: z.literal('home') }),
  z.object({ kind: z.literal('lost'), locationId: z.string() }),
]);
const PERMANENT = PERMANENT_V1.extend({
  copyPositions: z.record(z.string(), COPY_POSITION),
  learnedInsights: z.array(z.string()),
});
const BATTLE = z.object({
  npcId: z.string(),
  enemyHp: z.number().int(),
  round: z.number().int().positive(),
  intent: z.enum(['strike', 'heavy', 'guard']),
  defending: z.boolean(),
});
const RUN_V1 = z.object({
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
  log: z.array(z.string()).optional(),
});
const RUN = RUN_V1.extend({
  regionId: z.enum(['blackwind', 'qingyan']).default('blackwind'),
  hiddenAt: z.string().nullable().default(null),
  patrolStep: z.number().int().nonnegative().default(0),
  wornItemIds: z.array(z.string()).default([]),
  pocketItems: COUNTS.default({}),
  groundItems: z.record(z.string(), COUNTS).default({}),
});
const RESULT_V1 = z.object({
  success: z.boolean(),
  coins: z.number().int().nonnegative(),
  loot: COUNTS,
  rumors: z.array(z.string()),
  lost: COUNTS,
  route: z.string().nullable(),
  message: z.string(),
});
const RESULT = RESULT_V1.extend({
  kept: COUNTS.default({}),
  lostAt: z.string().nullable().default(null),
});
const GAME_V1 = z.object({
  phase: z.enum(['town', 'rumors', 'prep', 'explore', 'combat', 'result', 'error']),
  permanent: PERMANENT_V1,
  run: RUN_V1.nullable(),
  safeLocationId: z.string(),
  selectedRumorId: z.string().nullable(),
  lastResult: RESULT_V1.nullable(),
  notice: z.string().nullable(),
});
const GAME = GAME_V1.extend({ permanent: PERMANENT, run: RUN.nullable(), lastResult: RESULT.nullable() });
const ENVELOPE = z.object({ schemaVersion: z.literal(2), game: GAME });
const ENVELOPE_V1 = z.object({ schemaVersion: z.literal(1), game: GAME_V1 });
const LEGACY = z.object({ schemaVersion: z.literal(0), game: GAME_V1.extend({ permanent: PERMANENT_V1.partial({ learnedArts: true, heardRumors: true, confirmedRumors: true, flags: true, relations: true, raids: true }) }) });

function migrateV1(game: z.infer<typeof GAME_V1>): GameState {
  const stash = { ...game.permanent.stash };
  const inventory = { ...(game.run?.inventory ?? {}) };
  const loot = { ...(game.run?.loot ?? {}) };
  const copyPositions = { ...createGame().permanent.copyPositions };
  const legacySources = [
    ['swallow_manual', 'swallow_biaoshi_copy'],
    ['blood_blade_page', 'blood_page_copy'],
    ['tunnel_map', 'tunnel_map_copy'],
  ] as const;
  for (const [oldId, copyId] of legacySources) {
    const holder = [stash, inventory, loot].find((counts) => (counts[oldId] ?? 0) > 0);
    if (holder) {
      holder[oldId] -= 1;
      if (holder[oldId] === 0) delete holder[oldId];
      copyPositions[copyId] = { kind: holder === stash ? 'home' : 'bag' };
    } else if ((game.lastResult?.lost[oldId] ?? 0) > 0) {
      // Old results did not record the defeat scene. Keep the copy recoverable at its known source.
      const sourceLocationId = loadBundledContent().copies.find((copy) => copy.id === copyId)!.sourceLocationId;
      copyPositions[copyId] = { kind: 'lost', locationId: sourceLocationId };
    }
  }
  if (game.permanent.learnedArts.includes('swallow_step') && copyPositions.swallow_biaoshi_copy.kind === 'source') copyPositions.swallow_biaoshi_copy = { kind: 'home' };
  return {
    ...game,
    permanent: { ...game.permanent, stash, copyPositions, learnedInsights: [], flags: [...new Set([...game.permanent.flags, ...(copyPositions.blood_page_copy.kind !== 'source' || game.run?.flags.includes('blood_page_taken') ? ['chief_secret_discovered'] : [])])] },
    run: game.run ? { ...game.run, inventory, loot, regionId: 'blackwind', hiddenAt: null, patrolStep: 0, wornItemIds: [], pocketItems: {} } : null,
    lastResult: game.lastResult ? { ...game.lastResult, kept: {}, lostAt: Object.values(copyPositions).find((position) => position.kind === 'lost')?.locationId ?? null } : null,
  };
}

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];

export function slotKeys(slot: SaveSlot) {
  const prefix = slot === 1 ? 'wuxia' : `wuxia.slot${slot}`;
  return { current: `${prefix}.current`, good: `${prefix}.lastKnownGood`, pending: `${prefix}.pending` };
}

export type SlotSummary =
  | { slot: SaveSlot; status: 'empty' }
  | { slot: SaveSlot; status: 'ready'; game: GameState }
  | { slot: SaveSlot; status: 'damaged' };

export function inspectSaveSlot(storage: Storage, slot: SaveSlot): SlotSummary {
  try {
    const { current, good } = slotKeys(slot);
    if (!storage.getItem(current) && !storage.getItem(good)) return { slot, status: 'empty' };
    return { slot, status: 'ready', game: loadGame(storage, undefined, slot) };
  } catch {
    return { slot, status: 'damaged' };
  }
}

export function parseImport(text: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('存档 JSON 无法解析');
  }
  if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed)) throw new Error('存档版本缺失');
  const version = (parsed as { schemaVersion: unknown }).schemaVersion;
  if (version !== 0 && version !== 1 && version !== 2) throw new Error(`不支持的存档版本：${String(version)}`);
  try {
    const game: GameState = version === 2 ? (() => {
      const current = ENVELOPE.parse(parsed).game;
      return { ...current, permanent: { ...current.permanent, copyPositions: { ...createGame().permanent.copyPositions, ...current.permanent.copyPositions } } };
    })() : version === 1 ? migrateV1(ENVELOPE_V1.parse(parsed).game) : (() => {
      const legacy = LEGACY.parse(parsed).game;
      const oldDefaults = PERMANENT_V1.parse(createGame().permanent);
      return migrateV1(GAME_V1.parse({ ...legacy, permanent: { ...oldDefaults, ...legacy.permanent } }));
    })();
    if (!game.permanent.learnedArts.includes('basic_sword')) game.permanent.learnedArts.unshift('basic_sword');
    if (['explore', 'combat'].includes(game.phase) !== !!game.run) throw new Error('存档阶段与本局状态不一致');
    if (game.phase === 'combat' && !game.run?.battle) throw new Error('战斗阶段缺少敌方状态');
    if (game.phase === 'explore' && game.run?.battle) throw new Error('探索阶段存在未结束战斗');
    if (game.phase === 'result' && !game.lastResult) throw new Error('结算阶段缺少结果');
    assertCopyRegistry(game, loadBundledContent());
    const content = loadBundledContent();
    if (game.run) {
      const run = game.run;
      const location = content.locations.find((entry) => entry.id === run.locationId);
      if (location?.kind !== 'danger' || location.regionId !== (run.regionId ?? 'blackwind')) throw new Error('本局地点与地图不一致');
      let pocketWeight = totalWeight(run.pocketItems ?? {}, content.items);
      for (const copy of content.copies) if (game.permanent.copyPositions[copy.id]?.kind === 'pocket') pocketWeight += content.items.find((item) => item.id === copy.itemId)?.weight ?? 0;
      if (pocketWeight > 2) throw new Error('贴身位置超过上限');
      for (const [id, count] of Object.entries(run.pocketItems ?? {})) {
        const item = content.items.find((entry) => entry.id === id);
        if (!item || item.weight > 1 || count > (run.inventory[id] ?? 0) + (run.loot[id] ?? 0) - Number(run.wornItemIds?.includes(id) ?? false)) throw new Error('贴身物品无效');
      }
      for (const id of run.wornItemIds ?? []) if (!['sword', 'mask'].includes(id) || (run.inventory[id] ?? 0) + (run.loot[id] ?? 0) < 1) throw new Error('穿戴装备无效');
      for (const [groundLocationId, counts] of Object.entries(run.groundItems ?? {})) {
        const groundLocation = content.locations.find((entry) => entry.id === groundLocationId);
        if (groundLocation?.kind !== 'danger' || groundLocation.regionId !== (run.regionId ?? 'blackwind')) throw new Error('地上物品地点无效');
        for (const id of Object.keys(counts)) if (!content.items.some((item) => item.id === id)) throw new Error('地上有未知物品');
      }
    }
    return game;
  } catch (error) {
    throw new Error(`存档校验失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export function exportSave(game: GameState): string {
  const text = JSON.stringify({ schemaVersion: 2, game }, null, 2);
  parseImport(text);
  return text;
}

export function commitImport(storage: Storage, game: GameState, slot: SaveSlot = 1): void {
  saveGame(storage, game, slot);
}

export function saveGame(storage: Storage, game: GameState, slot: SaveSlot = 1): void {
  const { current, good, pending } = slotKeys(slot);
  const payload = JSON.stringify({ schemaVersion: 2, game });
  parseImport(payload);
  storage.setItem(pending, payload);
  parseImport(storage.getItem(pending) ?? '');
  const previous = storage.getItem(current);
  if (previous) {
    try { parseImport(previous); storage.setItem(good, previous); }
    catch {
      try { parseImport(storage.getItem(good) ?? ''); }
      catch { storage.setItem(good, payload); }
    }
  } else {
    storage.setItem(good, payload);
  }
  storage.setItem(current, payload);
  storage.removeItem(pending);
}

export function loadGame(storage: Storage, onRecovery?: () => void, slot: SaveSlot = 1): GameState {
  const keys = slotKeys(slot);
  const current = storage.getItem(keys.current);
  const backup = storage.getItem(keys.good);
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
