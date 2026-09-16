import { beforeEach, expect, test } from 'vitest';
import { createGame } from './engine/lifecycle';
import { loadGame, saveGame } from './save';

beforeEach(() => localStorage.clear());

test('当前档损坏时读取上一稳定档', () => {
  saveGame(localStorage, createGame());
  localStorage.setItem('wuxia.current', '{broken');
  expect(loadGame(localStorage).permanent.coins).toBe(500);
});

test('双份损坏时不静默清档', () => {
  saveGame(localStorage, createGame());
  localStorage.setItem('wuxia.current', '{broken');
  localStorage.setItem('wuxia.lastKnownGood', '{broken');
  expect(() => loadGame(localStorage)).toThrow(/存档/);
});

test('保存后可恢复到本局稳定地点', () => {
  const game = createGame();
  const inRaid = { ...game, phase: 'explore' as const, run: { locationId: 'gate', hp: 80, heat: 20, coins: 50, inventory: {}, loot: {}, pendingRumors: [], flags: [], seed: 1, battle: null } };
  saveGame(localStorage, inRaid);
  expect(loadGame(localStorage).run?.locationId).toBe('gate');
});
