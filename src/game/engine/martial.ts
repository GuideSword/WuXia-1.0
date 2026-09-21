import { loadBundledContent } from '../content/load';
import type { GameState } from '../model';

export function artTags(learnedArts: string[]): string[] {
  const arts = loadBundledContent().arts;
  return [...new Set(learnedArts.flatMap((id) => arts.find((art) => art.id === id)?.tags ?? []))];
}

export function counterBonus(ours: string[], theirs: string[]): number {
  let bonus = 0;
  if (ours.includes('soft') && theirs.includes('hard')) bonus += 4;
  if (ours.includes('counter') && theirs.includes('first')) bonus += 4;
  if (ours.includes('movement') && theirs.includes('locked')) bonus += 4;
  return bonus;
}

export function learnArt(state: GameState, artId: string): GameState {
  if (state.phase !== 'town' || state.run || state.safeLocationId !== 'training_yard') throw new Error('只能在练功处参悟');
  const art = loadBundledContent().arts.find((entry) => entry.id === artId);
  if (!art) throw new Error('未知武学');
  if (state.permanent.learnedArts.includes(artId)) throw new Error('已掌握这门武学');
  if (!art.manualItemId || !state.permanent.stash[art.manualItemId]) throw new Error('尚未带回秘籍');
  return { ...state, permanent: { ...state.permanent, learnedArts: [...state.permanent.learnedArts, artId], learnedInsights: [...state.permanent.learnedInsights, `legacy:${artId}`] }, notice: `参悟「${art.name}」成功，秘籍仍留在家中。` };
}
