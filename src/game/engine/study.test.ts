import { expect, test } from 'vitest';
import { loadBundledContent } from '../content/load';
import { createGame } from './lifecycle';
import { studyCopy } from './study';
import { evaluateExit } from './exits';

function atTrainingWith(copyIds: string[]) {
  const game = createGame();
  const copyPositions = { ...game.permanent.copyPositions };
  for (const id of copyIds) copyPositions[id] = { kind: 'home' };
  return { ...game, safeLocationId: 'training_yard', permanent: { ...game.permanent, copyPositions } };
}

test('镖师抄本和原本均可先教会燕回身，各有固定见解且读书不消耗', () => {
  const content = loadBundledContent();
  for (const first of ['swallow_biaoshi_copy', 'swallow_original_copy']) {
    const second = first === 'swallow_biaoshi_copy' ? 'swallow_original_copy' : 'swallow_biaoshi_copy';
    const base = atTrainingWith([first, second]);
    const learned = studyCopy(base, first, content);
    expect(learned.permanent.learnedArts).toContain('swallow_step');
    expect(learned.permanent.copyPositions[first]).toEqual({ kind: 'home' });
    expect(learned.permanent.learnedInsights).toContain(first === 'swallow_biaoshi_copy' ? 'insight_borrow_wall' : 'insight_soft_landing');
    const both = studyCopy(learned, second, content);
    expect(both.permanent.learnedInsights).toEqual(expect.arrayContaining(['insight_borrow_wall', 'insight_soft_landing']));
    expect(() => studyCopy(both, first, content)).toThrow(/已领悟/);
  }
});

test('残页不能当完整武学研读，书未带回也不能在镇中研读', () => {
  const content = loadBundledContent();
  const game = atTrainingWith(['blood_page_copy']);
  expect(() => studyCopy(game, 'blood_page_copy', content)).toThrow(/完整武学/);
  expect(() => studyCopy(game, 'swallow_biaoshi_copy', content)).toThrow(/家中/);
});

test('青燕门落地见解放宽悬崖负重', () => {
  const context = { locationId: 'back_hill', heat: 0, hasDisguise: false, coins: 0, tags: ['lightness'], load: 23, hasTunnelMap: false, ally: false, insights: [] as string[] };
  expect(evaluateExit('cliff', context).status).toBe('closed');
  expect(evaluateExit('cliff', { ...context, insights: ['insight_soft_landing'] }).status).toBe('open');
});
