import type { Content, Counts, GameState, Id, PermanentState, RunState } from '../model';
import { BAG_CAPACITY, bagSlots, canCarry, totalWeight } from './inventory';
import { canUseGate } from './heat';
import { loadBundledContent } from '../content/load';

function addCounts(a: Counts, b: Counts): Counts {
  const merged = { ...a };
  for (const [id, count] of Object.entries(b)) merged[id] = (merged[id] ?? 0) + count;
  return merged;
}

function requireRun(state: GameState): RunState {
  if (!state.run) throw new Error('当前没有进行中的本局探索');
  return state.run;
}

export function createGame(): GameState {
  const permanent: PermanentState = {
    coins: 500,
    stash: {},
    learnedArts: ['basic_sword'],
    heardRumors: [],
    confirmedRumors: [],
    flags: [],
    relations: {},
    raids: 0,
    copyPositions: Object.fromEntries(loadBundledContent().copies.map((copy) => [copy.id, { kind: 'source' as const }])),
    learnedInsights: [],
  };
  return {
    phase: 'town',
    permanent,
    run: null,
    safeLocationId: 'town_square',
    selectedRumorId: null,
    lastResult: null,
    notice: null,
  };
}

export function startRun(state: GameState, loadout: Counts, carriedCoins: number, seed: number, content?: Content, regionId: 'blackwind' | 'qingyan' = 'blackwind', carriedCopyIds: Id[] = []): GameState {
  if (state.run || !['town', 'prep', 'rumors'].includes(state.phase)) throw new Error('当前不能再次出发');
  if (!Number.isSafeInteger(carriedCoins) || carriedCoins < 0 || carriedCoins > state.permanent.coins) {
    throw new Error('携带银两数量无效');
  }
  if (!Number.isSafeInteger(seed)) throw new Error('随机种子无效');
  if (regionId === 'qingyan' && (state.permanent.raids < 1 || !state.permanent.heardRumors.includes('qingyan_ruins'))) throw new Error('尚未探得青燕门旧址');
  if (Object.keys(loadout).length > 0 && !content) throw new Error('整备需要物品配置');
  if (carriedCopyIds.length > 0 && !content) throw new Error('携带独本需要物品配置');
  if (content && !canCarry(loadout, content.items)) throw new Error('负重超过 30');
  if (new Set(carriedCopyIds).size !== carriedCopyIds.length) throw new Error('不能重复携带同一份独本');
  const copyPositions = { ...state.permanent.copyPositions };
  let copyWeight = 0;
  for (const copyId of carriedCopyIds) {
    const copy = content?.copies.find((entry) => entry.id === copyId);
    if (!copy || copyPositions[copyId]?.kind !== 'home') throw new Error('这份独本不在家中');
    copyWeight += content?.items.find((item) => item.id === copy.itemId)?.weight ?? 0;
    copyPositions[copyId] = { kind: 'bag' };
  }
  if (content && totalWeight(loadout, content.items) + copyWeight > 30) throw new Error('负重超过 30');
  const stash = { ...state.permanent.stash };
  for (const [id, count] of Object.entries(loadout)) {
    if (!Number.isSafeInteger(count) || count < 0 || (stash[id] ?? 0) < count) throw new Error(`携带物资不足: ${id}`);
    stash[id] -= count;
    if (stash[id] === 0) delete stash[id];
  }
  const run: RunState = {
      regionId,
      locationId: regionId === 'qingyan' ? 'qingyan_gate' : 'foothill',
      hp: 100,
      heat: 0,
      coins: carriedCoins,
      inventory: { ...loadout },
      loot: {},
      pendingRumors: [],
      flags: state.permanent.flags.some((flag) => flag.startsWith('witnessed_style:')) ? ['known_style'] : [],
      seed,
      battle: null,
      log: [regionId === 'qingyan' ? '来到青燕门旧址' : '来到黑风寨山脚'],
      hiddenAt: null,
      patrolStep: 0,
      wornItemIds: ['sword', 'mask'].filter((id) => (loadout[id] ?? 0) > 0),
      pocketItems: {},
      groundItems: {},
    };
  if (content && bagSlots(run, content, copyPositions) > BAG_CAPACITY) throw new Error(`背包超过 ${BAG_CAPACITY} 格`);
  return {
    ...state,
    phase: 'explore',
    permanent: { ...state.permanent, coins: state.permanent.coins - carriedCoins, stash, copyPositions, raids: state.permanent.raids + 1 },
    run,
    lastResult: null,
    notice: regionId === 'qingyan' ? '你已来到青燕门旧址。' : '你已来到黑风寨山脚。',
  };
}

export function moveTo(state: GameState, destinationId: Id, content: Content): GameState {
  const currentId = state.run?.locationId ?? state.safeLocationId;
  const current = content.locations.find((location) => location.id === currentId);
  const destination = content.locations.find((location) => location.id === destinationId);
  if (!current || !destination || !current.next.includes(destinationId) || current.kind !== destination.kind) {
    throw new Error(`从${current?.name ?? currentId}不可到达${destination?.name ?? destinationId}`);
  }
  if (destination.requiresFlag && !state.run?.flags.includes(destination.requiresFlag) && !state.permanent.flags.includes(destination.requiresFlag)) throw new Error('尚未解开此处入口');
  if (state.run) {
    if (state.phase !== 'explore') throw new Error('战斗中不可移动');
    if (destination.regionId !== (state.run.regionId ?? 'blackwind')) throw new Error('不可跨地图移动');
    return { ...state, run: { ...state.run, locationId: destinationId, hiddenAt: null, log: [...(state.run.log ?? []), `抵达${destination.name}`].slice(-30) }, notice: destination.description };
  }
  if (state.phase !== 'town') throw new Error('当前不可在镇内移动');
  return { ...state, safeLocationId: destinationId, notice: destination.description };
}

