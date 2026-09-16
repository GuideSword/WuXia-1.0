import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, startRun } from './lifecycle';
import { chooseEvent, getChoices } from './events';

test('仓库战利品只领取一次', () => {
  const content = loadBundledContent();
  const game = startRun(createGame(), {}, 0, 11);
  const atWarehouse = { ...game, run: { ...game.run!, locationId: 'warehouse' } };
  expect(getChoices(atWarehouse, content).map((choice) => choice.id)).toContain('take_silver');
  const next = chooseEvent(atWarehouse, 'take_silver', content);
  expect(next.run?.loot.silver_ledger).toBe(1);
  expect(getChoices(next, content).map((choice) => choice.id)).not.toContain('take_silver');
  expect(() => chooseEvent(next, 'take_silver', content)).toThrow(/不可用/);
});

test('不能从远处强行搜仓库', () => {
  const content = loadBundledContent();
  const atFoothill = startRun(createGame(), {}, 0, 11);
  expect(() => chooseEvent(atFoothill, 'take_silver', content)).toThrow(/不可用/);
});
