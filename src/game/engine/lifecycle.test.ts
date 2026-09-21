import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, extract, failRun, moveTo, returnToTown, startRun } from './lifecycle';
import { moveCopy } from './copies';
import { stowCopy, stowSmallItem } from './placement';
import { chooseEvent, getChoices } from './events';

test('成功撤离提交本局银两且不能重复领取', () => {
  const start = startRun(createGame(), {}, 100, 123);
  expect(start.permanent.coins).toBe(400);
  const withLoot = { ...start, run: { ...start.run!, locationId: 'gate', coins: 200 } };
  const end = extract(withLoot, 'gate');
  expect(end.permanent.coins).toBe(600);
  expect(end.lastResult?.coins).toBe(200);
  expect(() => extract(end, 'gate')).toThrow(/本局/);
});

test('失败不提交本局银两', () => {
  const end = failRun(startRun(createGame(), {}, 100, 123));
  expect(end.permanent.coins).toBe(400);
  expect(end.run).toBeNull();
});

test('只能沿相邻地点移动', () => {
  const content = loadBundledContent();
  const atFoothill = startRun(createGame(), {}, 0, 42);
  expect(moveTo(atFoothill, 'gate', content).run?.locationId).toBe('gate');
  expect(() => moveTo(atFoothill, 'chief_secret', content)).toThrow(/不可到达/);
  expect(atFoothill.run?.locationId).toBe('foothill');
});

test('失手救援保留家藏、穿戴和贴身物，行囊独本留在失手地点', () => {
  const content = loadBundledContent();
  const base = createGame();
  const withHome = moveCopy(base, 'swallow_original_copy', { kind: 'home' }, { kind: 'source' }, content);
  const supplied = { ...withHome, permanent: { ...withHome.permanent, stash: { sword: 1, mask: 1, medicine: 1 }, learnedInsights: ['insight_soft_landing'] } };
  const raid = startRun(supplied, { sword: 1, mask: 1, medicine: 1 }, 20, 3, content);
  const withBag = moveCopy(raid, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'source' }, content);
  const withPocket = moveCopy(withBag, 'blood_page_copy', { kind: 'bag' }, { kind: 'source' }, content);
  const stowed = stowCopy(stowSmallItem(withPocket, 'medicine', content), 'blood_page_copy', content);
  const failed = failRun({ ...stowed, run: { ...stowed.run!, locationId: 'warehouse', loot: { silver_ledger: 1 } } });
  expect(failed.permanent.copyPositions.swallow_original_copy).toEqual({ kind: 'home' });
  expect(failed.permanent.copyPositions.blood_page_copy).toEqual({ kind: 'home' });
  expect(failed.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'lost', locationId: 'warehouse' });
  expect(failed.permanent.stash).toMatchObject({ sword: 1, mask: 1, medicine: 1 });
  expect(failed.permanent.learnedInsights).toContain('insight_soft_landing');
  expect(failed.lastResult?.lost).toMatchObject({ swallow_biaoshi_copy: 1, silver_ledger: 1 });
  expect(failed.lastResult?.kept).toMatchObject({ blood_page_copy: 1, sword: 1, mask: 1, medicine: 1 });
  const revisit = startRun(returnToTown(failed), {}, 0, 4, content);
  const atLoss = { ...revisit, run: { ...revisit.run!, locationId: 'warehouse' } };
  expect(getChoices(atLoss, content).map((choice) => choice.id)).toContain('recover:swallow_biaoshi_copy');
  expect(chooseEvent(atLoss, 'recover:swallow_biaoshi_copy', content).permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
});

test('青燕门要先完成一次黑风寨探索并听闻旧址，之后可从旧山门撤离', () => {
  const content = loadBundledContent();
  expect(() => startRun(createGame(), {}, 0, 1, content, 'qingyan')).toThrow(/尚未探得/);
  const first = failRun(startRun(createGame(), {}, 0, 2, content));
  const town = returnToTown(first);
  const heard = { ...town, permanent: { ...town.permanent, heardRumors: ['qingyan_ruins'] } };
  const raid = startRun(heard, {}, 0, 3, content, 'qingyan');
  expect(raid.run?.locationId).toBe('qingyan_gate');
  expect(moveTo(raid, 'qingyan_corridor', content).run?.locationId).toBe('qingyan_corridor');
  expect(() => moveTo(raid, 'gate', content)).toThrow();
});

test('家藏独本可选择带出，没带的始终留家，带出失手则遗落', () => {
  const content = loadBundledContent();
  const base = createGame();
  const one = moveCopy(base, 'swallow_biaoshi_copy', { kind: 'home' }, { kind: 'source' }, content);
  const two = moveCopy(one, 'swallow_original_copy', { kind: 'home' }, { kind: 'source' }, content);
  const raid = startRun(two, {}, 0, 8, content, 'blackwind', ['swallow_biaoshi_copy']);
  expect(raid.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
  expect(raid.permanent.copyPositions.swallow_original_copy).toEqual({ kind: 'home' });
  expect(() => startRun(two, {}, 0, 8, content, 'blackwind', ['swallow_biaoshi_copy', 'swallow_biaoshi_copy'])).toThrow(/重复/);
  const failed = failRun({ ...raid, run: { ...raid.run!, locationId: 'gate' } });
  expect(failed.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'lost', locationId: 'gate' });
  expect(failed.permanent.copyPositions.swallow_original_copy).toEqual({ kind: 'home' });
});
