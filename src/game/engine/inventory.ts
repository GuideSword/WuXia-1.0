import type { Content, CopyPosition, Counts, ItemDefinition, RunState } from '../model';

type WeighedItem = Pick<ItemDefinition, 'id' | 'weight'>;
export const BAG_CAPACITY = 12;

export function itemSlots(item: ItemDefinition): number {
  return item.slots ?? 1;
}

export function totalWeight(counts: Counts, items: WeighedItem[]): number {
  const byId = new Map(items.map((item) => [item.id, item.weight]));
  let weight = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(`物品数量无效：${id}`);
    const unit = byId.get(id);
    if (unit === undefined) throw new Error(`未知物品：${id}`);
    weight += unit * count;
  }
  return weight;
}

export function canCarry(counts: Counts, items: WeighedItem[], capacity = 30): boolean {
  return totalWeight(counts, items) <= capacity;
}

export function runWeight(run: RunState, content: Content, copyPositions: Record<string, CopyPosition> = {}): number {
  const combined = { ...run.inventory };
  for (const [id, count] of Object.entries(run.loot)) combined[id] = (combined[id] ?? 0) + count;
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  const copiesById = new Map(content.copies.map((copy) => [copy.id, copy]));
  const uniqueWeight = Object.entries(copyPositions).reduce((sum, [copyId, position]) => {
    if (position.kind !== 'bag' && position.kind !== 'pocket') return sum;
    const copy = copiesById.get(copyId);
    const item = copy && itemById.get(copy.itemId);
    if (!item) throw new Error(`未知独本：${copyId}`);
    return sum + item.weight;
  }, 0);
  return totalWeight(combined, content.items) + uniqueWeight;
}

export function bagSlots(run: RunState, content: Content, copyPositions: Record<string, CopyPosition> = {}): number {
  const itemById = new Map(content.items.map((item) => [item.id, item]));
  let used = 0;
  for (const [id, inventoryCount] of Object.entries(run.inventory)) {
    const item = itemById.get(id);
    if (!item) throw new Error(`未知物品：${id}`);
    const count = inventoryCount + (run.loot[id] ?? 0) - (run.pocketItems?.[id] ?? 0) - Number(run.wornItemIds?.includes(id) ?? false);
    if (count < 0) throw new Error(`行囊物品数量无效：${id}`);
    used += count * itemSlots(item);
  }
  for (const [id, lootCount] of Object.entries(run.loot)) {
    if (id in run.inventory) continue;
    const item = itemById.get(id);
    if (!item) throw new Error(`未知物品：${id}`);
    const count = lootCount - (run.pocketItems?.[id] ?? 0) - Number(run.wornItemIds?.includes(id) ?? false);
    if (count < 0) throw new Error(`行囊物品数量无效：${id}`);
    used += count * itemSlots(item);
  }
  for (const [copyId, position] of Object.entries(copyPositions)) {
    if (position.kind !== 'bag') continue;
    const copy = content.copies.find((entry) => entry.id === copyId);
    const item = copy && itemById.get(copy.itemId);
    if (!item) throw new Error(`未知独本：${copyId}`);
    used += itemSlots(item);
  }
  return used;
}

export function dropOrdinaryLoot(run: RunState, itemId: string, content: Content): RunState {
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item || item.kind !== 'loot' || (run.loot[itemId] ?? 0) < 1) throw new Error('该物资不可丢弃');
  const loot = { ...run.loot, [itemId]: run.loot[itemId] - 1 };
  if (loot[itemId] === 0) delete loot[itemId];
  return { ...run, loot };
}
