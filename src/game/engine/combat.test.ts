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

test('狂风刀更猛更招风，点穴手能封住当回合攻击', () => {
  const state = battle();
  state.permanent.learnedArts = ['basic_sword', 'wild_blade', 'acupoint'];
  const basic = resolveTurn(state, { type: 'technique', artId: 'basic_sword' });
  const wild = resolveTurn(state, { type: 'technique', artId: 'wild_blade' });
  const point = resolveTurn(state, { type: 'technique', artId: 'acupoint' });
  expect(wild.run!.battle!.enemyHp).toBeLessThan(basic.run!.battle!.enemyHp);
  expect(wild.run!.heat).toBeGreaterThan(basic.run!.heat);
  expect(point.run!.hp).toBe(state.run.hp);
});

test('显眼招式被活着的对手目击后，撤退会留下永久传闻', () => {
  const state = battle();
  state.permanent.learnedArts.push('wild_blade');
  const shown = resolveTurn(state, { type: 'technique', artId: 'wild_blade' });
  expect(shown.run?.log?.at(-1)).toMatch(/狂风刀/);
  const escaped = resolveTurn(shown, { type: 'retreat' });
  expect(escaped.permanent.flags).toContain('witnessed_style:wild_blade');
  expect(escaped.run?.log?.at(-1)).toMatch(/撤退/);
  const nextRaid = startRun({ ...escaped, phase: 'town', run: null }, {}, 0, 3);
  expect(nextRaid.run?.flags).toContain('known_style');
});

test('击败唯一目击者不会留下流派传闻', () => {
  const state = battle();
  state.permanent.learnedArts.push('wild_blade');
  state.run.battle.enemyHp = 19;
  const shown = resolveTurn(state, { type: 'technique', artId: 'wild_blade' });
  const won = resolveTurn(shown, { type: 'attack' });
  expect(won.run?.flags.some((flag) => flag.startsWith('style_seen:'))).toBe(false);
  expect(won.run?.log?.at(-1)).toMatch(/击败/);
});

test('以显眼招式结束战斗仍计算招式风声', () => {
  const state = battle();
  state.permanent.learnedArts.push('wild_blade');
  state.run.battle.enemyHp = 18;
  const won = resolveTurn(state, { type: 'technique', artId: 'wild_blade' });
  expect(won.run?.heat).toBe(37);
  expect(won.run?.flags.some((flag) => flag.startsWith('style_seen:'))).toBe(false);
});
