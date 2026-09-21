import { expect, test } from 'vitest';
import { createGame, failRun, returnToTown, settleExtraction, startRun } from './engine/lifecycle';
import { advanceTutorial, getTutorialStep, skipTutorial } from './onboarding';
import { moveCopy } from './engine/copies';

test('首局指引从茶馆推进到整备，并在失败后保持可重试', () => {
  const fresh = createGame();
  expect(getTutorialStep(fresh)?.actionId).toBe('rumors');
  const heard = { ...fresh, phase: 'rumors' as const, permanent: { ...fresh.permanent, heardRumors: ['western_scripture'] } };
  expect(getTutorialStep(heard)?.actionId).toBe('track:western_scripture');
  const prep = { ...heard, phase: 'prep' as const, selectedRumorId: 'western_scripture' };
  expect(getTutorialStep(prep)?.actionId).toBe('start');
  const started = advanceTutorial(prep, startRun(prep, {}, 0, 1));
  expect(getTutorialStep(started)?.actionId).toBe('go:gate');
  const failed = advanceTutorial(started, failRun(started));
  expect(getTutorialStep(failed)?.actionId).toBe('return');
  expect(getTutorialStep(advanceTutorial(failed, returnToTown(failed)))?.actionId).toBe('prep');
});

test('首局完成后只在本次结算显示完成提示，后续对局不再出现', () => {
  const fresh = createGame();
  const started = advanceTutorial(fresh, startRun(fresh, {}, 0, 1));
  const withPage = { ...started, run: { ...started.run!, locationId: 'gate', flags: [...started.run!.flags, 'blood_page_taken'], loot: { blood_blade_page: 1 } } };
  const won = advanceTutorial(withPage, settleExtraction(withPage, 'gate'));
  expect(getTutorialStep(won)?.title).toBe('首局完成');
  const town = advanceTutorial(won, returnToTown(won));
  expect(getTutorialStep(town)).toBeNull();
  expect(getTutorialStep(startRun(town, {}, 0, 2))).toBeNull();
});

test('提前撤离会继续指导下一局', () => {
  const fresh = createGame();
  const started = advanceTutorial(fresh, startRun(fresh, {}, 0, 1));
  const atGate = { ...started, run: { ...started.run!, locationId: 'gate' } };
  const earlyExit = advanceTutorial(atGate, settleExtraction(atGate, 'gate'));
  expect(getTutorialStep(earlyExit)?.title).toBe('成功撤离，继续追查');
  expect(getTutorialStep(advanceTutorial(earlyExit, returnToTown(earlyExit)))).not.toBeNull();
});

test('跳过指引后刷新存档也不会重新显示', () => {
  const skipped = skipTutorial(createGame());
  expect(getTutorialStep(skipped)).toBeNull();
  expect(getTutorialStep(advanceTutorial(skipped, startRun(skipped, {}, 0, 1)))).toBeNull();
});

test('失手后指引遗落独本的真实地点，重访时提示找回', () => {
  const base = createGame();
  const raid = advanceTutorial(base, startRun(base, {}, 0, 4));
  const taken = moveCopy(raid, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'source' });
  const atWarehouse = { ...taken, run: { ...taken.run!, locationId: 'warehouse' } };
  const lost = advanceTutorial(atWarehouse, failRun(atWarehouse));
  expect(getTutorialStep(lost)?.instruction).toContain('西仓');
  const revisit = startRun(returnToTown(lost), {}, 0, 5);
  const atLoss = { ...revisit, run: { ...revisit.run!, locationId: 'warehouse' } };
  expect(getTutorialStep(atLoss)?.actionId).toBe('recover:swallow_biaoshi_copy');
});
