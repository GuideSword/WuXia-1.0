import type { Content, Counts, GameState, Id, PermanentState, RunState } from '../model';
import { canCarry } from './inventory';
import { canUseGate } from './heat';

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

export function startRun(state: GameState, loadout: Counts, carriedCoins: number, seed: number, content?: Content): GameState {
  if (state.run || !['town', 'prep', 'rumors'].includes(state.phase)) throw new Error('当前不能再次出发');
  if (!Number.isSafeInteger(carriedCoins) || carriedCoins < 0 || carriedCoins > state.permanent.coins) {
    throw new Error('携带银两数量无效');
  }
  if (!Number.isSafeInteger(seed)) throw new Error('随机种子无效');
  if (Object.keys(loadout).length > 0 && !content) throw new Error('整备需要物品配置');
  if (content && !canCarry(loadout, content.items)) throw new Error('负重超过 30');
  const stash = { ...state.permanent.stash };
  for (const [id, count] of Object.entries(loadout)) {
    if (!Number.isSafeInteger(count) || count < 0 || (stash[id] ?? 0) < count) throw new Error(`携带物资不足: ${id}`);
    stash[id] -= count;
    if (stash[id] === 0) delete stash[id];
  }
  return {
    ...state,
    phase: 'explore',
    permanent: { ...state.permanent, coins: state.permanent.coins - carriedCoins, stash, raids: state.permanent.raids + 1 },
    run: {
      locationId: 'foothill',
      hp: 100,
      heat: 0,
      coins: carriedCoins,
      inventory: { ...loadout },
      loot: {},
      pendingRumors: [],
      flags: [],
      seed,
      battle: null,
    },
    lastResult: null,
    notice: '你已来到黑风寨山脚。',
  };
}

export function moveTo(state: GameState, destinationId: Id, content: Content): GameState {
  const currentId = state.run?.locationId ?? state.safeLocationId;
  const current = content.locations.find((location) => location.id === currentId);
  const destination = content.locations.find((location) => location.id === destinationId);
  if (!current || !destination || !current.next.includes(destinationId) || current.kind !== destination.kind) {
    throw new Error(`从${current?.name ?? currentId}不可到达${destination?.name ?? destinationId}`);
  }
  if (destination.requiresFlag && !state.run?.flags.includes(destination.requiresFlag)) throw new Error('尚未解开此处入口');
  if (state.run) {
    if (state.phase !== 'explore') throw new Error('战斗中不可移动');
    return { ...state, run: { ...state.run, locationId: destinationId }, notice: destination.description };
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
  return {
    ...state,
    phase: 'result',
    permanent: {
      ...state.permanent,
      coins: state.permanent.coins + broughtCoins,
      stash: addCounts(addCounts(state.permanent.stash, run.inventory), retainedLoot),
      confirmedRumors: [...new Set([...state.permanent.confirmedRumors, ...run.pendingRumors])],
    },
    run: null,
    lastResult: { success: true, coins: broughtCoins, loot: { ...run.loot }, rumors: [...run.pendingRumors], lost, route: routeId, message: `撤离成功。你从${{ gate: '山门', cliff: '悬崖', waterway: '水道', caravan: '商队', tunnel: '后山密道' }[routeId] ?? routeId}离开，将所得带回青石镇。` },
    notice: null,
  };
}

export function failRun(state: GameState): GameState {
  const run = requireRun(state);
  return {
    ...state,
    phase: 'result',
    run: null,
    lastResult: { success: false, coins: 0, loot: {}, rumors: [], lost: addCounts(run.inventory, run.loot), route: null, message: '此行失手，本局物资已经遗失。' },
    notice: null,
  };
}

export function returnToTown(state: GameState): GameState {
  if (state.phase !== 'result') throw new Error('只有结算后才能返回青石镇');
  return { ...state, phase: 'town', safeLocationId: 'town_square', notice: null };
}
