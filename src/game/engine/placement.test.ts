import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, startRun } from './lifecycle';
import { moveCopy } from './copies';
import { pocketWeight, stowCopy, stowSmallItem } from './placement';

test('贴身位置总容量为二，行囊里的独本只转移不复制', () => {
  const content = loadBundledContent();
  const base = createGame();
  const supplied = { ...base, permanent: { ...base.permanent, stash: { medicine: 2 } } };
  const raid = startRun(supplied, { medicine: 2 }, 0, 1, content);
  const withCopy = moveCopy(raid, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'source' }, content);
  const one = stowSmallItem(withCopy, 'medicine', content);
  const two = stowCopy(one, 'swallow_biaoshi_copy', content);
  expect(pocketWeight(two, content)).toBe(2);
  expect(two.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'pocket' });
  expect(two.run?.pocketItems?.medicine).toBe(1);
  expect(two.run?.patrolStep).toBe(2);
  expect(() => stowSmallItem(two, 'medicine', content)).toThrow(/已满/);
  expect(() => stowCopy(two, 'swallow_biaoshi_copy', content)).toThrow(/已满/);
});

test('贴身收纳占用行动，巡逻逼近时仍收好但暴露位置', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 2, content);
  const ready = { ...raid, run: { ...raid.run!, locationId: 'warehouse', inventory: { medicine: 1 }, hiddenAt: 'warehouse', patrolStep: 2 } };
  const stowed = stowSmallItem(ready, 'medicine', content);
  expect(stowed.run?.patrolStep).toBe(3);
  expect(stowed.run?.heat).toBe(8);
  expect(stowed.run?.hiddenAt).toBeNull();
  expect(stowed.run?.pocketItems?.medicine).toBe(1);
});
