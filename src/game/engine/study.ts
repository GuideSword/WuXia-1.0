import type { Content, CopyDefinition, GameState } from '../model';
import { addHeat } from './heat';

export function grantCopyInsight(state: GameState, copy: CopyDefinition): GameState {
  if (!copy.artId || !copy.insightId) throw new Error('这份残篇不能教授完整武学');
  if (state.permanent.learnedInsights.includes(copy.insightId)) throw new Error('已领悟这份见解');
  const learnedArts = [...new Set([...state.permanent.learnedArts, copy.artId])];
  const learnedInsights = [...state.permanent.learnedInsights, copy.insightId];
  const artName = { swallow_step: '燕回身', wild_blade: '狂风刀', turtle_breath: '龟息功', acupoint: '点穴手', taiji_sword: '太极剑' }[copy.artId] ?? '武学';
  return {
    ...state,
    permanent: { ...state.permanent, learnedArts, learnedInsights },
    notice: `读懂${copy.title}，习得${artName}，领悟${copy.author}的见解。`,
  };
}

export function studyCopy(state: GameState, copyId: string, content: Content): GameState {
  if (state.phase !== 'town' || state.run || state.safeLocationId !== 'training_yard') throw new Error('只能在练功处研读家中秘籍');
  const copy = content.copies.find((entry) => entry.id === copyId);
  if (!copy) throw new Error('未知秘籍');
  if (state.permanent.copyPositions[copyId]?.kind !== 'home') throw new Error('这份秘籍尚未带回家中');
  return grantCopyInsight(state, copy);
}

export function fieldStudyReason(state: GameState, copyId: string, content: Content): string | null {
  const run = state.run;
  if (state.phase !== 'explore' || !run || run.battle) return '战斗中不能研读';
  const copy = content.copies.find((entry) => entry.id === copyId);
  if (!copy?.artId || !copy.insightId) return '这份书不能教授完整武学';
  const position = state.permanent.copyPositions[copyId];
  if (position?.kind !== 'bag' && position?.kind !== 'pocket') return '秘籍不在身上';
  if (state.permanent.learnedInsights.includes(copy.insightId)) return '已领悟这份见解';
  if (run.hiddenAt !== run.locationId) return '须先找到可靠藏身处';
  if (run.heat >= 50) return '风声达到 50，无法安心研读';
  const location = content.locations.find((entry) => entry.id === run.locationId);
  if (copy.requiresLight && !location?.light && !(run.inventory.lantern || run.loot.lantern)) return '光线不足，需要遮光风灯';
  if (copy.requiresPracticeSpace && !location?.practiceSpace) return '此处没有试走步法的空间';
  return null;
}

export function hideAt(state: GameState, content: Content): GameState {
  const run = state.run;
  if (state.phase !== 'explore' || !run || run.battle) throw new Error('当前不能藏身');
  const location = content.locations.find((entry) => entry.id === run.locationId);
  if (!location?.hideSpot) throw new Error('此处没有可靠藏身处');
  if (run.hiddenAt === run.locationId) return state;
  return { ...state, run: { ...run, hiddenAt: run.locationId, log: [...(run.log ?? []), `在${location.name}藏好身形`].slice(-30) }, notice: '你暂时避开了巡逻视线。' };
}

export function leaveHiding(state: GameState): GameState {
  const run = state.run;
  if (state.phase !== 'explore' || !run || run.hiddenAt !== run.locationId) throw new Error('当前没有藏身');
  return { ...state, run: { ...run, hiddenAt: null, log: [...(run.log ?? []), '离开藏身处'].slice(-30) }, notice: '你离开藏身处，重新暴露在巡逻视线中。' };
}

export function studyInField(state: GameState, copyId: string, content: Content): GameState {
  const reason = fieldStudyReason(state, copyId, content);
  if (reason) throw new Error(reason);
  const run = state.run!;
  const copy = content.copies.find((entry) => entry.id === copyId)!;
  const location = content.locations.find((entry) => entry.id === run.locationId)!;
  const patrolStep = (run.patrolStep ?? 0) + 1;
  const interrupted = patrolStep % (location.patrolPeriod ?? 3) === 0;
  const heat = interrupted ? addHeat(run.heat, 8) : run.heat;
  const nextRun = { ...run, patrolStep, heat, hiddenAt: interrupted ? null : run.hiddenAt, log: [...(run.log ?? []), interrupted ? `研读${copy.title}时巡逻逼近` : `研读${copy.title}`].slice(-30) };
  if (interrupted || heat >= 50) return { ...state, run: nextRun, notice: '巡逻逼近，研读中断；秘籍仍在身上。' };
  return grantCopyInsight({ ...state, run: nextRun }, copy);
}
