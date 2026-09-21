import type { Content, GameState } from '../model';
import { moveCopy } from './copies';
import { totalWeight } from './inventory';
import { addHeat } from './heat';

export function pocketWeight(state: GameState, content: Content): number {
  const ordinary = totalWeight(state.run?.pocketItems ?? {}, content.items);
  const copies = content.copies.filter((copy) => state.permanent.copyPositions[copy.id]?.kind === 'pocket');
  return ordinary + copies.reduce((weight, copy) => weight + (content.items.find((item) => item.id === copy.itemId)?.weight ?? 0), 0);
}

function finishStow(state: GameState, content: Content, name: string): GameState {
  const run = state.run!;
  const location = content.locations.find((entry) => entry.id === run.locationId);
  const patrolStep = (run.patrolStep ?? 0) + 1;
  const spotted = !!location?.patrolPeriod && patrolStep % location.patrolPeriod === 0;
  return {
    ...state,
    run: { ...run, patrolStep, hiddenAt: spotted ? null : run.hiddenAt, heat: spotted ? addHeat(run.heat, 8) : run.heat, log: [...(run.log ?? []), `贴身收好${name}${spotted ? '，巡逻逼近' : ''}`].slice(-30) },
    notice: spotted ? `已贴身收好${name}，巡逻逼近，风声 +8。` : `已贴身收好${name}。`,
  };
}

export function stowSmallItem(state: GameState, itemId: string, content: Content): GameState {
  const run = state.run;
  if (state.phase !== 'explore' || !run) throw new Error('当前不能收好物品');
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item || item.weight > 1) throw new Error('只有轻小物品能贴身收好');
  const already = run.pocketItems?.[itemId] ?? 0;
  const available = (run.inventory[itemId] ?? 0) + (run.loot[itemId] ?? 0);
  if (available <= already + Number(run.wornItemIds?.includes(itemId) ?? false)) throw new Error('没有更多可收好的物品');
  if (pocketWeight(state, content) + item.weight > 2) throw new Error('贴身位置已满');
  return finishStow({ ...state, run: { ...run, pocketItems: { ...run.pocketItems, [itemId]: already + 1 } } }, content, item.name);
}

export function stowCopy(state: GameState, copyId: string, content: Content): GameState {
  const run = state.run;
  if (state.phase !== 'explore' || !run) throw new Error('当前不能收好秘籍');
  const copy = content.copies.find((entry) => entry.id === copyId);
  const item = content.items.find((entry) => entry.id === copy?.itemId);
  if (!copy || !item || item.weight > 1) throw new Error('这份书无法贴身收好');
  if (pocketWeight(state, content) + item.weight > 2) throw new Error('贴身位置已满');
  const next = moveCopy(state, copyId, { kind: 'pocket' }, { kind: 'bag' }, content);
  return finishStow(next, content, copy.title);
}
