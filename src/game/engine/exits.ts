import type { Content, Counts, GameState, RunState } from '../model';
import { rollD6 } from '../seed';
import { addHeat, canUseGate } from './heat';
import { runWeight } from './inventory';
import { settleExtraction } from './lifecycle';
import { artTags } from './martial';

export type ExitId = 'gate' | 'cliff' | 'waterway' | 'caravan' | 'tunnel' | 'qingyan_return' | 'qingyan_cliff';
export type ExitStatus = 'open' | 'roll4' | 'roll5' | 'closed';
export interface ExitContext {
  regionId?: 'blackwind' | 'qingyan';
  locationId: string;
  heat: number;
  hasDisguise: boolean;
  coins: number;
  tags: string[];
  load: number;
  hasTunnelMap: boolean;
  ally: boolean;
  gateCleared?: boolean;
  knownStyle?: boolean;
  insights?: string[];
}
export interface ExitEvaluation { status: ExitStatus; reason: string; costCoins: number; droppedItemIds: string[] }

export const exitNames: Record<ExitId, string> = { gate: '山门', cliff: '悬崖', waterway: '水道', caravan: '商队', tunnel: '后山密道', qingyan_return: '青燕门旧山门', qingyan_cliff: '青燕门断崖' };
export const exitIds: ExitId[] = ['gate', 'cliff', 'waterway', 'caravan', 'tunnel', 'qingyan_return', 'qingyan_cliff'];

export function evaluateExit(id: ExitId, c: ExitContext): ExitEvaluation {
  const closed = (reason: string): ExitEvaluation => ({ status: 'closed', reason, costCoins: 0, droppedItemIds: [] });
  const open = (reason: string, costCoins = 0): ExitEvaluation => ({ status: 'open', reason, costCoins, droppedItemIds: [] });
  const region = c.regionId ?? 'blackwind';
  if (id === 'qingyan_return' || id === 'qingyan_cliff') {
    if (region !== 'qingyan') return closed('此路不在当前地图');
    if (id === 'qingyan_return') return c.locationId === 'qingyan_gate' ? open('循旧山门返回青石镇') : closed('需返回青燕门旧山门');
    if (c.locationId !== 'qingyan_hall') return closed('需到旧演武堂');
    if (!c.tags.includes('lightness')) return closed('需习得轻功');
    const limit = c.insights?.includes('insight_soft_landing') ? 25 : 20;
    return c.load <= limit ? open('轻功越崖，返回青石镇') : closed(`负重须不超过 ${limit}`);
  }
  if (region !== 'blackwind') return closed('此路不在当前地图');
  if (id === 'gate') {
    if (c.locationId !== 'gate') return closed('需先到山门');
    if (c.heat >= 100) return closed('封寨追捕中，山门已关闭');
    const checkAt = c.knownStyle ? 40 : 50;
    if (c.heat >= checkAt && !c.gateCleared) return closed(`风声达到 ${checkAt}，须先通过山门盘查${c.knownStyle ? '（招式已被认出）' : ''}`);
    return open('山门可通行');
  }
  if (id === 'cliff') {
    if (c.locationId !== 'back_hill') return closed('需先到后山');
    if (!c.tags.includes('lightness')) return closed('需习得轻功');
    const limit = c.insights?.includes('insight_soft_landing') ? 25 : 20;
    if (c.load > limit) return closed(`负重须不超过 ${limit}`);
    return open('轻功越崖，保留全部物资');
  }
  if (id === 'waterway') {
    if (c.locationId !== 'waterway') return closed('需先到水道');
    if (!c.tags.includes('breath')) return closed('需习得龟息类吐纳');
    return open('潜水离寨，须丢弃最重的一件普通战利品');
  }
  if (id === 'tunnel') {
    if (c.locationId !== 'back_hill') return closed('需先到后山');
    if (!c.hasTunnelMap && !c.ally) return closed('需密道图或囚犯相助');
    return open('经密道离开，无额外代价');
  }
  if (c.locationId !== 'foothill') return closed('需先回到山脚');
  if (c.heat >= 80) return closed('风声达到 80，商队拒绝接应');
  if (!c.hasDisguise) return closed('需携带蒙面巾或易容道具');
  if (c.coins < 200) return closed('需携带 200 两车资');
  if (c.heat < 50) return open('支付 200 两车资，即可混入商队', 200);
  const threshold = c.heat < 65 ? 4 : 5;
  return { status: threshold === 4 ? 'roll4' : 'roll5', reason: `支付 200 两并主动掷 1d6，须掷出 ${threshold}+；失败车资不退、风声 +10`, costCoins: 200, droppedItemIds: [] };
}

export function exitContext(state: GameState, content: Content): ExitContext {
  const run = state.run;
  if (!run) throw new Error('没有进行中的探索');
  return {
    regionId: run.regionId ?? 'blackwind',
    locationId: run.locationId, heat: run.heat,
    hasDisguise: (run.inventory.mask ?? 0) + (run.loot.mask ?? 0) > 0,
    coins: run.coins, tags: artTags(state.permanent.learnedArts), load: runWeight(run, content, state.permanent.copyPositions),
    hasTunnelMap: !!run.inventory.tunnel_map || !!run.loot.tunnel_map || ['bag', 'pocket', 'home'].includes(state.permanent.copyPositions.tunnel_map_copy?.kind ?? '') || state.permanent.confirmedRumors.includes('tunnel_entrance'),
    ally: (state.permanent.relations.prisoner ?? 0) >= 1,
    gateCleared: canUseGate(run),
    knownStyle: run.flags.includes('known_style'),
    insights: state.permanent.learnedInsights,
  };
}

function dropHeaviestOrdinary(run: RunState, content: Content): { run: RunState; lost: Counts } {
  const item = content.items.filter((entry) => entry.kind === 'loot' && (run.loot[entry.id] ?? 0) > 0).sort((a, b) => b.weight - a.weight)[0];
  if (!item) return { run, lost: {} };
  const loot = { ...run.loot, [item.id]: run.loot[item.id] - 1 };
  if (loot[item.id] === 0) delete loot[item.id];
  return { run: { ...run, loot }, lost: { [item.id]: 1 } };
}

export function attemptExit(state: GameState, id: ExitId, content: Content): GameState {
  if (state.phase !== 'explore' || !state.run) throw new Error('当前不能撤离');
  const evaluation = evaluateExit(id, exitContext(state, content));
  if (evaluation.status === 'closed') throw new Error(evaluation.reason);
  let run = { ...state.run, coins: state.run.coins - evaluation.costCoins };
  if (evaluation.status === 'roll4' || evaluation.status === 'roll5') {
    const roll = rollD6(run.seed);
    run = { ...run, seed: roll.nextSeed };
    const needed = evaluation.status === 'roll4' ? 4 : 5;
    if (roll.value < needed) return { ...state, run: { ...run, heat: addHeat(run.heat, 10), log: [...(run.log ?? []), `商队掷出 ${roll.value}，未达 ${needed}+；车资 -200，风声 +10`].slice(-30) }, notice: `掷出 ${roll.value}，未达 ${needed}+。车资已付，风声 +10。` };
  }
  const dropped = id === 'waterway' ? dropHeaviestOrdinary(run, content) : { run, lost: {} };
  return settleExtraction({ ...state, run: dropped.run }, id, content, dropped.lost);
}
