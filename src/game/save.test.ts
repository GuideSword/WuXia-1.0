import { beforeEach, expect, test } from 'vitest';
import { createGame, startRun } from './engine/lifecycle';
import { commitImport, exportSave, inspectSaveSlot, loadGame, parseImport, saveGame } from './save';

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

test('行动日志随本地存档恢复', () => {
  const inRaid = createGame();
  const started = { ...inRaid, phase: 'explore' as const, run: { locationId: 'foothill', hp: 100, heat: 0, coins: 0, inventory: {}, loot: {}, pendingRumors: [], flags: [], seed: 1, battle: null, log: ['来到山脚', '避开巡逻'] } };
  saveGame(localStorage, started);
  expect(loadGame(localStorage).run?.log).toEqual(['来到山脚', '避开巡逻']);
});

test('丢在当前地点的物品随本局存档恢复', () => {
  const started = startRun(createGame(), {}, 0, 21);
  const withGround = { ...started, run: { ...started.run!, groundItems: { foothill: { medicine: 2 } } } };
  saveGame(localStorage, withGround);
  expect(loadGame(localStorage).run?.groundItems?.foothill?.medicine).toBe(2);
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

test('多个档位互不覆盖，旧存档作为第一档可读取', () => {
  const first = createGame();
  saveGame(localStorage, { ...first, permanent: { ...first.permanent, coins: 777 } });
  expect(inspectSaveSlot(localStorage, 1).status).toBe('ready');
  expect(inspectSaveSlot(localStorage, 2).status).toBe('empty');
  saveGame(localStorage, createGame(), 2);
  expect(loadGame(localStorage, undefined, 1).permanent.coins).toBe(777);
  expect(loadGame(localStorage, undefined, 2).permanent.coins).toBe(500);
});

test('一个档位损坏不影响其他档位', () => {
  saveGame(localStorage, createGame(), 2);
  localStorage.setItem('wuxia.current', '{broken');
  localStorage.setItem('wuxia.lastKnownGood', '{broken');
  expect(inspectSaveSlot(localStorage, 1).status).toBe('damaged');
  expect(inspectSaveSlot(localStorage, 2).status).toBe('ready');
});

test('旧档的重复同名秘籍保留数量，只映射一份到独本', () => {
  const old = createGame();
  const game = { ...old, permanent: { ...old.permanent, coins: 783, stash: { swallow_manual: 3 }, learnedArts: ['basic_sword', 'swallow_step'] } };
  const raw = { schemaVersion: 1, game };
  const migrated = parseImport(JSON.stringify(raw));
  expect(migrated.permanent.coins).toBe(783);
  expect(migrated.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'home' });
  expect(migrated.permanent.stash.swallow_manual).toBe(2);
  expect(migrated.permanent.learnedArts).toContain('swallow_step');
  expect(JSON.parse(exportSave(migrated)).schemaVersion).toBe(2);
});

test('进行中的旧档持有残页时，原藏处不会再生成第二张', () => {
  const raid = startRun(createGame(), {}, 0, 28);
  const old = { ...raid, run: { ...raid.run!, loot: { blood_blade_page: 1 }, flags: ['blood_page_taken'] } };
  const migrated = parseImport(JSON.stringify({ schemaVersion: 1, game: old }));
  expect(migrated.permanent.copyPositions.blood_page_copy).toEqual({ kind: 'bag' });
  expect(migrated.run?.loot.blood_blade_page).toBeUndefined();
});

test('旧档失手遗落独本时保留唯一去向，不在原来源刷新', () => {
  const old = createGame();
  const result = { success: false, coins: 0, loot: {}, rumors: [], lost: { blood_blade_page: 1 }, route: null, message: '失手' };
  const game = { ...old, phase: 'result' as const, lastResult: result };
  const migrated = parseImport(JSON.stringify({ schemaVersion: 1, game }));
  expect(migrated.permanent.copyPositions.blood_page_copy).toEqual({ kind: 'lost', locationId: 'second_chief_room' });
  expect(migrated.permanent.flags).toContain('chief_secret_discovered');
});

test('新档拒绝不存在的独本与没有行囊的随身独本', () => {
  const base = createGame();
  const unknown = { ...base, permanent: { ...base.permanent, copyPositions: { ...base.permanent.copyPositions, forged: { kind: 'home' } } } };
  expect(() => parseImport(JSON.stringify({ schemaVersion: 2, game: unknown }))).toThrow(/未知独本/);
  const noRun = { ...base, permanent: { ...base.permanent, copyPositions: { ...base.permanent.copyPositions, swallow_biaoshi_copy: { kind: 'bag' } } } };
  expect(() => parseImport(JSON.stringify({ schemaVersion: 2, game: noRun }))).toThrow(/行囊/);
  const doubled = { ...base, permanent: { ...base.permanent, stash: { swallow_biaoshi_copy: 1 } } };
  expect(() => parseImport(JSON.stringify({ schemaVersion: 2, game: doubled }))).toThrow(/重复存放/);
});
