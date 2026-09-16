import { expect, test } from 'vitest';
import { hearRumor, confirmRumor } from './rumors';
import { createGame, startRun, failRun } from './lifecycle';

test('付费探听，已知情报不重复扣费', () => {
  const game = createGame();
  const heard = hearRumor(game, 'western_scripture');
  expect(heard.permanent.coins).toBeLessThan(game.permanent.coins);
  expect(hearRumor(heard, 'western_scripture').permanent.coins).toBe(heard.permanent.coins);
});

test('确认过的重要线索在失败后仍保留，未确认本局线索丢失', () => {
  const heard = hearRumor(createGame(), 'western_scripture');
  const raid = startRun(heard, {}, 0, 7);
  const observed = { ...raid, run: { ...raid.run!, flags: ['warehouse_script_seen'], pendingRumors: ['gate_shift'] } };
  const confirmed = confirmRumor(observed, 'western_scripture');
  const lost = failRun(confirmed);
  expect(lost.permanent.confirmedRumors).toContain('western_scripture');
  expect(lost.permanent.confirmedRumors).not.toContain('gate_shift');
});

test('未发现证据不能确认传闻', () => {
  const heard = hearRumor(createGame(), 'western_scripture');
  expect(() => confirmRumor(startRun(heard, {}, 0, 7), 'western_scripture')).toThrow(/证据/);
});
