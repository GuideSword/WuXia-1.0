import { describe, expect, it } from 'vitest';
import { loadContent } from './load';
import locations from './locations.json';
import events from './events.json';
import npcs from './npcs.json';
import arts from './martial-arts.json';
import items from './items.json';
import rumors from './rumors.json';
import copies from './copies.json';

const raw = { locations, events, npcs, arts, items, rumors, copies };

describe('内容合同', () => {
  it('首批地点从山脚可达山门', () => {
    const content = loadContent(raw);
    expect(content.locations.find((location) => location.id === 'foothill')?.next).toContain('gate');
  });

  it('拒绝不存在的地点引用', () => {
    expect(() =>
      loadContent({
        ...raw,
        locations: [
          { id: 'town_square', name: '青石镇', next: [], kind: 'safe', description: '安全区' },
          { id: 'foothill', name: '山脚', next: ['missing'], kind: 'danger', description: '危险区' },
        ],
      }),
    ).toThrow(/missing/);
  });

  it('独本有固定出处与见解，不能复制或同处堆叠', () => {
    const content = loadContent(raw);
    const swallow = content.copies.filter((copy) => copy.artId === 'swallow_step');
    expect(swallow.map((copy) => copy.insightId)).toEqual(['insight_borrow_wall', 'insight_soft_landing']);
    expect(() => loadContent({ ...raw, copies: [...copies, copies[0]] })).toThrow(/重复/);
    expect(() => loadContent({ ...raw, copies: [...copies, { ...copies[1], id: 'another_original', itemId: 'swallow_manual', insightId: 'another_insight', sourceLocationId: 'warehouse' }] })).toThrow(/同一地点/);
    expect(() => loadContent({ ...raw, copies: [...copies, { ...copies[1], id: 'missing_source', itemId: 'swallow_manual', insightId: 'missing_insight', sourceLocationId: 'nowhere' }] })).toThrow(/nowhere/);
    expect(() => loadContent({ ...raw, copies: [...copies, { ...copies[1], id: 'same_item', insightId: 'another_insight' }] })).toThrow(/物品重复/);
    const reprint = { ...copies[0], id: 'swallow_reprint', itemId: 'swallow_reprint_item', sourceLocationId: 'clinic' };
    const clinicSellsReprint = npcs.map((npc) => npc.id === 'physician' ? { ...npc, itemsSold: [...(npc.itemsSold ?? []), 'swallow_reprint_item'] } : npc);
    expect(loadContent({ ...raw, npcs: clinicSellsReprint, items: [...items, { id: 'swallow_reprint_item', name: '翻印本', weight: 1, kind: 'manual', buyPrice: 10 }], copies: [...copies, reprint] }).copies.at(-1)?.insightId).toBe('insight_borrow_wall');
  });

  it('青燕门旧址是独立地图，不能与黑风寨直接相连', () => {
    const content = loadContent(raw);
    expect(content.locations.find((location) => location.id === 'qingyan_hall')?.regionId).toBe('qingyan');
    const crossed = locations.map((location) => location.id === 'gate' ? { ...location, next: [...location.next, 'qingyan_gate'] } : location);
    expect(() => loadContent({ ...raw, locations: crossed })).toThrow(/跨探索地图/);
  });

  it('黑风寨只有一份完整武学手抄本，各门武学仍有固定来源', () => {
    const content = loadContent(raw);
    expect(content.copies.filter((copy) => copy.artId && content.locations.find((location) => location.id === copy.sourceLocationId)?.regionId === 'blackwind').map((copy) => copy.id)).toEqual(['swallow_biaoshi_copy']);
    expect(content.copies.filter((copy) => copy.artId).map((copy) => copy.artId)).toEqual(expect.arrayContaining(['wild_blade', 'taiji_sword', 'swallow_step', 'turtle_breath', 'acupoint']));
    expect(content.events.flatMap((event) => event.choices.map((choice) => choice.id))).not.toEqual(expect.arrayContaining(['take_breath_manual', 'take_acupoint_manual', 'take_taiji_manual']));
  });
});
