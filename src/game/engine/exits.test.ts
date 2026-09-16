import { expect, test } from 'vitest';
import { evaluateExit, attemptExit } from './exits';
import { createGame, startRun } from './lifecycle';
import { loadBundledContent } from '../content/load';

const context = { locationId: 'foothill', heat: 0, hasDisguise: true, coins: 200, tags: [] as string[], load: 10, hasTunnelMap: false, ally: false, gateCleared: false };

test.each([[49, 'open'], [50, 'roll4'], [64, 'roll4'], [65, 'roll5'], [79, 'roll5'], [80, 'closed']] as const)('商队风声 %i 时状态 %s', (heat, status) => {
  expect(evaluateExit('caravan', { ...context, heat }).status).toBe(status);
});

test('五条路线均有位置或能力条件及可读原因', () => {
  expect(evaluateExit('cliff', { ...context, locationId: 'back_hill' }).status).toBe('closed');
  expect(evaluateExit('cliff', { ...context, locationId: 'back_hill', tags: ['lightness'], load: 20 }).status).toBe('open');
  expect(evaluateExit('waterway', { ...context, locationId: 'waterway', tags: ['breath'] }).status).toBe('open');
  expect(evaluateExit('tunnel', { ...context, locationId: 'back_hill', ally: true }).status).toBe('open');
  expect(evaluateExit('gate', { ...context, locationId: 'gate', heat: 50 }).reason).toMatch(/盘查/);
});

test('商队主动掷骰失败会扣车资、增加风声和推进种子', () => {
  const content = loadBundledContent();
  const game = startRun(createGame(), {}, 200, 1, content);
  const raid = { ...game, run: { ...game.run!, heat: 65, inventory: { mask: 1 } } };
  const after = attemptExit(raid, 'caravan', content);
  expect(after.phase).toBe('explore');
  expect(after.run?.coins).toBe(0);
  expect(after.run?.heat).toBe(75);
  expect(after.run?.seed).not.toBe(1);
});

test('商队掷骰成功结算，水道撤离丢最重普通战利品', () => {
  const content = loadBundledContent();
  const caravan = startRun(createGame(), {}, 200, 2, content);
  const prepared = { ...caravan, run: { ...caravan.run!, heat: 65, inventory: { mask: 1 } } };
  const won = attemptExit(prepared, 'caravan', content);
  expect(won.phase).toBe('result');
  expect(won.lastResult?.route).toBe('caravan');
  expect(won.permanent.stash.mask).toBe(1);

  const diver = startRun({ ...createGame(), permanent: { ...createGame().permanent, learnedArts: ['basic_sword', 'turtle_breath'] } }, {}, 0, 3, content);
  const water = { ...diver, run: { ...diver.run!, locationId: 'waterway', loot: { silver_ledger: 1, swallow_manual: 1 } } };
  const escaped = attemptExit(water, 'waterway', content);
  expect(escaped.lastResult?.lost.silver_ledger).toBe(1);
  expect(escaped.permanent.coins).toBe(500);
  expect(escaped.permanent.stash.swallow_manual).toBe(1);
});
