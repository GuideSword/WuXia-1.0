import type { Content, Id, Location } from '../model';
import { contentSchema } from './schema';
import locations from './locations.json';
import events from './events.json';
import npcs from './npcs.json';
import arts from './martial-arts.json';
import items from './items.json';
import rumors from './rumors.json';

function assertUnique(kind: string, entries: { id: Id }[]): void {
  const seen = new Set<Id>();
  for (const entry of entries) {
    if (seen.has(entry.id)) throw new Error(`${kind} 重复 ID: ${entry.id}`);
    seen.add(entry.id);
  }
}

function reachable(start: Id, locationsById: Map<Id, Location>): Set<Id> {
  const found = new Set<Id>();
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (found.has(id)) continue;
    found.add(id);
    for (const next of locationsById.get(id)?.next ?? []) queue.push(next);
  }
  return found;
}

export function loadContent(raw: unknown): Content {
  const parsed = contentSchema.parse(raw);
  for (const [kind, entries] of Object.entries(parsed)) assertUnique(kind, entries);
  const content: Content = parsed;
  const byLocation = new Map(content.locations.map((location) => [location.id, location]));
  const byItem = new Set(content.items.map((item) => item.id));
  const byNpc = new Set(content.npcs.map((npc) => npc.id));
  const byRumor = new Set(content.rumors.map((rumor) => rumor.id));

  for (const location of content.locations) {
    for (const next of location.next) {
      if (!byLocation.has(next)) throw new Error(`locations.${location.id}.next 引用了不存在的地点 ${next}`);
      if (byLocation.get(next)?.kind !== location.kind) throw new Error(`locations.${location.id}.next 不可跨安全与危险区域`);
    }
  }
  for (const required of ['town_square', 'foothill', 'gate']) {
    if (!byLocation.has(required)) throw new Error(`缺少初始地点 ${required}`);
  }
  if (!reachable('foothill', byLocation).has('gate')) throw new Error('黑风寨山脚无法抵达山门');
  for (const npc of content.npcs) {
    if (!byLocation.has(npc.locationId)) throw new Error(`npcs.${npc.id}.locationId 不存在: ${npc.locationId}`);
    for (const sold of npc.itemsSold ?? []) if (!byItem.has(sold)) throw new Error(`npcs.${npc.id}.itemsSold 不存在: ${sold}`);
    for (const rumor of npc.rumorsOffered ?? []) if (!byRumor.has(rumor)) throw new Error(`npcs.${npc.id}.rumorsOffered 不存在: ${rumor}`);
  }
  for (const art of content.arts) {
    if (art.manualItemId && !byItem.has(art.manualItemId)) throw new Error(`arts.${art.id}.manualItemId 不存在: ${art.manualItemId}`);
  }
  for (const rumor of content.rumors) {
    if (!byLocation.has(rumor.targetLocation)) throw new Error(`rumors.${rumor.id}.targetLocation 不存在: ${rumor.targetLocation}`);
  }
  for (const event of content.events) {
    if (!byLocation.has(event.locationId)) throw new Error(`events.${event.id}.locationId 不存在: ${event.locationId}`);
    if (event.npcId && !byNpc.has(event.npcId)) throw new Error(`events.${event.id}.npcId 不存在: ${event.npcId}`);
    if (event.rumorId && !byRumor.has(event.rumorId)) throw new Error(`events.${event.id}.rumorId 不存在: ${event.rumorId}`);
    assertUnique(`events.${event.id}.choices`, event.choices);
  }
  return content;
}

export function loadBundledContent(): Content {
  return loadContent({ locations, events, npcs, arts, items, rumors });
}
