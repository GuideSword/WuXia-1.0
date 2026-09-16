import { expect, test } from 'vitest';
import { addHeat, canUseGate, heatStage } from './heat';
import { createGame, startRun } from './lifecycle';

test.each([
  [0, 'normal'], [24, 'normal'], [25, 'suspicious'], [49, 'suspicious'],
  [50, 'checked'], [74, 'checked'], [75, 'hunted'], [99, 'hunted'], [100, 'lockdown'],
] as const)('风声 %i 属于 %s', (value, stage) => {
  expect(heatStage(value)).toBe(stage);
});

test('风声限制在 0 到 100', () => {
  expect(addHeat(95, 30)).toBe(100);
  expect(addHeat(2, -9)).toBe(0);
});

test('五十风声后山门必须盘查，封寨时无法直接离开', () => {
  const run = startRun(createGame(), {}, 0, 3).run!;
  expect(canUseGate({ ...run, locationId: 'gate', heat: 49 })).toBe(true);
  expect(canUseGate({ ...run, locationId: 'gate', heat: 50 })).toBe(false);
  expect(canUseGate({ ...run, locationId: 'gate', heat: 58, flags: ['gate_cleared'] })).toBe(true);
  expect(canUseGate({ ...run, locationId: 'gate', heat: 100, flags: ['gate_cleared'] })).toBe(false);
});
