import type { Content, Id, Location } from '../model';
import { contentSchema } from './schema';
import locations from './locations.json';
import events from './events.json';
import npcs from './npcs.json';
import arts from './martial-arts.json';
import items from './items.json';
import rumors from './rumors.json';
import copies from './copies.json';

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
  const byArt = new Set(content.arts.map((art) => art.id));
  const artTags = new Set(content.arts.flatMap((art) => art.tags));
  const byInsight = new Set(content.copies.map((copy) => copy.insightId).filter((id): id is string => !!id));
  const initialManualsByLocation = new Set<Id>();
  const uniqueCopyItems = new Set<Id>();

  for (const location of content.locations) {
    for (const next of location.next) {
      if (!byLocation.has(next)) throw new Error(`locations.${location.id}.next 引用了不存在的地点 ${next}`);
      if (byLocation.get(next)?.kind !== location.kind) throw new Error(`locations.${location.id}.next 不可跨安全与危险区域`);
      if (location.kind === 'danger' && byLocation.get(next)?.regionId !== location.regionId) throw new Error(`locations.${location.id}.next 不可跨探索地图`);
    }
  }
  for (const required of ['town_square', 'foothill', 'gate']) {
    if (!byLocation.has(required)) throw new Error(`缺少初始地点 ${required}`);
  }
  if (!reachable('foothill', byLocation).has('gate')) throw new Error('黑风寨山脚无法抵达山门');
  for (const location of content.locations) {
    if (location.kind === 'danger' && !location.regionId) throw new Error(`地点缺少探索地图：${location.id}`);
    const root = location.kind === 'safe' ? 'town_square' : location.regionId === 'qingyan' ? 'qingyan_gate' : 'foothill';
    if (!reachable(root, byLocation).has(location.id)) throw new Error(`地点不可达：${location.id}`);
  }
  for (const copy of content.copies) {
    if (!byItem.has(copy.itemId)) throw new Error(`copies.${copy.id}.itemId 不存在：${copy.itemId}`);
    if (uniqueCopyItems.has(copy.itemId)) throw new Error(`独本物品重复：${copy.itemId}`);
    uniqueCopyItems.add(copy.itemId);
    if (!byLocation.has(copy.sourceLocationId)) throw new Error(`copies.${copy.id}.sourceLocationId 不存在：${copy.sourceLocationId}`);
    if (copy.artId && !byArt.has(copy.artId)) throw new Error(`copies.${copy.id}.artId 不存在：${copy.artId}`);
    if (!!copy.artId !== !!copy.insightId) throw new Error(`copies.${copy.id} 武学与见解必须同时存在`);
    if (copy.artId) {
      if (initialManualsByLocation.has(copy.sourceLocationId)) throw new Error(`同一地点有多份秘籍：${copy.sourceLocationId}`);
      initialManualsByLocation.add(copy.sourceLocationId);
    }
    const source = byLocation.get(copy.sourceLocationId)!;
    if (source.kind === 'safe' && (!content.npcs.some((npc) => npc.locationId === source.id && npc.itemsSold?.includes(copy.itemId)) || content.items.find((item) => item.id === copy.itemId)?.buyPrice === undefined)) throw new Error(`copies.${copy.id} 无法从镇中来源取得`);
    if (source.kind === 'danger' && !content.events.some((event) => event.locationId === source.id && event.choices.some((choice) => choice.effects.some((effect) => effect.type === 'takeCopy' && effect.value === copy.id)))) throw new Error(`copies.${copy.id} 无法从探索地点取得`);
  }
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
    for (const choice of event.choices) {
      for (const condition of choice.conditions) {
        if (condition.type === 'hasItem' && !byItem.has(condition.value)) throw new Error(`${choice.id} 引用了不存在的物品 ${condition.value}`);
        if (condition.type === 'hasRumor' && !byRumor.has(condition.value)) throw new Error(`${choice.id} 引用了不存在的情报 ${condition.value}`);
        if (condition.type === 'hasArtTag' && !artTags.has(condition.value)) throw new Error(`${choice.id} 引用了不存在的武学标签 ${condition.value}`);
        if (condition.type === 'hasInsight' && !byInsight.has(condition.value)) throw new Error(`${choice.id} 引用了不存在的见解 ${condition.value}`);
      }
      for (const effect of choice.effects) {
        const value = String(effect.value);
        if (['addItem', 'takeItem', 'addLoot'].includes(effect.type) && !byItem.has(value)) throw new Error(`${choice.id} 引用了不存在的物品 ${value}`);
        if (['addRumor', 'confirmRumor'].includes(effect.type) && !byRumor.has(value)) throw new Error(`${choice.id} 引用了不存在的情报 ${value}`);
        if (effect.type === 'startBattle' && !byNpc.has(value)) throw new Error(`${choice.id} 引用了不存在的人物 ${value}`);
        if (effect.type === 'move' && !byLocation.has(value)) throw new Error(`${choice.id} 引用了不存在的地点 ${value}`);
        if (effect.type === 'takeCopy') {
          const copy = content.copies.find((entry) => entry.id === value);
          if (!copy) throw new Error(`${choice.id} 引用了不存在的独本 ${value}`);
          if (copy.sourceLocationId !== event.locationId) throw new Error(`${choice.id} 独本来源地点不一致`);
        }
      }
    }
  }
  return content;
}

