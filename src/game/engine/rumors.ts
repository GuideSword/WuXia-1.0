import { loadBundledContent } from '../content/load';
import type { Content, GameState } from '../model';

export function hearRumor(state: GameState, rumorId: string, content: Content = loadBundledContent()): GameState {
  if (!['town', 'rumors'].includes(state.phase) || state.run) throw new Error('只能在安全区探听');
  const rumor = content.rumors.find((entry) => entry.id === rumorId);
  if (!rumor) throw new Error('未知传闻');
  if (state.permanent.heardRumors.includes(rumorId)) return state;
  if (state.permanent.coins < rumor.cost) throw new Error('银两不足');
  return {
    ...state,
    permanent: { ...state.permanent, coins: state.permanent.coins - rumor.cost, heardRumors: [...state.permanent.heardRumors, rumorId] },
    notice: `探听「${rumor.title}」，花费 ${rumor.cost} 两。`,
  };
}

export function confirmRumor(state: GameState, rumorId: string, content: Content = loadBundledContent()): GameState {
  const run = state.run;
  if (!run || state.phase !== 'explore') throw new Error('只能在探索中确认情报');
  const rumor = content.rumors.find((entry) => entry.id === rumorId);
  if (!rumor) throw new Error('未知传闻');
  if (!rumor.confirmationFlag || !run.flags.includes(rumor.confirmationFlag)) throw new Error('尚无足够证据');
  if (!state.permanent.heardRumors.includes(rumorId) && !run.pendingRumors.includes(rumorId)) throw new Error('尚未获知此传闻');
  return rumor.important ? {
    ...state,
    permanent: { ...state.permanent, confirmedRumors: [...new Set([...state.permanent.confirmedRumors, rumorId])] },
    notice: `已确认重要情报：${rumor.title}`,
  } : {
    ...state,
    run: { ...run, pendingRumors: [...new Set([...run.pendingRumors, rumorId])] },
    notice: `找到证据：${rumor.title}。成功撤离后才能永久保留。`,
  };
}
