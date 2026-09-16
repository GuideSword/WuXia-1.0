import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, extract, failRun, startRun } from './lifecycle';
import { canCarry, totalWeight } from './inventory';

test('超出 30 重量不能整备出发', () => {
  const items = [{ id: 'sword', weight: 6 }];
  expect(totalWeight({ sword: 5 }, items)).toBe(30);
  expect(canCarry({ sword: 6 }, items, 30)).toBe(false);
});

test('官银包撤离后变现，失败时丢失', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 13);
  const withLoot = { ...raid, run: { ...raid.run!, locationId: 'gate', loot: { silver_ledger: 1 } } };
  expect(extract(withLoot, 'gate', content).permanent.coins).toBe(2500);
  expect(failRun(withLoot).permanent.coins).toBe(500);
});

test('旧仓库物品不受本局失败影响', () => {
  const game = createGame();
  game.permanent.stash.old_token = 1;
  const raid = startRun(game, {}, 0, 13);
  const withLoot = { ...raid, run: { ...raid.run!, loot: { silver_ledger: 1 } } };
  const end = failRun(withLoot);
  expect(end.permanent.stash.old_token).toBe(1);
  expect(end.permanent.stash.silver_ledger).toBeUndefined();
});
