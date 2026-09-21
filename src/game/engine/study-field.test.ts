import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, moveTo, startRun } from './lifecycle';
import { moveCopy } from './copies';
import { fieldStudyReason, hideAt, leaveHiding, studyInField } from './study';

function warehouseRaid() {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 31, content);
  const atWarehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse' } };
  return { content, withBook: moveCopy(atWarehouse, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'source' }, content) };
}

test('探索中先藏身、风声小于50且有光源和练习空间才可研读', () => {
  const { content, withBook } = warehouseRaid();
  expect(fieldStudyReason(withBook, 'swallow_biaoshi_copy', content)).toMatch(/藏身/);
  const hidden = hideAt(withBook, content);
  expect(leaveHiding(hidden).run?.hiddenAt).toBeNull();
  expect(fieldStudyReason(hidden, 'swallow_biaoshi_copy', content)).toMatch(/光线/);
  const withLight = { ...hidden, run: { ...hidden.run!, inventory: { lantern: 1 } } };
  expect(fieldStudyReason(withLight, 'swallow_biaoshi_copy', content)).toBeNull();
  const learned = studyInField(withLight, 'swallow_biaoshi_copy', content);
  expect(learned.permanent.learnedArts).toContain('swallow_step');
  expect(learned.permanent.learnedInsights).toContain('insight_borrow_wall');
  expect(learned.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
  expect(fieldStudyReason({ ...withLight, run: { ...withLight.run!, heat: 50 } }, 'swallow_biaoshi_copy', content)).toMatch(/风声/);
  expect(moveTo({ ...withLight, run: { ...withLight.run!, locationId: 'gate' } }, 'warehouse', content).run?.hiddenAt).toBeNull();
});

test('巡逻打断研读时保留书，不获得武学，进度可存档', () => {
  const { content, withBook } = warehouseRaid();
  const hidden = hideAt(withBook, content);
  const before = { ...hidden, run: { ...hidden.run!, inventory: { lantern: 1 }, patrolStep: 2 } };
  const after = studyInField(before, 'swallow_biaoshi_copy', content);
  expect(after.permanent.learnedArts).not.toContain('swallow_step');
  expect(after.run?.patrolStep).toBe(3);
  expect(after.run?.heat).toBe(8);
  expect(after.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
});
