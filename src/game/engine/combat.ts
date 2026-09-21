import type { GameState } from '../model';
import { rollD6 } from '../seed';
import { addHeat } from './heat';
import { failRun } from './lifecycle';
import { artTags } from './martial';
import { counterBonus } from './martial';
import { runWeight } from './inventory';
import { loadBundledContent } from '../content/load';

export type CombatAction = { type: 'attack' | 'technique' | 'defend' | 'movement' | 'item' | 'retreat'; artId?: string };

export function resolveTurn(state: GameState, action: CombatAction): GameState {
  const run = state.run;
  const battle = run?.battle;
  if (state.phase !== 'combat' || !run || !battle) throw new Error('当前不在战斗中');
  if (action.type === 'retreat') {
    const seen = run.flags.filter((flag) => flag.startsWith('style_seen:')).map((flag) => flag.replace('style_seen:', 'witnessed_style:'));
    return { ...state, phase: 'explore', permanent: { ...state.permanent, flags: [...new Set([...state.permanent.flags, ...seen])] }, run: { ...run, flags: run.flags.filter((flag) => !flag.startsWith('style_seen:')), battle: null, heat: addHeat(run.heat, 15), log: [...(run.log ?? []), '从战斗中撤退，风声 +15'].slice(-30) }, notice: '你借乱退出战斗，风声 +15。' };
  }
  if (action.type === 'item' && !run.inventory.medicine) throw new Error('金疮药不足');
  if (action.type === 'technique' && !state.permanent.learnedArts.includes(action.artId ?? '')) throw new Error('尚未掌握这门武学');
  const enemyGuard = battle.intent === 'guard';
  const artDamage: Record<string, number> = { basic_sword: 12, wild_blade: 18, taiji_sword: 12, swallow_step: 10, turtle_breath: 9, acupoint: 6 };
  const insightDamage = action.type === 'technique' && ((action.artId === 'wild_blade' && state.permanent.learnedInsights.includes('insight_wild_trainer')) || (action.artId === 'acupoint' && state.permanent.learnedInsights.includes('insight_acupoint_prisoner'))) ? 3 : 0;
  const baseDamage = action.type === 'attack' ? 8 + (run.inventory.sword ? 2 : 0) : action.type === 'technique' ? (artDamage[action.artId ?? ''] ?? 12) + (run.inventory.sword ? 2 : 0) + insightDamage : 0;
  const enemyTags = battle.intent === 'heavy' ? ['hard'] : battle.intent === 'strike' ? ['first'] : ['locked'];
  const techniqueBonus = action.type === 'technique' && action.artId === 'taiji_sword' ? counterBonus(['soft', 'counter'], enemyTags) + (state.permanent.learnedInsights.includes('insight_taiji_visitor') && battle.intent === 'heavy' ? 3 : 0) : 0;
  const damage = enemyGuard ? Math.floor((baseDamage + techniqueBonus) / 2) : baseDamage + techniqueBonus;
  const enemyHp = Math.max(0, battle.enemyHp - damage);
  const visibleArt = action.type === 'technique' && !['acupoint', 'turtle_breath'].includes(action.artId ?? '');
  const techniqueHeat = action.type === 'technique' ? action.artId === 'wild_blade' ? 12 : ['acupoint', 'turtle_breath'].includes(action.artId ?? '') ? 0 : 5 : 0;
  const artName = action.artId ? loadBundledContent().arts.find((art) => art.id === action.artId)?.name ?? action.artId : '';
  const actionName = action.type === 'technique' ? `施展${artName}` : { attack: '普通攻击', defend: '防御', movement: '身法闪避', item: '使用金疮药', retreat: '撤退' }[action.type];
  const inventory = { ...run.inventory };
  if (action.type === 'item') inventory.medicine -= 1;
  const pocketItems = { ...run.pocketItems };
  if (action.type === 'item' && (pocketItems.medicine ?? 0) > inventory.medicine + (run.loot.medicine ?? 0)) pocketItems.medicine -= 1;
  const healedHp = Math.min(100, run.hp + (action.type === 'item' ? 20 : action.type === 'technique' && action.artId === 'turtle_breath' ? 4 : 0));
  if (enemyHp === 0) return {
    ...state, phase: 'explore',
    run: { ...run, inventory, pocketItems, battle: null, hp: healedHp, heat: addHeat(run.heat, 25 + techniqueHeat), flags: [...new Set([...run.flags.filter((flag) => !flag.startsWith('style_seen:')), `${battle.npcId}_defeated`])], log: [...(run.log ?? []), `${actionName}，击败敌人；风声 +${25 + techniqueHeat}`].slice(-30) },
    notice: `敌人倒下，打斗惊动寨中。风声 +${25 + techniqueHeat}。`,
  };
  const incoming = battle.intent === 'heavy' ? 16 : battle.intent === 'strike' ? 8 : 4;
  const heavyLoad = runWeight(run, loadBundledContent(), state.permanent.copyPositions) > 20;
  const received = action.type === 'defend' ? Math.floor(incoming / 2)
    : action.type === 'movement' ? (heavyLoad ? Math.floor(incoming / 2) : artTags(state.permanent.learnedArts).includes('lightness') ? 0 : Math.floor(incoming / 4))
    : action.type === 'technique' && action.artId === 'acupoint' ? 0
    : action.type === 'technique' && action.artId === 'swallow_step' ? (heavyLoad ? Math.floor(incoming / 2) : 0)
    : action.type === 'technique' && action.artId === 'taiji_sword' && battle.intent === 'heavy' ? Math.floor(incoming / 2)
    : incoming;
  const hp = Math.max(0, healedHp - received);
  const roll = rollD6(run.seed);
  const next: GameState = {
    ...state,
    run: { ...run, hp, seed: roll.nextSeed, inventory, pocketItems, heat: addHeat(run.heat, techniqueHeat), flags: visibleArt ? [...new Set([...run.flags, `style_seen:${action.artId}`])] : run.flags, battle: { ...battle, enemyHp, round: battle.round + 1, intent: roll.value <= 2 ? 'strike' : roll.value <= 4 ? 'heavy' : 'guard', defending: action.type === 'defend' }, log: [...(run.log ?? []), `${actionName}，造成 ${damage} 伤害，受到 ${received} 伤害`].slice(-30) },
    notice: `你造成 ${damage} 点伤害，受 ${received} 点伤害。`,
  };
  return hp === 0 ? failRun(next) : next;
}