export function extract(state: GameState, routeId: Id, content?: Content): GameState {
  const run = requireRun(state);
  if (state.phase !== 'explore') throw new Error('当前不能撤离');
  if (routeId !== 'gate' || !canUseGate(run)) throw new Error('当前撤离路线不可用');
  return settleExtraction(state, routeId, content);
}

export function settleExtraction(state: GameState, routeId: Id, content?: Content, lost: Counts = {}): GameState {
  const run = requireRun(state);
  if (state.phase !== 'explore') throw new Error('当前不能撤离');
  let convertedCoins = 0;
  const retainedLoot: Counts = {};
  for (const [id, count] of Object.entries(run.loot)) {
    const item = content?.items.find((entry) => entry.id === id);
    if (item?.coinValue) convertedCoins += item.coinValue * count;
    else retainedLoot[id] = count;
  }
  const broughtCoins = run.coins + convertedCoins;
  const bundled = content ?? loadBundledContent();
  const copyPositions = { ...state.permanent.copyPositions };
  const broughtCopies: Counts = {};
  for (const copy of bundled.copies) {
    const position = copyPositions[copy.id];
    if (position?.kind === 'bag' || position?.kind === 'pocket') {
      copyPositions[copy.id] = { kind: 'home' };
      broughtCopies[copy.itemId] = (broughtCopies[copy.itemId] ?? 0) + 1;
    }
  }
  return {
    ...state,
    phase: 'result',
    permanent: {
      ...state.permanent,
      coins: state.permanent.coins + broughtCoins,
      stash: addCounts(addCounts(state.permanent.stash, run.inventory), retainedLoot),
      confirmedRumors: [...new Set([...state.permanent.confirmedRumors, ...run.pendingRumors])],
      copyPositions,
    },
    run: null,
    lastResult: { success: true, coins: broughtCoins, loot: addCounts(run.loot, broughtCopies), rumors: [...run.pendingRumors], lost, kept: addCounts(run.inventory, broughtCopies), lostAt: null, route: routeId, message: `撤离成功。你从${{ gate: '山门', cliff: '悬崖', waterway: '水道', caravan: '商队', tunnel: '后山密道', qingyan_return: '青燕门旧山门', qingyan_cliff: '青燕门断崖' }[routeId] ?? routeId}离开，将所得带回青石镇。` },
    notice: null,
  };
}

export function failRun(state: GameState): GameState {
  const run = requireRun(state);
  const seen = run.flags.filter((flag) => flag.startsWith('style_seen:')).map((flag) => flag.replace('style_seen:', 'witnessed_style:'));
  const copyPositions = { ...state.permanent.copyPositions };
  const lostCopies: Counts = {};
  const keptCopies: Counts = {};
  for (const copy of loadBundledContent().copies) {
    const position = copyPositions[copy.id];
    if (position?.kind === 'bag') {
      copyPositions[copy.id] = { kind: 'lost', locationId: run.locationId };
      lostCopies[copy.itemId] = (lostCopies[copy.itemId] ?? 0) + 1;
    } else if (position?.kind === 'pocket') {
      copyPositions[copy.id] = { kind: 'home' };
      keptCopies[copy.itemId] = (keptCopies[copy.itemId] ?? 0) + 1;
    }
  }
  const available = addCounts(run.inventory, run.loot);
  const keptOrdinary: Counts = {};
  for (const [id, count] of Object.entries(run.pocketItems ?? {})) {
    if (count > (available[id] ?? 0)) throw new Error(`贴身物资数量无效：${id}`);
    keptOrdinary[id] = count;
  }
  for (const id of run.wornItemIds ?? []) {
    if ((available[id] ?? 0) <= (keptOrdinary[id] ?? 0)) throw new Error(`装备数量无效：${id}`);
    keptOrdinary[id] = (keptOrdinary[id] ?? 0) + 1;
  }
  const lostOrdinary: Counts = {};
  for (const [id, count] of Object.entries(available)) if (count > (keptOrdinary[id] ?? 0)) lostOrdinary[id] = count - (keptOrdinary[id] ?? 0);
  const kept = addCounts(keptOrdinary, keptCopies);
  const lost = addCounts(lostOrdinary, lostCopies);
  const lostCount = Object.values(lost).reduce((sum, count) => sum + count, 0);
  const hadLoss = lostCount > 0 || run.coins > 0;
  return {
    ...state,
    phase: 'result',
    permanent: { ...state.permanent, copyPositions, stash: addCounts(state.permanent.stash, keptOrdinary), flags: [...new Set([...state.permanent.flags, ...seen])] },
    run: null,
    lastResult: { success: false, coins: 0, loot: {}, rumors: [], lost, kept, lostAt: hadLoss ? run.locationId : null, route: null, message: lostCount ? '神秘人将你救出；慌乱中遗落了行囊，贴身物品仍在。' : run.coins > 0 ? '神秘人将你救出；携带的银两遗落了，贴身物品仍在。' : '神秘人将你救出；身上物品都带回来了。' },
    notice: null,
  };
}

export function returnToTown(state: GameState): GameState {
  if (state.phase !== 'result') throw new Error('只有结算后才能返回青石镇');
  return { ...state, phase: 'town', safeLocationId: 'town_square', notice: null };
}
