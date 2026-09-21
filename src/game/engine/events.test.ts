import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, returnToTown, settleExtraction, startRun } from './lifecycle';
import { chooseEvent, getChoices, getSceneText } from './events';
import { actionResults } from '../content/action-results';

test('所有编写的场景选择都有行动后叙事', () => {
  const content = loadBundledContent();
  const choiceIds = content.events.flatMap((event) => event.choices.map((choice) => choice.id));
  expect(choiceIds.filter((id) => !actionResults[id])).toEqual([]);
});

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

test('事件选择产生可回看的叙事和实际变化', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 11, content);
  const atWarehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse' } };
  const taken = chooseEvent(atWarehouse, 'take_silver', content);
  expect(taken.notice).toContain('你掀开布，抱起沉甸甸的官银包');
  expect(taken.notice).toContain('风声 +18');
  expect(taken.notice).toContain('负重 +15');
  expect(taken.notice).toContain('获得官银包 ×1');
  expect(taken.run?.log).toContain('带走官银包');
  expect(taken.run?.log).toContain('你掀开布，抱起沉甸甸的官银包。门外的脚步一顿，随即又远去。');
});

test('移动和警戒阶段变化也给出行动后的文字', () => {
  const content = loadBundledContent();
  const started = startRun(createGame(), {}, 0, 11, content);
  const atGate = chooseEvent(started, 'go:gate', content);
  expect(atGate.notice).toContain('你来到黑风寨山门');
  const atWarehouse = { ...atGate, run: { ...atGate.run!, locationId: 'warehouse', heat: 40 } };
  const taken = chooseEvent(atWarehouse, 'take_silver', content);
  expect(taken.notice).toContain('风声 +18');
  expect(taken.notice).toContain('风声升至');
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
  expect(withPage.permanent.copyPositions.blood_page_copy).toEqual({ kind: 'bag' });
  expect(withPage.run?.heat).toBe(30);
  expect(getChoices(withPage, content).map((choice) => choice.id)).toContain('enter_chief_secret');
  const secret = chooseEvent(withPage, 'enter_chief_secret', content);
  const clue = chooseEvent(secret, 'find_heir_location', content);
  expect(clue.run?.heat).toBeGreaterThanOrEqual(75);
  expect(clue.permanent.confirmedRumors).toContain('heir_location');
});

test('带回独本后原来源空缺，下一局不能再取得', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 24, content);
  const atWarehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse' } };
  const taken = chooseEvent(atWarehouse, 'take_swallow_manual', content);
  expect(taken.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
  expect(getChoices(taken, content).map((choice) => choice.id)).not.toContain('take_swallow_manual');
  const home = settleExtraction({ ...taken, run: { ...taken.run!, locationId: 'gate' } }, 'gate', content);
  expect(home.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'home' });
  const revisit = startRun(returnToTown(home), {}, 0, 25, content);
  const again = { ...revisit, run: { ...revisit.run!, locationId: 'warehouse' } };
  expect(getChoices(again, content).map((choice) => choice.id)).not.toContain('take_swallow_manual');
  expect(getSceneText(again, content)).toContain('原先存放的地方已经空了');
});

test('已带走的血刀残页不重刷，密室入口仍可抵达', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 26, content);
  const ready = { ...raid, run: { ...raid.run!, locationId: 'second_chief_room', flags: ['second_chief_defeated', 'second_chief_schedule'] } };
  const taken = chooseEvent(ready, 'take_blood_page', content);
  const home = settleExtraction({ ...taken, run: { ...taken.run!, locationId: 'gate' } }, 'gate', content);
  const revisit = startRun(returnToTown(home), {}, 0, 27, content);
  const atRoom = { ...revisit, run: { ...revisit.run!, locationId: 'second_chief_room', flags: ['second_chief_defeated'] } };
  const ids = getChoices(atRoom, content).map((choice) => choice.id);
  expect(ids).not.toContain('take_blood_page');
  expect(ids).toContain('go:chief_secret');
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

test('走水人见解在水道提供一次低声吐纳行动', () => {
  const content = loadBundledContent();
  const base = createGame();
  const raid = startRun({ ...base, permanent: { ...base.permanent, learnedInsights: ['insight_breath_boatman'] } }, {}, 0, 31, content);
  const water = { ...raid, run: { ...raid.run!, locationId: 'waterway', heat: 20 } };
  expect(getChoices(water, content).map((choice) => choice.id)).toContain('boatman_breath');
  const used = chooseEvent(water, 'boatman_breath', content);
  expect(used.run?.heat).toBe(12);
  expect(getChoices(used, content).map((choice) => choice.id)).not.toContain('boatman_breath');
});

test('囚犯获救后不在下次探索重新出现，密道图仍可单独取走', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 32, content);
  const cell = { ...raid, run: { ...raid.run!, locationId: 'prisoner_cell' } };
  const freed = chooseEvent(cell, 'help_prisoner', content);
  expect(freed.permanent.flags).toContain('prisoner_freed');
  expect(getChoices(freed, content).map((choice) => choice.id)).toContain('take_tunnel_map');
  const home = settleExtraction({ ...freed, run: { ...freed.run!, locationId: 'gate' } }, 'gate', content);
  const again = startRun(returnToTown(home), {}, 0, 33, content);
  const againCell = { ...again, run: { ...again.run!, locationId: 'prisoner_cell' } };
  expect(getChoices(againCell, content).map((choice) => choice.id)).not.toContain('help_prisoner');
  expect(getSceneText(againCell, content)).toContain('铁栅已空');
});
