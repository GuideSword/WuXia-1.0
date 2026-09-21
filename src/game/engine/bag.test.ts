import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame, startRun } from './lifecycle';
import { chooseEvent, getChoices, getSceneText } from './events';
import { bagSlots, runWeight } from './inventory';
import { dropCarriedCopy, dropCarriedItem, recoverGroundItem } from './bag';

test('官银包占两格，丢下留在西仓，返回时可拾回', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 14, content);
  const atWarehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse' } };
  const taken = chooseEvent(atWarehouse, 'take_silver', content);
  expect(bagSlots(taken.run!, content, taken.permanent.copyPositions)).toBe(2);
  const dropped = dropCarriedItem(taken, 'silver_ledger', 'bag', content);
  expect(dropped.run?.loot.silver_ledger).toBeUndefined();
  expect(dropped.run?.groundItems?.warehouse?.silver_ledger).toBe(1);
  expect(getSceneText(dropped, content)).toContain('地上留着官银包');
  expect(bagSlots(dropped.run!, content, dropped.permanent.copyPositions)).toBe(0);
  const recovered = recoverGroundItem(dropped, 'silver_ledger', content);
  expect(recovered.run?.loot.silver_ledger).toBe(1);
  expect(recovered.run?.groundItems?.warehouse).toBeUndefined();
  expect(runWeight(recovered.run!, content, recovered.permanent.copyPositions)).toBe(15);
});

test('背包已满时不能拾取，即使负重仍有余量', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 15, content);
  const atWarehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse', inventory: { medicine: 12 } } };
  expect(bagSlots(atWarehouse.run, content, atWarehouse.permanent.copyPositions)).toBe(12);
  expect(runWeight(atWarehouse.run, content, atWarehouse.permanent.copyPositions)).toBe(12);
  expect(() => chooseEvent(atWarehouse, 'take_silver', content)).toThrow('背包格子已满');
  expect(atWarehouse.run.loot.silver_ledger).toBeUndefined();
  const withGround = { ...atWarehouse, run: { ...atWarehouse.run, groundItems: { warehouse: { silver_ledger: 1 } } } };
  expect(() => recoverGroundItem(withGround, 'silver_ledger', content)).toThrow('背包格子已满');
  expect(withGround.run.groundItems.warehouse.silver_ledger).toBe(1);
});

test('出发整备同样受十二格限制，穿戴铁剑不占格', () => {
  const content = loadBundledContent();
  const base = createGame();
  const supplied = { ...base, permanent: { ...base.permanent, stash: { medicine: 13, sword: 1 } } };
  expect(() => startRun(supplied, { medicine: 13 }, 0, 23, content)).toThrow('背包超过 12 格');
  const withSword = startRun(supplied, { medicine: 12, sword: 1 }, 0, 23, content);
  expect(bagSlots(withSword.run!, content, withSword.permanent.copyPositions)).toBe(12);
  expect(withSword.run?.wornItemIds).toContain('sword');
});

test('穿戴与贴身不占行囊格，丢下时正确解除位置', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 16, content);
  const carrying = { ...raid, run: { ...raid.run!, locationId: 'warehouse', inventory: { sword: 1, medicine: 1 }, wornItemIds: ['sword'], pocketItems: { medicine: 1 } } };
  expect(bagSlots(carrying.run, content, carrying.permanent.copyPositions)).toBe(0);
  const noSword = dropCarriedItem(carrying, 'sword', 'worn', content);
  expect(noSword.run?.wornItemIds).toEqual([]);
  expect(noSword.run?.groundItems?.warehouse?.sword).toBe(1);
  const empty = dropCarriedItem(noSword, 'medicine', 'pocket', content);
  expect(empty.run?.pocketItems?.medicine).toBeUndefined();
  expect(empty.run?.groundItems?.warehouse?.medicine).toBe(1);
  expect(runWeight(empty.run!, content, empty.permanent.copyPositions)).toBe(0);
});

test('丢下独本后原件留在当前地点，可由已有找回行动取回', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 17, content);
  const atWarehouse = { ...raid, run: { ...raid.run!, locationId: 'warehouse' } };
  const taken = chooseEvent(atWarehouse, 'take_swallow_manual', content);
  const dropped = dropCarriedCopy(taken, 'swallow_biaoshi_copy', content);
  expect(dropped.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'lost', locationId: 'warehouse' });
  expect(getSceneText(dropped, content)).toContain('镖师手抄本仍留在这里');
  expect(getChoices(dropped, content).map((choice) => choice.id)).toContain('recover:swallow_biaoshi_copy');
  const recovered = chooseEvent(dropped, 'recover:swallow_biaoshi_copy', content);
  expect(recovered.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
});
