import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, startRun } from './lifecycle';
import { assertCopyRegistry, copiesAt, moveCopy } from './copies';

test('独本在世界中只有一个位置，取走后来源耗尽', () => {
  const base = createGame();
  expect(copiesAt(base, 'source')).toContain('swallow_biaoshi_copy');
  const raid = startRun(base, {}, 0, 12, loadBundledContent());
  const warehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse' } };
  const taken = moveCopy(warehouse, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'source' });
  expect(taken.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
  expect(copiesAt(taken, 'source')).not.toContain('swallow_biaoshi_copy');
  expect(() => moveCopy(taken, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'source' })).toThrow(/来源/);
  expect(() => assertCopyRegistry(taken, loadBundledContent())).not.toThrow();
});

test('遗落的独本只能在实际遗落地点找回', () => {
  const raid = startRun(createGame(), {}, 0, 13, loadBundledContent());
  const withLost = { ...raid, permanent: { ...raid.permanent, copyPositions: { ...raid.permanent.copyPositions, swallow_biaoshi_copy: { kind: 'lost' as const, locationId: 'warehouse' } } } };
  expect(() => moveCopy(withLost, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'lost', locationId: 'warehouse' })).toThrow(/地点/);
  const atWarehouse = { ...withLost, run: { ...withLost.run!, locationId: 'warehouse' } };
  expect(moveCopy(atWarehouse, 'swallow_biaoshi_copy', { kind: 'bag' }, { kind: 'lost', locationId: 'warehouse' }).permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
});
