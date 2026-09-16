import type { Content, Counts, ItemDefinition, RunState } from '../model';

type WeighedItem = Pick<ItemDefinition, 'id' | 'weight'>;

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

export function runWeight(run: RunState, content: Content): number {
  const combined = { ...run.inventory };
  for (const [id, count] of Object.entries(run.loot)) combined[id] = (combined[id] ?? 0) + count;
  return totalWeight(combined, content.items);
}

export function dropOrdinaryLoot(run: RunState, itemId: string, content: Content): RunState {
  const item = content.items.find((entry) => entry.id === itemId);
  if (!item || item.kind !== 'loot' || (run.loot[itemId] ?? 0) < 1) throw new Error('该物资不可丢弃');
  const loot = { ...run.loot, [itemId]: run.loot[itemId] - 1 };
  if (loot[itemId] === 0) delete loot[itemId];
  return { ...run, loot };
}
