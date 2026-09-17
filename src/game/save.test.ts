import { beforeEach, expect, test } from 'vitest';
import { createGame } from './engine/lifecycle';
import { commitImport, exportSave, loadGame, parseImport, saveGame } from './save';

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

test('导入只解析不覆盖现有存档，确认后才提交', () => {
  saveGame(localStorage, createGame());
  const original = localStorage.getItem('wuxia.current');
  const imported = parseImport(exportSave({ ...createGame(), permanent: { ...createGame().permanent, coins: 900 } }));
  expect(localStorage.getItem('wuxia.current')).toBe(original);
  commitImport(localStorage, imported);
  expect(loadGame(localStorage).permanent.coins).toBe(900);
});

test('拒绝非法 JSON、未来版本和缺少永久银两的档案', () => {
  expect(() => parseImport('{')).toThrow(/JSON/);
  expect(() => parseImport('{"schemaVersion":99,"game":{}}')).toThrow(/版本/);
  expect(() => parseImport('{"schemaVersion":1,"game":{"phase":"town","permanent":{}}}')).toThrow(/校验/);
});

test('旧版本只补已知缺省字段并保留银两', () => {
  const legacy = createGame();
  const raw = { schemaVersion: 0, game: { ...legacy, permanent: { coins: 783, stash: {} } } };
  const parsed = parseImport(JSON.stringify(raw));
  expect(parsed.permanent.coins).toBe(783);
  expect(parsed.permanent.learnedArts).toContain('basic_sword');
});

test('双份损坏后新开局会重建可恢复备份', () => {
  localStorage.setItem('wuxia.current', '{broken');
  localStorage.setItem('wuxia.lastKnownGood', '{broken');
  saveGame(localStorage, createGame());
  localStorage.setItem('wuxia.current', '{broken-again');
  expect(loadGame(localStorage).permanent.coins).toBe(500);
});

test('拒绝页面阶段与本局状态不一致的导入', () => {
  const invalid = { ...createGame(), phase: 'combat', run: null };
  expect(() => parseImport(JSON.stringify({ schemaVersion: 1, game: invalid }))).toThrow(/阶段/);
});
