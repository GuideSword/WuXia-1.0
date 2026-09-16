import { expect, test } from 'vitest';
import { resolveTurn } from './combat';
import { createGame, startRun } from './lifecycle';

function battle(intent: 'strike' | 'heavy' | 'guard' = 'heavy') {
  const base = startRun(createGame(), {}, 0, 29);
  return { ...base, phase: 'combat' as const, run: { ...base.run!, battle: { npcId: 'second_chief', enemyHp: 36, round: 1, intent, defending: false } } };
}

test('重击前防御显著减伤', () => {
  expect(resolveTurn(battle(), { type: 'defend' }).run!.hp).toBeGreaterThan(resolveTurn(battle(), { type: 'attack' }).run!.hp);
});

test('六类行动都有规则；物品不足不消耗回合', () => {
  expect(resolveTurn(battle(), { type: 'attack' }).run!.battle!.enemyHp).toBe(28);
  expect(resolveTurn(battle(), { type: 'movement' }).run!.hp).toBeGreaterThan(resolveTurn(battle(), { type: 'attack' }).run!.hp);
  expect(() => resolveTurn(battle(), { type: 'item' })).toThrow(/药/);
  expect(() => resolveTurn(battle(), { type: 'technique' })).toThrow(/武学/);
  const withdrawn = resolveTurn(battle(), { type: 'retreat' });
  expect(withdrawn.phase).toBe('explore');
  expect(withdrawn.run!.heat).toBe(15);
});

test('获胜保留进度，战败丢失本局物资', () => {
  const winning = battle();
  winning.run.battle.enemyHp = 8;
  const win = resolveTurn(winning, { type: 'attack' });
  expect(win.phase).toBe('explore');
  expect(win.run!.flags).toContain('second_chief_defeated');
  const dying = battle();
  dying.run.hp = 1;
  dying.run.loot = { silver_ledger: 1 };
  const loss = resolveTurn(dying, { type: 'defend' });
  expect(loss.phase).toBe('result');
  expect(loss.lastResult?.lost.silver_ledger).toBe(1);
});