export function findConsumers(content: Content, id: Id): string[] {
  const npc = content.npcs.find((entry) => entry.id === id);
  if (npc) return [
    ...content.events.filter((event) => event.npcId === id).map((event) => event.id),
    ...(npc.itemsSold?.length || npc.rumorsOffered?.length ? [`service:${npc.locationId}`] : []),
  ];
  const art = content.arts.find((entry) => entry.id === id);
  if (art) return art.id === 'basic_sword' ? ['starting-art', 'combat-technique'] : [
    ...content.copies.filter((copy) => copy.artId === id).map((copy) => `study:${copy.id}`),
    ...content.events.flatMap((event) => event.choices.filter((choice) => choice.effects.some((effect) => effect.type === 'addLoot' && effect.value === art.manualItemId)).map((choice) => choice.id)),
    ...content.npcs.filter((entry) => entry.itemsSold?.includes(art.manualItemId ?? '')).map((entry) => `shop:${entry.id}`),
  ];
  const rumor = content.rumors.find((entry) => entry.id === id);
  if (rumor) return [
    ...content.npcs.filter((entry) => entry.rumorsOffered?.includes(id)).map((entry) => `rumor:${entry.id}`),
    ...content.events.flatMap((event) => event.choices.filter((choice) => choice.effects.some((effect) => ['addRumor', 'confirmRumor'].includes(effect.type) && effect.value === id)).map((choice) => choice.id)),
  ];
  const item = content.items.find((entry) => entry.id === id);
  if (item) return [
    ...(['blood_blade_page', 'tunnel_map'].includes(id) ? ['legacy-save-migration'] : []),
    ...content.copies.filter((entry) => entry.itemId === id).map((entry) => `copy:${entry.sourceLocationId}`),
    ...content.npcs.filter((entry) => entry.itemsSold?.includes(id)).map((entry) => `shop:${entry.id}`),
    ...content.events.flatMap((event) => event.choices.filter((choice) => choice.effects.some((effect) => ['addItem', 'takeItem', 'addLoot'].includes(effect.type) && effect.value === id) || choice.conditions.some((condition) => condition.type === 'hasItem' && condition.value === id)).map((choice) => choice.id)),
    ...content.arts.filter((entry) => entry.manualItemId === id).map((entry) => `learn:${entry.id}`),
  ];
  return [];
}

export function loadBundledContent(): Content {
  return loadContent({ locations, events, npcs, arts, items, rumors, copies });
}
