import { describe, expect, it } from 'vitest';
import { loadContent } from './load';
import locations from './locations.json';
import events from './events.json';
import npcs from './npcs.json';
import arts from './martial-arts.json';
import items from './items.json';
import rumors from './rumors.json';

const raw = { locations, events, npcs, arts, items, rumors };

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
});
