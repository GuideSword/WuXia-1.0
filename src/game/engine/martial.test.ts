import { expect, test } from 'vitest';
import { artTags, counterBonus, learnArt } from './martial';
import { createGame } from './lifecycle';

test('燕回身提供轻功标签而非等级数字', () => {
  expect(artTags(['swallow_step'])).toContain('lightness');
});
test('太极剑以柔克刚，以后发制先手', () => {
  expect(counterBonus(['soft', 'counter'], ['hard', 'first'])).toBeGreaterThan(0);
});
test('没有带回秘籍不能参悟，带回后消耗秘籍并记住武学', () => {
  const game = { ...createGame(), safeLocationId: 'training_yard' };
  expect(() => learnArt(game, 'swallow_step')).toThrow(/秘籍/);
  game.permanent.stash.swallow_manual = 1;
  const learned = learnArt(game, 'swallow_step');
  expect(learned.permanent.learnedArts).toContain('swallow_step');
  expect(learned.permanent.stash.swallow_manual).toBeUndefined();
  expect(() => learnArt(learned, 'swallow_step')).toThrow(/已掌握/);
});
