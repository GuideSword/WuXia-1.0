import { expect, test } from 'vitest';
import { findConsumers, loadBundledContent } from './load';

test('内容达到下限且每个条目进入玩法', () => {
  const content = loadBundledContent();
  expect(content.npcs.length).toBeGreaterThanOrEqual(10);
  expect(content.arts.length).toBeGreaterThanOrEqual(6);
  expect(content.rumors.length).toBeGreaterThanOrEqual(20);
  expect(content.items.length).toBeGreaterThanOrEqual(10);
  for (const entry of [...content.npcs, ...content.arts, ...content.rumors, ...content.items]) {
    expect(findConsumers(content, entry.id).length, entry.id).toBeGreaterThan(0);
  }
});
