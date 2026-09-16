import type { GameState } from '../model';
import { rollD6 } from '../seed';
import { addHeat } from './heat';
import { failRun } from './lifecycle';
import { artTags } from './martial';

export type CombatAction = { type: 'attack' | 'technique' | 'defend' | 'movement' | 'item' | 'retreat'; artId?: string };

export function resolveTurn(state: GameState, action: CombatAction): GameState {
  const run = state.run;
  const battle = run?.battle;
  if (state.phase !== 'combat' || !run || !battle) throw new Error('当前不在战斗中');
  if (action.type === 'retreat') return { ...state, phase: 'explore', run: { ...run, battle: null, heat: addHeat(run.heat, 15) }, notice: '你借乱退出战斗，风声 +15。' };
  if (action.type === 'item' && !run.inventory.medicine) throw new Error('金疮药不足');
  if (action.type === 'technique' && !state.permanent.learnedArts.includes(action.artId ?? '')) throw new Error('尚未掌握这门武学');
  const enemyGuard = battle.intent === 'guard';
  const baseDamage = action.type === 'attack' ? 8 + (run.inventory.sword ? 2 : 0) : action.type === 'technique' ? 12 + (run.inventory.sword ? 2 : 0) : 0;
  const techniqueBonus = action.type === 'technique' && action.artId === 'taiji_sword' && battle.intent === 'heavy' ? 4 : 0;
  const damage = enemyGuard ? Math.floor((baseDamage + techniqueBonus) / 2) : baseDamage + techniqueBonus;
  const enemyHp = Math.max(0, battle.enemyHp - damage);
  const inventory = { ...run.inventory };
  if (action.type === 'item') inventory.medicine -= 1;
  const healedHp = action.type === 'item' ? Math.min(100, run.hp + 20) : run.hp;
  if (enemyHp === 0) return {
    ...state, phase: 'explore',
    run: { ...run, inventory, battle: null, hp: healedHp, heat: addHeat(run.heat, 25), flags: [...new Set([...run.flags, `${battle.npcId}_defeated`])] },
    notice: '敌人倒下，打斗惊动寨中。风声 +25。',
  };
  const incoming = battle.intent === 'heavy' ? 16 : battle.intent === 'strike' ? 8 : 4;
  const received = action.type === 'defend' ? Math.floor(incoming / 2) : action.type === 'movement' ? (artTags(state.permanent.learnedArts).includes('lightness') ? 0 : Math.floor(incoming / 4)) : incoming;
  const hp = Math.max(0, healedHp - received);
  const roll = rollD6(run.seed);
  const next: GameState = {
    ...state,
    run: { ...run, hp, seed: roll.nextSeed, inventory, heat: action.type === 'technique' ? addHeat(run.heat, 5) : run.heat, flags: action.type === 'technique' ? [...new Set([...run.flags, `witnessed_style:${action.artId}`])] : run.flags, battle: { ...battle, enemyHp, round: battle.round + 1, intent: roll.value <= 2 ? 'strike' : roll.value <= 4 ? 'heavy' : 'guard', defending: action.type === 'defend' } },
    notice: `你造成 ${damage} 点伤害，受 ${received} 点伤害。`,
  };
  return hp === 0 ? failRun(next) : next;
}
