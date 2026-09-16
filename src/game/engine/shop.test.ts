import { expect, test } from 'vitest';
import { buyItem } from './shop';
import { createGame } from './lifecycle';
import { loadBundledContent } from '../content/load';

test('药铺购买金疮药会扣银并入库', () => {
  const content = loadBundledContent();
  const game = { ...createGame(), safeLocationId: 'clinic' };
  const purchased = buyItem(game, 'physician', 'medicine', content);
  expect(purchased.permanent.coins).toBe(475);
  expect(purchased.permanent.stash.medicine).toBe(1);
  expect(() => buyItem(game, 'physician', 'sword', content)).toThrow(/不出售/);
});
