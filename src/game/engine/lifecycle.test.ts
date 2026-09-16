import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, extract, failRun, moveTo, startRun } from './lifecycle';

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
