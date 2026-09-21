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

test('镇中手抄本每份只能转手一次，侠士与过客有各自条件', () => {
  const content = loadBundledContent();
  const base = createGame();
  const yard = { ...base, safeLocationId: 'training_yard' };
  const bought = buyItem(yard, 'trainer', 'wild_trainer_copy', content);
  expect(bought.permanent.copyPositions.wild_trainer_copy).toEqual({ kind: 'home' });
  expect(() => buyItem(bought, 'trainer', 'wild_trainer_copy', content)).toThrow(/易主/);
  const inn = { ...base, safeLocationId: 'inn' };
  expect(() => buyItem(inn, 'rescued_prisoner', 'acupoint_prisoner_copy', content)).toThrow(/救出/);
  const thanked = { ...inn, permanent: { ...inn.permanent, relations: { prisoner: 1 } } };
  const gifted = buyItem(thanked, 'rescued_prisoner', 'acupoint_prisoner_copy', content);
  expect(gifted.permanent.coins).toBe(500);
  expect(gifted.permanent.copyPositions.acupoint_prisoner_copy).toEqual({ kind: 'home' });
  const tea = { ...base, safeLocationId: 'teahouse' };
  expect(() => buyItem(tea, 'tea_visitor', 'taiji_visitor_copy', content)).toThrow(/探得/);
});
