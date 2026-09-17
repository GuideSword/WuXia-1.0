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

test('得血刀残页后可选择收手或追查密室', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 41);
  const before = { ...raid, run: { ...raid.run!, locationId: 'second_chief_room', flags: ['second_chief_defeated', 'second_chief_schedule'] } };
  const withPage = chooseEvent(before, 'take_blood_page', content);
  expect(withPage.run?.loot.blood_blade_page).toBe(1);
  expect(withPage.run?.heat).toBe(30);
  expect(getChoices(withPage, content).map((choice) => choice.id)).toContain('enter_chief_secret');
  const secret = chooseEvent(withPage, 'enter_chief_secret', content);
  const clue = chooseEvent(secret, 'find_heir_location', content);
  expect(clue.run?.heat).toBeGreaterThanOrEqual(75);
  expect(clue.permanent.confirmedRumors).toContain('heir_location');
});

test('没有独行线索不能直接挑战二当家', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 41);
  const atRoom = { ...raid, run: { ...raid.run!, locationId: 'second_chief_room' } };
  expect(getChoices(atRoom, content).map((choice) => choice.id)).not.toContain('challenge_second_chief');
});

test('习得点穴和轻功后出现对应潜入动作', () => {
  const content = loadBundledContent();
  const base = createGame();
  const atWarehouse = startRun({ ...base, permanent: { ...base.permanent, learnedArts: ['basic_sword', 'acupoint', 'swallow_step'] } }, {}, 0, 13, content);
  const game = { ...atWarehouse, run: { ...atWarehouse.run!, locationId: 'warehouse' } };
  const ids = getChoices(game, content).map((choice) => choice.id);
  expect(ids).toContain('silent_subdue_guard');
  expect(ids).toContain('climb_warehouse_beam');
  const untrained = startRun(createGame(), {}, 0, 13, content);
  const idsBefore = getChoices({ ...untrained, run: { ...untrained.run!, locationId: 'warehouse' } }, content).map((choice) => choice.id);
  expect(idsBefore).not.toContain('silent_subdue_guard');
});

test('所选行动写入本局日志，可供刷新后查看', () => {
  const content = loadBundledContent();
  const started = startRun(createGame(), {}, 0, 4, content);
  const acted = chooseEvent(started, 'pass_silently', content);
  expect(acted.run?.log).toContain('静默通过巡逻');
});

test('被认出的招式会让山门提前出现盘查动作', () => {
  const content = loadBundledContent();
  const base = createGame();
  const known = startRun({ ...base, permanent: { ...base.permanent, flags: ['witnessed_style:wild_blade'] } }, {}, 0, 7, content);
  const atGate = { ...known, run: { ...known.run!, locationId: 'gate', heat: 40 } };
  expect(getChoices(atGate, content).map((choice) => choice.id)).toContain('pass_gate_check');
  const ordinary = startRun(createGame(), {}, 0, 7, content);
  expect(getChoices({ ...ordinary, run: { ...ordinary.run!, locationId: 'gate', heat: 40 } }, content).map((choice) => choice.id)).not.toContain('pass_gate_check');
});
