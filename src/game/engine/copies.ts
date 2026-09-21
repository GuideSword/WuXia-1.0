import { loadBundledContent } from '../content/load';
import type { Content, CopyPosition, GameState } from '../model';
import { BAG_CAPACITY, bagSlots, runWeight } from './inventory';

export function copiesAt(state: GameState, kind: CopyPosition['kind']): string[] {
  return Object.entries(state.permanent.copyPositions).filter(([, position]) => position.kind === kind).map(([id]) => id);
}

export function copyAtSource(state: GameState, copyId: string): boolean {
  return state.permanent.copyPositions[copyId]?.kind === 'source';
}

export function assertCopyRegistry(state: GameState, content: Content): void {
  const ids = new Set(content.copies.map((copy) => copy.id));
  for (const copy of content.copies) {
    const position = state.permanent.copyPositions[copy.id];
    if (!position) throw new Error(`独本缺少去向：${copy.id}`);
    if ((state.permanent.stash[copy.itemId] ?? 0) > 0 || (state.run?.inventory[copy.itemId] ?? 0) > 0 || (state.run?.loot[copy.itemId] ?? 0) > 0) throw new Error(`独本重复存放：${copy.id}`);
    if (['bag', 'pocket'].includes(position.kind) && !state.run) throw new Error(`独本没有探索行囊：${copy.id}`);
    if (position.kind === 'lost' && !content.locations.some((location) => location.id === position.locationId && location.kind === 'danger')) throw new Error(`独本遗落地点无效：${copy.id}`);
  }
  for (const id of Object.keys(state.permanent.copyPositions)) if (!ids.has(id)) throw new Error(`未知独本：${id}`);
}

export function moveCopy(state: GameState, copyId: string, to: CopyPosition, from: CopyPosition, content: Content = loadBundledContent()): GameState {
  if (!content.copies.some((copy) => copy.id === copyId)) throw new Error(`未知独本：${copyId}`);
  const actual = state.permanent.copyPositions[copyId];
  if (actual?.kind !== from.kind || (actual.kind === 'lost' && actual.locationId !== (from.kind === 'lost' ? from.locationId : undefined))) throw new Error('秘籍已不在预期来源');
  if (from.kind === 'lost' && state.run?.locationId !== from.locationId) throw new Error('尚未到达遗落地点');
  if (['bag', 'pocket'].includes(to.kind) && !state.run) throw new Error('当前没有探索行囊');
  if (to.kind === 'lost' && !content.locations.some((location) => location.id === to.locationId && location.kind === 'danger')) throw new Error('遗落地点无效');
  const copyPositions = { ...state.permanent.copyPositions, [copyId]: to };
  if (state.run && runWeight(state.run, content, copyPositions) > 30) throw new Error('负重已达上限');
  if (state.run && to.kind === 'bag' && bagSlots(state.run, content, copyPositions) > BAG_CAPACITY) throw new Error('背包格子已满');
  return { ...state, permanent: { ...state.permanent, copyPositions } };
}
