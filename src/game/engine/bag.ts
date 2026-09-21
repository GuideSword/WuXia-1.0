import type { Content, Counts, GameState, RunState } from '../model';
import { moveCopy } from './copies';
import { BAG_CAPACITY, bagSlots, itemSlots, runWeight } from './inventory';

export type ItemPlace = 'bag' | 'pocket' | 'worn';

function requireExploration(state: GameState): RunState {
  if (state.phase !== 'explore' || !state.run) throw new Error('当前不能整理行囊');
  return state.run;
}

function updateGround(run: RunState, itemId: string, amount: number): Record<string, Counts> {
  const groundItems = { ...run.groundItems };
  const atLocation = { ...(groundItems[run.locationId] ?? {}) };
  const next = (atLocation[itemId] ?? 0) + amount;
  if (next < 0) throw new Error('地上没有这件物品');
  if (next === 0) delete atLocation[itemId];
  else atLocation[itemId] = next;
  if (Object.keys(atLocation).length === 0) delete groundItems[run.locationId];
  else groundItems[run.locationId] = atLocation;
  return groundItems;
}

function removeOne(counts: Counts, id: string): Counts {
  const next = { ...counts, [id]: (counts[id] ?? 0) - 1 };
  if (next[id] < 0) throw new Error('身上没有这件物品');
  if (next[id] === 0) delete next[id];
  return next;
}

export function dropCarriedItem(state: GameState, itemId: string, place: ItemPlace, content: Content): GameState {
  const run = requireExploration(state);
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item) throw new Error('未知物品');
  const carried = (run.inventory[itemId] ?? 0) + (run.loot[itemId] ?? 0);
  const pocket = run.pocketItems?.[itemId] ?? 0;
  const worn = Number(run.wornItemIds?.includes(itemId) ?? false);
  const available = place === 'bag' ? carried - pocket - worn : place === 'pocket' ? pocket : worn;
  if (available < 1) throw new Error('该位置没有这件物品');

  const removeFromLoot = (run.loot[itemId] ?? 0) > 0 && (place !== 'worn' || (run.inventory[itemId] ?? 0) === 0);
  const inventory = removeFromLoot ? run.inventory : removeOne(run.inventory, itemId);
  const loot = removeFromLoot ? removeOne(run.loot, itemId) : run.loot;
  const pocketItems = place === 'pocket' ? removeOne(run.pocketItems ?? {}, itemId) : run.pocketItems;
  const wornItemIds = place === 'worn' ? (run.wornItemIds ?? []).filter((id) => id !== itemId) : run.wornItemIds;
  const location = content.locations.find((entry) => entry.id === run.locationId)?.name ?? '此处';
  const nextRun: RunState = {
    ...run, inventory, loot, pocketItems, wornItemIds,
    groundItems: updateGround(run, itemId, 1),
    log: [...(run.log ?? []), `把${item.name}留在${location}`].slice(-30),
  };
  return {
    ...state,
    run: nextRun,
    notice: `你把${item.name}放在${location}，离开前还可以拾回。\n负重 -${item.weight}${place === 'bag' ? ` · 背包 -${itemSlots(item)} 格` : ''}`,
  };
}

export function recoverGroundItem(state: GameState, itemId: string, content: Content): GameState {
  const run = requireExploration(state);
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item || (run.groundItems?.[run.locationId]?.[itemId] ?? 0) < 1) throw new Error('地上没有这件物品');
  const inventory = item.kind === 'loot' ? run.inventory : { ...run.inventory, [itemId]: (run.inventory[itemId] ?? 0) + 1 };
  const loot = item.kind === 'loot' ? { ...run.loot, [itemId]: (run.loot[itemId] ?? 0) + 1 } : run.loot;
  const nextRun: RunState = { ...run, inventory, loot, groundItems: updateGround(run, itemId, -1), log: [...(run.log ?? []), `拾回${item.name}`].slice(-30) };
  if (runWeight(nextRun, content, state.permanent.copyPositions) > 30) throw new Error('负重已达上限，请先丢下其他物品');
  if (bagSlots(nextRun, content, state.permanent.copyPositions) > BAG_CAPACITY) throw new Error('背包格子已满，请先丢下其他物品');
  return { ...state, run: nextRun, notice: `你拾回${item.name}，重新放进行囊。\n负重 +${item.weight} · 背包 +${itemSlots(item)} 格` };
}

export function dropCarriedCopy(state: GameState, copyId: string, content: Content): GameState {
  const run = requireExploration(state);
  const position = state.permanent.copyPositions[copyId];
  if (position?.kind !== 'bag' && position?.kind !== 'pocket') throw new Error('这份独本不在身上');
  const copy = content.copies.find((entry) => entry.id === copyId);
  if (!copy) throw new Error('未知独本');
  const next = moveCopy(state, copyId, { kind: 'lost', locationId: run.locationId }, { kind: position.kind }, content);
  const location = content.locations.find((entry) => entry.id === run.locationId)?.name ?? '此处';
  return { ...next, run: { ...run, log: [...(run.log ?? []), `把${copy.title}留在${location}`].slice(-30) }, notice: `你把${copy.title}留在${location}。回到这里仍可找回。` };
}
