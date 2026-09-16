# 武侠撤离式 RPG Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在手机竖屏浏览器完整游玩的“青石镇—黑风寨—血刀经”撤离式 RPG，严格按 Phase 1～7 逐段形成可运行闭环。

**Architecture:** React 只展示状态并提交动作；`src/game` 中的纯函数负责状态转移、战斗和结算；六份 JSON 提供内容，Zod 校验后才可进入引擎。永久层与本局层分离，撤离或失败时通过结算函数提交，稳定节点写入本地双份存档。

**Tech Stack:** Node 22、npm、Vite、React、TypeScript、Zod、Vitest、React Testing Library、Playwright。不要固定未经验证的网络包版本；安装时生成并提交 `package-lock.json`，之后使用 `npm ci`。

---

## 执行约束与阶段验收

本计划依照 [已批准设计](../specs/2026-09-15-wuxia-extraction-rpg-mvp-design.md) 实施。设计文档目前有用户未提交的商队撤离修改；不得覆盖、还原或顺手提交它。实现计划以该修改为准：风声 `<50` 可付费伪装离开；`50–79` 需伪装、付费并由玩家主动掷骰；`≥80` 商队拒绝。为消除边界歧义，首版用 1d6：风声 `50–64` 需 `4+`，`65–79` 需 `5+`；掷骰失败仍在地图内、风声 `+10`，车资不退。投骰使用本局种子，刷新不能重掷同一次结果。此确定化规则须在 UI 上事前说明，若产品复核认为代价过重，在 Phase 6 实施前改此计划与测试。

阶段完成的共同门槛：`npm run typecheck`、`npm test -- --run`、`npm run build` 全绿；新阶段只追加玩法，不破坏上一阶段的最短完整循环。每个任务中的红灯测试要先运行，确认是预期失败而非环境错误；绿灯后才提交。命令均在仓库根目录运行。

| 阶段 | 可验收的最短路径 |
| --- | --- |
| Phase 1 | 青石镇 → 携物出发 → 山脚/山门 → 山门撤离 → 银两结算 → 回镇 |
| Phase 2 | 仓库搜索战利品 → 负重变化 → 撤离保留；死亡丢失本局所得 |
| Phase 3 | 冒险行动增加风声；跨阈值改变巡逻与山门风险 |
| Phase 4 | 二当家战斗可通过六类行动取胜、撤退或死亡 |
| Phase 5 | 获得、撤离、参悟燕回身/龟息功等武学并重访 |
| Phase 6 | 五条撤离路线含商队主动掷骰，条件和代价可见 |
| Phase 7 | 情报链、秘籍链与全部内容下限实际可玩；完成手机端 E2E |

## 文件职责（执行前锁定）

```text
index.html                         Vite 入口
package.json / package-lock.json    命令与依赖锁
tsconfig*.json / vite.config.ts      TS 与测试配置
playwright.config.ts                 手机视口端到端配置
src/main.tsx                         React 挂载
src/App.tsx                          页面路由与动作提交；不放规则
src/styles.css                       竖屏主题、触控尺寸、减少动效
src/game/model.ts                    永久/本局状态与内容公共类型
src/game/seed.ts                     确定性掷骰
src/game/content/schema.ts           六份 JSON 的 Zod 结构
src/game/content/load.ts             引用与可达性校验
src/game/content/*.json              地点/事件/NPC/武学/道具/情报
src/game/engine/lifecycle.ts         入局、撤离、失败结算
src/game/engine/inventory.ts         重量、拾取、消耗
src/game/engine/events.ts            条件判定、事件选项、效果执行
src/game/engine/heat.ts              风声与警戒阶段
src/game/engine/combat.ts            六类回合动作和敌方意图
src/game/engine/martial.ts           武学标签与参悟
src/game/engine/exits.ts             五条撤离路线
src/game/engine/rumors.ts            探听、确认与主线条件
src/game/save.ts                     双份存档、导入导出与迁移
src/ui/TownScreen.tsx                安全区
src/ui/RumorScreen.tsx               情报
src/ui/PrepScreen.tsx                整备
src/ui/ExploreScreen.tsx             探索与底部抽屉
src/ui/CombatScreen.tsx              战斗
src/ui/ResultScreen.tsx              结算
src/ui/ErrorScreen.tsx               数据或存档故障的安全页
src/assets/black-wind-stronghold.png 已生成概念图的项目内副本
src/game/**/*.test.ts                纯规则与存档测试
src/ui/**/*.test.tsx                 触控/显示组件测试
e2e/full-loop.spec.ts                手机端完整流程
```

不要在早期添加空壳模块：文件在所属任务首次使用时创建。每个组件只接收已计算好的视图数据和回调，不读取或改写 JSON 内容。内容清单在 Task 16 中一次核对，但 Phase 1～6 所需条目按阶段逐步添加。六份 JSON 可有暂时较少条目，必须始终通过当期 Schema 与引用校验。

### Task 1（Phase 1）：建立可测试的 React 工程

**Files:** Create `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/App.test.tsx`; modify `.gitignore` only if构建产生未忽略文件。

- [ ] **Step 1: 建立依赖与脚本。** 仓库已有设计文档，不对非空根目录运行脚手架覆盖命令。用 `apply_patch` 建立 Vite React/TS 所需的 `index.html`、`tsconfig.json`、`vite.config.ts`、`src/main.tsx` 和下列 `package.json`，再安装依赖生成锁文件：

```json
{"name":"wuxia-extraction-rpg","private":true,"type":"module","scripts":{"dev":"vite --host 127.0.0.1","build":"tsc --noEmit && vite build","typecheck":"tsc --noEmit","test":"vitest","test:e2e":"playwright test"}}
```

```powershell
npm install react react-dom zod
npm install -D vite typescript @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

`index.html` 与 `src/main.tsx` 的完整入口：

```html
<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>江湖撤离录</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
```

`tsconfig.json` 与 `vite.config.ts` 的完整起始配置：

```json
{"compilerOptions":{"target":"ES2022","lib":["ES2022","DOM","DOM.Iterable"],"module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx","strict":true,"noEmit":true,"esModuleInterop":true,"resolveJsonModule":true,"allowSyntheticDefaultImports":true,"skipLibCheck":true},"include":["src","vite.config.ts","playwright.config.ts"]}
```

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] } });
```

- [ ] **Step 2: 写红灯入口测试。** `src/App.test.tsx` 的第一条测试使用以下内容：

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('起始页能看见青石镇和出发入口', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '青石镇' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '出发整备' })).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行 `npm test -- --run src/App.test.tsx`。** 预期先因入口文案或测试环境缺失而失败；在 `vite.config.ts` 设置 `test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] }`，并在 `src/test-setup.ts` 导入 `@testing-library/jest-dom/vitest`。
- [ ] **Step 4: 建立最小入口。** `App.tsx` 至少提供以下可运行内容；此时还不伪造探索玩法：

```tsx
export default function App() {
  return <main className="app"><h1>青石镇</h1><button type="button">出发整备</button></main>;
}
```

- [ ] **Step 5: 运行 `npm test -- --run src/App.test.tsx`、`npm run typecheck`、`npm run build`，预期全绿；提交。**

```powershell
git add index.html package.json package-lock.json tsconfig.json vite.config.ts src
git commit -m "chore: bootstrap mobile wuxia app"
```

### Task 2（Phase 1）：定义双层状态与首批内容合同

**Files:** Create `src/game/model.ts`, `src/game/content/schema.ts`, `src/game/content/load.ts`, `src/game/content/locations.json`, `src/game/content/events.json`, `src/game/content/npcs.json`, `src/game/content/martial-arts.json`, `src/game/content/items.json`, `src/game/content/rumors.json`, `src/game/content/load.test.ts`.

- [ ] **Step 1: 先写红灯测试。** 测试首版地点连通、初始出口和错误引用：

```ts
import { describe, expect, it } from 'vitest';
import { loadContent } from './load';
import locations from './locations.json';
import events from './events.json';
import npcs from './npcs.json';
import arts from './martial-arts.json';
import items from './items.json';
import rumors from './rumors.json';

const raw = { locations, events, npcs, arts, items, rumors };
describe('内容合同', () => {
  it('首批地点从山脚可达山门', () => {
    const content = loadContent(raw);
    expect(content.locations.find(x => x.id === 'foothill')?.next).toContain('gate');
  });
  it('拒绝不存在的地点引用', () => {
    expect(() => loadContent({ ...raw, locations: [{ id: 'town_square', name: '青石镇', next: [], kind: 'safe' }, { id: 'foothill', name: '山脚', next: ['missing'], kind: 'danger' }] })).toThrow(/missing/);
  });
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/content/load.test.ts`，预期因 `loadContent` 不存在而失败。**
- [ ] **Step 3: 建立模型合同。** `model.ts` 应定义这些字段与联合类型；任何新增字段先更新此合同和测试，再改规则：

```ts
export type Id = string;
export type Phase = 'town' | 'rumors' | 'prep' | 'explore' | 'combat' | 'result' | 'error';
export type Counts = Record<Id, number>;
export interface PermanentState { coins: number; stash: Counts; learnedArts: Id[]; confirmedRumors: Id[]; flags: Id[]; relations: Record<Id, number>; raids: number; }
export interface BattleState { npcId: Id; enemyHp: number; round: number; intent: 'strike' | 'heavy' | 'guard'; defending: boolean; }
export interface RunState { locationId: Id; hp: number; heat: number; coins: number; inventory: Counts; loot: Counts; pendingRumors: Id[]; flags: Id[]; seed: number; battle: BattleState | null; }
export interface GameState { phase: Phase; permanent: PermanentState; run: RunState | null; safeLocationId: Id; selectedRumorId: Id | null; lastResult: { success: boolean; coins: number; loot: Counts; rumors: Id[] } | null; }
export interface Location { id: Id; name: string; next: Id[]; kind?: 'safe' | 'danger'; }
export interface Content { locations: Location[]; events: EventDefinition[]; npcs: NpcDefinition[]; arts: ArtDefinition[]; items: ItemDefinition[]; rumors: RumorDefinition[]; }
export interface ItemDefinition { id: Id; name: string; weight: number; kind: 'consumable' | 'equipment' | 'loot' | 'quest' | 'manual'; coinValue?: number; buyPrice?: number; }
export interface NpcDefinition { id: Id; name: string; locationId: Id; hp?: number; itemsSold?: Id[]; rumorsOffered?: Id[]; }
export interface ArtDefinition { id: Id; name: string; tags: Id[]; manualItemId?: Id; technique: string; mapActions: Id[]; }
export interface RumorDefinition { id: Id; title: string; source: string; credibility: number; targetLocation: Id; valueHint: string; dangerHint: string; cost: number; confirmationFlag?: Id; }
export type Condition = { type: 'flagAbsent' | 'hasItem' | 'hasArtTag'; value: Id };
export type Effect = { type: 'move' | 'setFlag' | 'addLoot' | 'addHeat' | 'addRumor' | 'startBattle'; value: Id | number; amount?: number };
export interface EventChoice { id: Id; label: string; conditions: Condition[]; effects: Effect[]; riskHint: string; }
export interface EventDefinition { id: Id; locationId: Id; text: string; npcId?: Id; rumorId?: Id; choices: EventChoice[]; }
```

- [ ] **Step 4: 用 Zod 建立六份 JSON 的阶段性最小结构。** 首批 `locations.json` 必须包含 `town_square`（安全区）、`foothill`、`gate`，后两者双向连接；`events.json`、`npcs.json`、`martial-arts.json`、`items.json`、`rumors.json` 可先是空数组。`loadContent(raw)` 用 Zod 校验数组与 ID，并检查 `next` 引用、重复 ID 和危险区从 `foothill` 到 `gate` 的连通性；错误消息包含实体 ID 与字段路径。另导出 `loadBundledContent()`，仅负责导入六份仓库 JSON 后调用 `loadContent`，供后续引擎测试与启动页使用。最终安全区再增加 `town_inn`、`town_teahouse`、`town_clinic`、`town_market`、`town_training` 五个功能节点；NPC 的 `locationId` 必须引用其中之一。
- [ ] **Step 5: 运行本任务测试、类型检查和构建，预期全绿；提交。**

```powershell
git add src/game/model.ts src/game/content
git commit -m "feat: define game state and validated content"
```

### Task 3（Phase 1）：入局、山门撤离和结算

**Files:** Create `src/game/engine/lifecycle.ts`, `src/game/engine/lifecycle.test.ts`; modify `src/game/model.ts`.

- [ ] **Step 1: 写红灯测试，锁定永久/本局边界。**

```ts
import { expect, test } from 'vitest';
import { createGame, startRun, extract, failRun } from './lifecycle';

test('成功撤离提交本局银两且不能重复领取', () => {
  const start = startRun(createGame(), {}, 100, 123);
  expect(start.permanent.coins).toBe(400);
  const withLoot = { ...start, run: { ...start.run!, locationId: 'gate', coins: 200 } };
  const end = extract(withLoot, 'gate');
  expect(end.permanent.coins).toBe(600);
  expect(() => extract(end, 'gate')).toThrow(/本局/);
});

test('失败不提交本局银两', () => {
  const end = failRun(startRun(createGame(), {}, 100, 123));
  expect(end.permanent.coins).toBe(400);
  expect(end.run).toBeNull();
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/lifecycle.test.ts`，预期缺少导出而失败。**
- [ ] **Step 3: 实现最小纯函数。** `createGame` 初始银两为 500、`safeLocationId: 'town_square'`、空仓库和空情报；`startRun` 只从永久层扣掉携带银两/物品并创建 `foothill` 本局；`extract` 必须仅在 `phase === 'explore'` 且有本局时调用，合并剩余携带银两与 `loot`、设 `result` 并清空本局；`failRun` 不合并本局所得。不得在函数内部读写 `localStorage`。
- [ ] **Step 4: 增加移动测试。** `moveTo` 只能沿 `locations.json` 的 `next` 连接移动，不能直接跳到密室；非法移动不改变输入对象且抛出中文错误。实现 `moveTo(state, destinationId, content)`，在探索态修改 `run.locationId`，在安全区修改 `safeLocationId`，禁止通过移动跨越安全/危险区边界；在 `lifecycle.test.ts` 分别断言相邻与非相邻地点。
- [ ] **Step 5: 测试、类型检查、构建全绿；提交。**

```powershell
git add src/game/model.ts src/game/engine/lifecycle.ts src/game/engine/lifecycle.test.ts
git commit -m "feat: complete first extraction loop"
```

### Task 4（Phase 1）：连接竖屏安全区、整备、探索和结算

**Files:** Create `src/ui/TownScreen.tsx`, `src/ui/PrepScreen.tsx`, `src/ui/ExploreScreen.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/ExploreScreen.test.tsx`; modify `src/App.tsx`, `src/styles.css`.

- [ ] **Step 1: 写红灯组件测试。** 从青石镇点击“出发整备”进入整备，点击“前往黑风寨”到山脚，点击山门再撤离后看见“撤离成功”和银两结算。测试使用 `fireEvent`，不调用规则引擎私有方法。

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from '../App';

test('安全区到山门撤离形成第一条完整路径', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '出发整备' }));
  fireEvent.click(screen.getByRole('button', { name: '前往黑风寨' }));
  fireEvent.click(screen.getByRole('button', { name: '前往山门' }));
  fireEvent.click(screen.getByRole('button', { name: '从山门撤离' }));
  expect(screen.getByRole('heading', { name: '撤离成功' })).toBeInTheDocument();
});
```
- [ ] **Step 2: 运行 `npm test -- --run src/ui/ExploreScreen.test.tsx`，预期找不到出发后的页面而失败。**
- [ ] **Step 3: 用 `useState(createGame)` 持有 `GameState`。** `App` 调用 `loadBundledContent()` 取得已校验内容，四个页面根据 `phase` 渲染，并在事件处理器中调用 `startRun`、`moveTo`、`extract`；出发整备默认无物资与 0 银两，允许选择携带银两但不能超过永久余额。`ResultScreen` 通过 `lastResult` 显示本局所得，点击“返回青石镇”只切换 `phase` 不重复结算。`ExploreScreen` 对外 props 固定为 `{ description: string; choices: EventChoice[]; onChoose: (choiceId: string) => void }`，Phase 1 可从地点连接生成临时按钮，Phase 2 开始改由 `getChoices` 供应，不在组件里分支判断事件。
- [ ] **Step 4: CSS 建立 `max-width: 430px`、`min-height: 100dvh`、安全区内边距和 `button { min-height: 44px; }`；在 390×844 与 360×800 浏览器视口检查无横向滚动、按钮可触达。**
- [ ] **Step 5: 运行本任务测试、类型检查、构建；手工走一遍 Phase 1 最短路径；提交。**

```powershell
git add src/App.tsx src/styles.css src/ui
git commit -m "feat: connect mobile town-to-extraction flow"
```

### Task 5（Phase 1）：稳定节点与双份本地存档

**Files:** Create `src/game/save.ts`, `src/game/save.test.ts`; modify `src/App.tsx`.

- [ ] **Step 1: 写红灯测试。** 使用 jsdom 的 `localStorage` 测试 `saveGame`、`loadGame`：保存后 `current` 与 `lastKnownGood` 可解析；损坏 `current` 后回退到 `lastKnownGood`；两个副本都损坏时抛出可展示错误，不调用 `createGame` 静默重置。

```ts
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
```
- [ ] **Step 2: 运行 `npm test -- --run src/game/save.test.ts`，预期缺少导出而失败。**
- [ ] **Step 3: 实现 `SaveEnvelope = { schemaVersion: 1, game: GameState }`。** `saveGame(storage, game)` 先序列化到 `wuxia.pending`，读取并校验成功后，把旧 `wuxia.current` 存为 `wuxia.lastKnownGood`，最后替换 `current` 并删除 `pending`；首次保存时 `lastKnownGood` 存入同一份新档。`loadGame` 逐一验证 current、lastKnownGood；两者都不存在才返回新游戏。
- [ ] **Step 4: `App` 初始状态从 `loadGame(localStorage)` 取得；每次稳定动作提交后的下一状态调用 `saveGame`。** `loadGame` 接受可选 `onRecovery` 回调，读取 `lastKnownGood` 时显示“已恢复上一稳定存档”的非阻断提示；不用 `useEffect` 无条件保存初次渲染状态，否则会覆盖损坏存档。刷新山脚和撤离结算后，分别验证位置与银两不回退、不重复。
- [ ] **Step 5: 测试、类型检查、构建全绿；提交。**

```powershell
git add src/game/save.ts src/game/save.test.ts src/App.tsx
git commit -m "feat: persist stable game checkpoints"
```

### Task 6（Phase 2）：事件条件与仓库搜索

**Files:** Create `src/game/engine/events.ts`, `src/game/engine/events.test.ts`; modify `src/game/content/schema.ts`, `src/game/content/events.json`, `src/game/content/locations.json`, `src/game/model.ts`, `src/ui/ExploreScreen.tsx`.

- [ ] **Step 1: 写红灯测试。** 在仓库第一次选择“搜查官银”得到 `silver_ledger` 战利品，第二次不能重复获得；不在仓库时不能执行该动作；事件选项条件不满足时既不显示也不能从函数入口强行执行。

```ts
import { expect, test } from 'vitest';
import { getChoices, chooseEvent } from './events';
import { createGame, startRun } from './lifecycle';
import { loadBundledContent } from '../content/load';

test('仓库战利品只领取一次', () => {
  const content = loadBundledContent();
  const game = startRun(createGame(), {}, 0, 11);
  const atWarehouse = { ...game, run: { ...game.run!, locationId: 'warehouse' } };
  expect(getChoices(atWarehouse, content).map(x => x.id)).toContain('take_silver');
  const next = chooseEvent(atWarehouse, 'take_silver', content);
  expect(next.run?.loot.silver_ledger).toBe(1);
  expect(getChoices(next, content).map(x => x.id)).not.toContain('take_silver');
  expect(() => chooseEvent(next, 'take_silver', content)).toThrow(/不可用/);
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/events.test.ts`，预期缺少事件 API 而失败。**
- [ ] **Step 3: 配置 `warehouse` 地点与 `warehouse_search` 事件。** 事件结构固定为 `{ id, locationId, text, choices: [{ id, label, conditions, effects, riskHint }] }`；首批条件仅 `flagAbsent`、`hasItem`、`hasArtTag`，效果仅 `move`、`setFlag`、`addLoot`、`addHeat`、`addRumor`、`startBattle`。事件文案、条件和效果在 JSON，条件/效果名称在 TypeScript 白名单中。`take_silver` 要求不存在 `warehouse_looted`，效果增加 `silver_ledger` 并设置该 flag。
- [ ] **Step 4: `getChoices` 合并当前地点事件与 `locations.next` 自动生成的 `go:<locationId>` 移动选项，再过滤位置和条件；`chooseEvent` 重新校验条件，再按数组顺序执行效果并返回新状态。** `move` 效果调用 Task 3 的 `moveTo`，不可绕开连接检查。不得只依赖 UI 隐藏按钮防作弊。`ExploreScreen` 显示正文、风险提示和可用动作。
- [ ] **Step 5: 测试、类型检查、构建全绿；手工验证重复搜索无收益；提交。**

```powershell
git add src/game/content src/game/model.ts src/game/engine/events.ts src/game/engine/events.test.ts src/ui/ExploreScreen.tsx
git commit -m "feat: add data-driven search events"
```

### Task 7（Phase 2）：道具重量、携带与死亡损失

**Files:** Create `src/game/engine/inventory.ts`, `src/game/engine/inventory.test.ts`; modify `src/game/content/items.json`, `src/game/engine/lifecycle.ts`, `src/ui/PrepScreen.tsx`, `src/ui/ExploreScreen.tsx`, `src/ui/ResultScreen.tsx`.

- [ ] **Step 1: 写红灯测试，覆盖超重与死亡损失。**

```ts
import { expect, test } from 'vitest';
import { totalWeight, canCarry } from './inventory';
import { createGame, startRun, failRun } from './lifecycle';

test('超出 30 重量不能整备出发', () => {
  const items = [{ id: 'sword', name: '长剑', weight: 6 }];
  expect(totalWeight({ sword: 5 }, items)).toBe(30);
  expect(canCarry({ sword: 6 }, items, 30)).toBe(false);
});

test('死亡丢弃仓库银票但不抹除旧仓库', () => {
  const game = createGame();
  game.permanent.stash.old_token = 1;
  const run = startRun(game, {}, 0, 13);
  run.run!.loot.silver_ledger = 1;
  const end = failRun(run);
  expect(end.permanent.stash.old_token).toBe(1);
  expect(end.permanent.stash.silver_ledger).toBeUndefined();
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/inventory.test.ts`，预期缺少重量 API 而失败。**
- [ ] **Step 3: `totalWeight(counts, items)` 将数量乘单件重量求和，遇未知 ID、负数或非整数数量抛错；`canCarry` 比较上限 30。** 本局总重量必须计算 `inventory + loot` 两份 Counts；`startRun` 必须先检查仓库数量、银两余额和重量，再做扣除；拾取战利品后如超重，让玩家选择放弃本局普通战利品，不自动吞掉已得秘籍。`silver_ledger` 重量 15，成功结算按配置中的 `coinValue: 2000` 转成永久银两，失败时价值归零，不同时存入仓库。
- [ ] **Step 4: 将长剑、金疮药、飞刀、蒙面巾、官银等首批道具写入 `items.json` 并在整备页显示逐项重量。** 探索页显示 `当前/30`，结算页分别显示带回与遗失。死亡后返回安全区时不增加本局战利品。
- [ ] **Step 5: 测试、类型检查、构建全绿；提交。**

```powershell
git add src/game/engine/inventory.ts src/game/engine/inventory.test.ts src/game/engine/lifecycle.ts src/game/content/items.json src/ui
git commit -m "feat: enforce encumbrance and raid losses"
```

### Task 8（Phase 3）：风声阈值与地点警戒

**Files:** Create `src/game/engine/heat.ts`, `src/game/engine/heat.test.ts`; modify `src/game/engine/events.ts`, `src/game/content/events.json`, `src/ui/ExploreScreen.tsx`, `src/styles.css`.

- [ ] **Step 1: 写红灯边界测试。**

```ts
import { expect, test } from 'vitest';
import { addHeat, heatStage } from './heat';

test.each([[0, 'normal'], [24, 'normal'], [25, 'suspicious'], [49, 'suspicious'], [50, 'checked'], [74, 'checked'], [75, 'hunted'], [99, 'hunted'], [100, 'lockdown']])('风声 %i 属于 %s', (value, stage) => {
  expect(heatStage(value)).toBe(stage);
});
test('风声限制在 0 到 100', () => {
  expect(addHeat(95, 30)).toBe(100);
  expect(addHeat(2, -9)).toBe(0);
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/heat.test.ts`，预期缺少导出而失败。**
- [ ] **Step 3: 实现 `heatStage(heat): 'normal' | 'suspicious' | 'checked' | 'hunted' | 'lockdown'` 和 `addHeat(current, delta)`。** 事件效果中的 `addHeat` 统一调用此函数；不得直接相加。风声阶段变化生成一次性日志/播报，`50` 时山门出现盘查，`75` 时常规巡逻动作关闭，`100` 时显示全面追捕。没有事件动作时不得随真实时间暗增风声。
- [ ] **Step 4: UI 显示 `0–100` 风声、阶段文案与风险变化；动效使用 `prefers-reduced-motion` 媒体查询可关闭。** 至少加入“打斗 +25”“触发机关 +18”“静默通过 +0”三个事件选项，在界面中事前提示相对风险。
- [ ] **Step 5: 测试、类型检查、构建全绿；提交。**

```powershell
git add src/game/engine/heat.ts src/game/engine/heat.test.ts src/game/engine/events.ts src/game/content/events.json src/ui/ExploreScreen.tsx src/styles.css
git commit -m "feat: make choices raise regional heat"
```

### Task 9（Phase 4）：轻量回合战斗与敌方意图

**Files:** Create `src/game/engine/combat.ts`, `src/game/engine/combat.test.ts`; modify `src/game/model.ts`, `src/game/content/npcs.json`, `src/game/content/events.json`, `src/game/engine/events.ts`, `src/game/engine/lifecycle.ts`.

- [ ] **Step 1: 写红灯测试。** 与二当家交战时，敌方意图为 `heavy` 则防御显著减伤；普通攻击会造成可预测伤害；撤退返回探索并增加风声；气血降至 0 调用失败结算。

```ts
import { expect, test } from 'vitest';
import { resolveTurn } from './combat';
import { createGame, startRun } from './lifecycle';

test('重击前防御减伤', () => {
  const base = startRun(createGame(), {}, 0, 29);
  const battle = { ...base, phase: 'combat' as const, run: { ...base.run!, battle: { npcId: 'second_chief', enemyHp: 36, round: 1, intent: 'heavy' as const, defending: false } } };
  const attack = resolveTurn(battle, { type: 'attack' });
  const defend = resolveTurn(battle, { type: 'defend' });
  expect(defend.run!.hp).toBeGreaterThan(attack.run!.hp);
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/combat.test.ts`，预期缺少 `resolveTurn` 而失败。**
- [ ] **Step 3: 定义 `CombatAction` 为 `attack | technique | defend | movement | item | retreat`，每次 `resolveTurn` 先解玩家动作、再解敌人预告意图、再用种子抽取下一意图。** 基础攻击固定 8 点；防御使本回合伤害减半向下取整；身法对重击减伤；金疮药恢复 20 点且不超过 100；撤退增加风声 15 并离开战斗。所有动作都只能在 `phase === 'combat'` 时执行，物品不足时抛错且原状态不变。
- [ ] **Step 4: `npcs.json` 加入二当家战斗数据 `hp: 36`、固定意图池与可读标签；事件效果 `startBattle` 进入战斗。** 胜利设置 `second_chief_defeated` 并回探索，失败调用 `failRun`。此阶段掉落先是普通物资，不提前实现血刀经链。
- [ ] **Step 5: 覆盖六类动作的单测后运行类型检查和构建；提交。**

```powershell
git add src/game/model.ts src/game/engine/combat.ts src/game/engine/combat.test.ts src/game/engine/events.ts src/game/engine/lifecycle.ts src/game/content/npcs.json src/game/content/events.json
git commit -m "feat: add readable turn-based combat"
```

### Task 10（Phase 4）：战斗界面与死亡反馈

**Files:** Create `src/ui/CombatScreen.tsx`, `src/ui/CombatScreen.test.tsx`; modify `src/App.tsx`, `src/ui/ResultScreen.tsx`, `src/styles.css`.

- [ ] **Step 1: 写红灯组件测试。** 显示玩家/敌方气血、敌方意图和六类动作；当 `intent === 'heavy'` 时界面有“蓄势重击”；药品为 0 时道具按钮禁用并解释原因；死亡结算显示丢失的本局所得。

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CombatScreen } from './CombatScreen';

test('重击意图可读，缺药时道具不可用', () => {
  render(<CombatScreen battle={{ npcId: 'second_chief', enemyHp: 36, round: 1, intent: 'heavy', defending: false }} hp={72} items={{}} availableTechniques={[]} onAction={vi.fn()} />);
  expect(screen.getByText(/蓄势重击/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /使用道具/ })).toBeDisabled();
});
```
- [ ] **Step 2: 运行 `npm test -- --run src/ui/CombatScreen.test.tsx`，预期缺少组件而失败。**
- [ ] **Step 3: `CombatScreen` 只接收 `battle`、`hp`、`items`、`availableTechniques` 和 `onAction`，使用 `<button type="button">` 提交 `CombatAction`。** `App` 将动作交给 `resolveTurn`，对返回值执行同一稳定节点保存。敌方意图和伤害变化使用文字播报区域 `aria-live="polite"`。
- [ ] **Step 4: 结果页按 `success` 显示“撤离成功”或“此行失手”，列出本局失去项，提供“再次整备”入口。** 360×800 竖屏检查所有动作可滚动、没有被底部安全区遮挡。
- [ ] **Step 5: 测试、类型检查、构建全绿；手工通过战斗胜利和死亡各一次；提交。**

```powershell
git add src/App.tsx src/ui/CombatScreen.tsx src/ui/CombatScreen.test.tsx src/ui/ResultScreen.tsx src/styles.css
git commit -m "feat: present tactical combat on mobile"
```

### Task 11（Phase 5）：武学标签、招式和参悟

**Files:** Create `src/game/engine/martial.ts`, `src/game/engine/martial.test.ts`; modify `src/game/model.ts`, `src/game/content/martial-arts.json`, `src/game/content/schema.ts`, `src/game/engine/combat.ts`, `src/ui/TownScreen.tsx`, `src/ui/CombatScreen.tsx`.

- [ ] **Step 1: 写红灯测试。**

```ts
import { expect, test } from 'vitest';
import { artTags, learnArt, counterBonus } from './martial';
import { createGame } from './lifecycle';

test('燕回身提供轻功标签而非等级数字', () => {
  expect(artTags(['swallow_step'])).toContain('lightness');
});
test('太极剑的柔与后发克制刚猛先手', () => {
  expect(counterBonus(['soft', 'counter'], ['hard', 'first'])).toBeGreaterThan(0);
});
test('没有带回秘籍不能参悟', () => {
  expect(() => learnArt(createGame(), 'swallow_step')).toThrow(/秘籍/);
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/martial.test.ts`，预期缺少武学 API 而失败。**
- [ ] **Step 3: 在 `martial-arts.json` 定义六门武学的稳定 ID、中文名、2～4 个标签、一个战斗招式、一个或多个地图能力与 `manualItemId`。** `artTags` 合并已学武学标签并去重；`counterBonus` 实现 `soft` 对 `hard`、`counter` 对 `first`、`movement` 对 `locked` 的固定额外效果；`learnArt` 检查仓库秘籍、扣除秘籍并把武学 ID 加入 `learnedArts`，重复参悟抛错。
- [ ] **Step 4: 将 `technique` 和 `movement` 接入 `combat.ts`，只允许已学招式；安全区“练功地点”列出可参悟秘籍和缺少条件的原因。** `createGame` 从本阶段起默认掌握基础剑法；载入旧档时若缺少基础剑法，在存档迁移中补入，不能重置其他成长。西仓事件可取得 `swallow_manual`，水道入口事件可取得 `breath_manual`，均需带回后参悟，以便重访测试。身份系统做最小闭环：战斗中使用带流派标识的显眼招式且目击者逃走，会记录 `witnessed_style:<artId>`，青石镇传闻页出现“疑似某派招式”的未确认情报，并使相应盘查难度上升；没有完整门派声望树。
- [ ] **Step 5: 测试、类型检查、构建全绿；手工在练功地点参悟并重进寨；提交。**

```powershell
git add src/game/model.ts src/game/content/martial-arts.json src/game/content/schema.ts src/game/engine/martial.ts src/game/engine/martial.test.ts src/game/engine/combat.ts src/ui/TownScreen.tsx src/ui/CombatScreen.tsx
git commit -m "feat: make martial arts unlock multiple capabilities"
```

### Task 12（Phase 6）：五条条件撤离路线

**Files:** Create `src/game/engine/exits.ts`, `src/game/engine/exits.test.ts`, `src/game/seed.ts`; modify `src/game/model.ts`, `src/game/engine/lifecycle.ts`, `src/game/content/locations.json`, `src/ui/ExploreScreen.tsx`.

- [ ] **Step 1: 写红灯矩阵测试。** 依次覆盖山门、悬崖、水道、商队、后山密道的开放条件和代价；每条路线在锁定时返回可展示原因而非消失。重点测试商队 `49/50/64/65/79/80` 六个边界。

```ts
import { expect, test } from 'vitest';
import { evaluateExit } from './exits';

test.each([[49, 'open'], [50, 'roll4'], [64, 'roll4'], [65, 'roll5'], [79, 'roll5'], [80, 'closed']])('商队在风声 %i 的状态为 %s', (heat, status) => {
  expect(evaluateExit('caravan', { locationId: 'foothill', heat, hasDisguise: true, coins: 200, tags: [], load: 10, hasTunnelMap: false, ally: false }).status).toBe(status);
});
test('没有轻功时悬崖不可走', () => {
  expect(evaluateExit('cliff', { locationId: 'back_hill', heat: 20, hasDisguise: false, coins: 0, tags: [], load: 10, hasTunnelMap: false, ally: false }).status).toBe('closed');
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/exits.test.ts`，预期缺少出口 API 而失败。**
- [ ] **Step 3: `evaluateExit` 返回 `{ status, reason, costCoins, droppedItemIds }`。** 出口必须先到对应位置：山门=`gate`、悬崖=`back_hill`、水道=`waterway`、商队=`foothill`、后山密道=`back_hill`。位置不符时在局势抽屉显示路线但不可执行。具体规则：山门始终可尝试，风声 `≥50` 需额外战斗或盘查事件；悬崖需 `lightness` 且负重 `≤20`；水道需 `breath`，离开时丢弃一件最重的普通战利品；商队需蒙面/易容类伪装与 `200` 两银；后山密道需 `tunnel_map` 情报或 `prisoner` 关系 `≥1`。所有代价在确认前显示。
- [ ] **Step 4: `src/game/seed.ts` 提供 `rollD6(seed): { value: 1|2|3|4|5|6; nextSeed: number }`，使用 `nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0`，`value = (nextSeed % 6) + 1`。** 商队 `50–79` 时 UI 必须由玩家点击“掷骰争取通行”触发；成功提交撤离，失败扣 `200` 两、风声 `+10`、保留本局并保存新种子。刷新后不能回到旧种子再次投同一骰。商队低风声也必须消耗车资与伪装道具条件。水道掉物与掷骰均进入结果页明细。
- [ ] **Step 5: 测试、类型检查、构建全绿；逐条路线手工验证锁定原因和结果；提交。**

```powershell
git add src/game/seed.ts src/game/model.ts src/game/engine/exits.ts src/game/engine/exits.test.ts src/game/engine/lifecycle.ts src/game/content/locations.json src/ui/ExploreScreen.tsx
git commit -m "feat: add conditional extraction routes"
```

### Task 13（Phase 7）：探听、可信度与确认情报

**Files:** Create `src/game/engine/rumors.ts`, `src/game/engine/rumors.test.ts`, `src/ui/RumorScreen.tsx`, `src/ui/RumorScreen.test.tsx`; modify `src/game/model.ts`, `src/game/content/rumors.json`, `src/game/content/schema.ts`, `src/App.tsx`, `src/ui/TownScreen.tsx`.

- [ ] **Step 1: 写红灯规则测试。** 玩家支付茶馆费用得到传闻但未确认；入寨调查后确认同一条情报；死亡只保留 `confirmedRumors`，普通未确认 `pendingRumors` 丢失；已知情报不重复扣费。

```ts
import { expect, test } from 'vitest';
import { hearRumor, confirmRumor } from './rumors';
import { createGame, startRun, failRun } from './lifecycle';

test('确认过的线索在失败后仍保留', () => {
  const heard = hearRumor(createGame(), 'western_scripture');
  const raid = startRun(heard, {}, 0, 7);
  const observed = { ...raid, run: { ...raid.run!, flags: ['warehouse_script_seen'] } };
  const confirmed = confirmRumor(observed, 'western_scripture');
  expect(failRun(confirmed).permanent.confirmedRumors).toContain('western_scripture');
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/rumors.test.ts`，预期缺少情报 API 而失败。**
- [ ] **Step 3: 情报记录含 `id/title/source/credibility/targetLocation/valueHint/dangerHint/cost/confirmationFlag`。** `western_scripture.confirmationFlag` 固定为 `warehouse_script_seen`。`hearRumor` 仅在安全区执行且扣固定费用；`confirmRumor` 只能在满足对应 `confirmationFlag` 后执行，重要情报在确认瞬间写入永久层。普通未确认情报保持本局临时状态，仅成功撤离合并。
- [ ] **Step 4: `RumorScreen` 将来源、可信度、目标地点和危险展示清楚，并允许选择追查目标。** 测试一条可信度较低的假线索不会被 UI 直接标作“已证实”；青石镇茶馆、黑市与 NPC 对话入口都能获得对应线索。
- [ ] **Step 5: 测试、类型检查、构建全绿；提交。**

```powershell
git add src/game/model.ts src/game/content/rumors.json src/game/content/schema.ts src/game/engine/rumors.ts src/game/engine/rumors.test.ts src/ui/RumorScreen.tsx src/ui/RumorScreen.test.tsx src/ui/TownScreen.tsx src/App.tsx
git commit -m "feat: track heard and confirmed intelligence"
```

### Task 14（Phase 7）：血刀经获取链与“贪或撤”节点

**Files:** Modify `src/game/content/events.json`, `src/game/content/locations.json`, `src/game/content/items.json`, `src/game/content/rumors.json`, `src/game/engine/events.ts`, `src/game/engine/events.test.ts`, `src/ui/ExploreScreen.tsx`.

- [ ] **Step 1: 写红灯流程测试。** 未获得二当家行踪线索时无法直接发现独行时机；击败二当家后取得 `blood_blade_page`、风声 `+30`；此时撤离可带回残页；继续进密室获得 `heir_location` 后风声至少 `75`、山门风险升级。

```ts
test('得残页后可以选择继续追线索', () => {
  const content = loadBundledContent();
  const raid = startRun(createGame(), {}, 0, 41);
  const afterFight = { ...raid, run: { ...raid.run!, locationId: 'second_chief_room', flags: ['second_chief_defeated', 'second_chief_schedule'] } };
  const withPage = chooseEvent(afterFight, 'take_blood_page', content);
  expect(withPage.run?.loot.blood_blade_page).toBe(1);
  expect(getChoices(withPage, content).map(choice => choice.id)).toContain('enter_chief_secret');
});
```

该测试文件继续从 `./events` 导入 `chooseEvent/getChoices`，从 `./lifecycle` 导入 `createGame/startRun`，从 `../content/load` 导入 `loadBundledContent`。
- [ ] **Step 2: 运行 `npm test -- --run src/game/engine/events.test.ts`，预期新增剧情断言失败。**
- [ ] **Step 3: 配置事件顺序：茶馆 `western_scripture` → 西仓观察 `second_chief_schedule` → 二当家房间战斗 → 残页 → 密室异响 → 可选继续/撤离 → 传人位置。** 事件中的 `conditions` 和 `effects` 必须采用 Task 6 白名单；若新增 `confirmRumor` 或 `grantManual` 效果，先添加 Schema、处理器和对应单测。不得把完整剧情判断硬编码在 `ExploreScreen`。
- [ ] **Step 4: 在取得残页的动作结果中同时显示“立即撤离”与“继续探索密室”的明确双选；展示当前风声、药品、气血、负重和开放出口。** 继续探索的风险提示要足够明确但不泄露全部奖励。刷新节点后重试不得重复获得残页。
- [ ] **Step 5: 规则测试、类型检查、构建全绿；手工走两条分支；提交。**

```powershell
git add src/game/content src/game/engine/events.ts src/game/engine/events.test.ts src/ui/ExploreScreen.tsx
git commit -m "feat: complete blood blade manuscript heist"
```

### Task 15（Phase 7）：最低内容量全部进入可达玩法

**Files:** Modify six份 `src/game/content/*.json`, `src/game/content/load.ts`, `src/game/content/load.test.ts`; create `src/game/content/coverage.test.ts`.

- [ ] **Step 1: 写红灯内容覆盖测试。** 断言 `npcs.length >= 10`、`arts.length >= 6`、`rumors.length >= 20`、`items.length >= 10`，并对每个 NPC/情报/道具/武学验证至少一个可达事件、交易、战斗、参悟或撤离消费者；只增加列表行不算达标。

```ts
import { expect, test } from 'vitest';
import { loadBundledContent, findConsumers } from './load';

test('内容达到下限且每个条目进入玩法', () => {
  const content = loadBundledContent();
  expect(content.npcs.length).toBeGreaterThanOrEqual(10);
  expect(content.arts.length).toBeGreaterThanOrEqual(6);
  expect(content.rumors.length).toBeGreaterThanOrEqual(20);
  expect(content.items.length).toBeGreaterThanOrEqual(10);
  for (const entry of [...content.npcs, ...content.arts, ...content.rumors, ...content.items]) {
    expect(findConsumers(content, entry.id).length, entry.id).toBeGreaterThan(0);
  }
});
```
- [ ] **Step 2: 运行 `npm test -- --run src/game/content/coverage.test.ts`，预期数量或可达性失败。**
- [ ] **Step 3: 按以下固定清单填写内容并核对使用路径。** 黑风寨八个危险节点 ID 固定为 `foothill`、`gate`、`warehouse`、`prisoner_cell`、`second_chief_room`、`chief_secret`、`back_hill`、`waterway`；青石镇六个安全节点为 `town_square` 加五个功能点。

| 类别 | ID → 参与玩法 |
| --- | --- |
| NPC（11） | `innkeeper` 客栈恢复；`storyteller` 茶馆传闻；`physician` 药铺；`broker` 黑市；`trainer` 参悟；`caravan_master` 商队；`gate_guard` 盘查；`warehouse_guard` 巡逻；`prisoner` 密道关系；`second_chief` 主线战斗；`chief` 高风声追捕 |
| 武学（6） | `basic_sword` 基础攻击；`wild_blade` 爆发；`taiji_sword` 卸力反击；`swallow_step` 屋顶/悬崖；`turtle_breath` 水下/水道；`acupoint` 控制/无声制服 |
| 道具（15） | `sword` 武器；`medicine` 治疗；`throwing_knife` 投掷；`mask` 伪装；`rope` 地形；`lantern` 暗处搜索；`smoke_bomb` 脱战；`silver_ledger` 仓库战利品；`blood_blade_page` 主线秘籍；`tunnel_map` 密道；`swallow_manual` 参悟；`breath_manual` 参悟；`wild_manual` 参悟；`taiji_manual` 参悟；`acupoint_manual` 参悟 |
| 情报（20） | `western_scripture` 经书；`second_chief_schedule` 独行；`west_warehouse` 仓库；`chief_return` 寨主归期；`heir_location` 传人；`tunnel_entrance` 密道；`water_channel` 水道；`cliff_path` 悬崖；`caravan_departure` 商队；`gate_shift` 换岗；`prisoner_name` 囚犯；`guard_bribe` 守卫受贿；`hidden_cell` 暗牢；`roof_beam` 屋梁；`alarm_bell` 警铃；`medicine_cache` 药箱；`smuggler_mark` 私货；`blood_script_origin` 经书来源；`chief_secret` 密室；`false_scroll` 假卷 |

- [ ] **Step 4: `loadContent` 做引用完整性和图可达性检查。** 每个内容 ID 都有至少一个实际消费者；允许假情报指向误导事件，但不能指向不存在的地点。`town_square` 双向连接客栈、茶馆、药铺、黑市、练功处五个安全节点；青石镇通过 `innkeeper` 恢复气血、`physician` 购买药、`broker` 购买工具、`trainer` 参悟、`storyteller` 探听；黑风寨 NPC 分别由巡逻、对话、战斗、关系、追捕事件引用，不能只出现在图鉴。确认主线能在无额外武学时取得残页并经山门撤离；特殊路线在获得相应能力后可重返使用。
- [ ] **Step 5: 内容测试、所有规则测试、类型检查、构建全绿；提交。**

```powershell
git add src/game/content
git commit -m "feat: fill playable MVP content floor"
```

### Task 16（Phase 7）：存档导入、导出与故障安全页

**Files:** Create `src/ui/ErrorScreen.tsx`, `src/ui/ErrorScreen.test.tsx`; modify `src/game/save.ts`, `src/game/save.test.ts`, `src/App.tsx`, `src/main.tsx`, `src/ui/TownScreen.tsx`.

- [ ] **Step 1: 写红灯存档测试。** 旧版本 `schemaVersion: 0` 迁移到 1；非法 JSON、未来版本、缺失永久层字段均返回明确错误且不碰原 `current`；正确导入必须由 UI 二次确认后才替换。

```ts
import { expect, test } from 'vitest';
import { parseImport } from './save';

test('拒绝未来版本而不产生可提交状态', () => {
  expect(() => parseImport('{"schemaVersion":99,"game":{}}')).toThrow(/版本/);
});
test('拒绝非 JSON', () => {
  expect(() => parseImport('{')).toThrow(/JSON/);
});
```

- [ ] **Step 2: 运行 `npm test -- --run src/game/save.test.ts`，预期新增导入断言失败。**
- [ ] **Step 3: `parseImport(text)` 只解析、校验、迁移并返回 `GameState`，不得写入 Storage；`exportSave(game)` 生成可下载的 UTF-8 JSON；`commitImport(storage, parsedGame)` 调用 Task 5 的原子 `saveGame`。** 版本 0 迁移只补充已知缺省字段，不猜测缺失主线进度；不可迁移时保留原档并报错。
- [ ] **Step 4: 安全区“存档”抽屉包含“导出”“导入”与二次确认；`ErrorScreen` 按可恢复情况显示“恢复上一存档”“导出诊断”“返回标题”“重新开始”。** `main.tsx` 在挂载 `App` 前调用 `loadBundledContent()` 并捕获异常；异常时只挂载 `ErrorScreen`，不启动游戏引擎。重新开始必须二次确认，且将旧存档作为可下载备份后再覆盖。内容校验失败应进入安全页，不继续加载半坏内容。
- [ ] **Step 5: 保存/组件测试、类型检查、构建全绿；手工导出再导入，并试损坏文件；提交。**

```powershell
git add src/game/save.ts src/game/save.test.ts src/App.tsx src/main.tsx src/ui/ErrorScreen.tsx src/ui/ErrorScreen.test.tsx src/ui/TownScreen.tsx
git commit -m "feat: recover and exchange local saves safely"
```

### Task 17（Phase 7）：将已确认的竖屏美术落到可读 UI

**Files:** Create `src/assets/black-wind-stronghold.png`, `src/ui/ExploreScreen.accessibility.test.tsx`; modify `src/styles.css`, `src/ui/ExploreScreen.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/TownScreen.tsx`.

- [ ] **Step 1: 用 `apply_patch` 先加可访问性测试。** 探索页图像是装饰性背景，正文和选择必须真实存在于 DOM；按钮高至少 44 CSS px；`prefers-reduced-motion` 时风声和卷页过渡为 0；关键结果由 `aria-live` 或页面标题宣告。组件单测断言真实文字与语义按钮，触控高度和动画偏好在 Task 18 的浏览器测试中断言。

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ExploreScreen } from './ExploreScreen';

test('场景文字与行动是可读取的 DOM 内容', () => {
  render(<ExploreScreen description="寨主已经回山。" choices={[{ id: 'leave', label: '携残页撤离', riskHint: '安全', conditions: [], effects: [] }]} onChoose={() => {}} />);
  expect(screen.getByText('寨主已经回山。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '携残页撤离' })).toBeInTheDocument();
});
```
- [ ] **Step 2: 运行 `npm test -- --run src/ui/ExploreScreen.accessibility.test.tsx`，预期新增测试先失败。**
- [ ] **Step 3: 从既有生成图复制项目资产：`C:\Users\sword\.codex\generated_images\01a0a12a-346a-74c0-b3e4-c22704397a68\exec-30a8b2c8-ac31-44e2-879e-b82a4d0dc32c.png` → `src/assets/black-wind-stronghold.png`。** 若源图不在，先检查 `.superpowers/brainstorm/wuxia-mvp-20260915/content/black-wind-stronghold-concept.png`；两者均不存在时不要放空路径，应明确告知用户需要重新生成。复制前检查图片无伪文字、水印和现代物件；复制后在 360×800、390×844、430×932 检查裁切。
- [ ] **Step 4: CSS 使用图片上半屏 + 下半屏墨色渐隐、朱砂风险色和金褐收益色；正文与按钮保持代码渲染。** 状态条、抽屉和底部操作遵循安全区；在深色背景验证文本对比与长中文换行。只给风声跨阶段和秘籍获得添加短动效，`@media (prefers-reduced-motion: reduce)` 关闭动效。音效默认关闭并有独立设置，不自动播放。
- [ ] **Step 5: 组件测试、类型检查、构建全绿；手工竖屏审查并提交。**

```powershell
git add src/assets/black-wind-stronghold.png src/styles.css src/ui
git commit -m "feat: apply illustrated mobile wuxia direction"
```

### Task 18（Phase 7）：手机端完整流程与发布检查

**Files:** Create `playwright.config.ts`, `e2e/full-loop.spec.ts`, `README.md`; modify `package.json` only for E2E 启动脚本。

- [ ] **Step 1: 配置 Playwright `webServer` 启动 `npm run dev`，使用移动视口 `390×844` 和触控。** 测试前通过 `page.addInitScript` 清空当前测试 origin 的存档键，测试之间使用独立 context，不能共享角色进度。
- [ ] **Step 2: 写四条 E2E 红灯场景：** ① 探听→整备→残页→撤离→参悟→再次入局；② 第一局带回燕回身秘籍并参悟、第二局继续密室→高风声→悬崖撤离；③ 死亡后本局战利品消失、已学武学与确认情报仍在；④ 刷新恢复稳定节点、坏存档导入不覆盖当前档。每条断言实际文案、风声/物品变化与页面状态，不只断言 URL。第一条测试骨架如下，其余三条以相同真实 UI 入口逐步执行，不能直接注入内部状态：

```ts
import { expect, test } from '@playwright/test';

test('黑风寨残页可以撤离并带回青石镇', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '查看可用情报' }).click();
  await page.getByText('西域经书的传闻').click();
  await page.getByRole('button', { name: '追查此线索' }).click();
  await page.getByRole('button', { name: '前往黑风寨' }).click();
  await expect(page.getByText('风声')).toBeVisible();
  await expect(page.getByRole('button', { name: /撤离/ })).toBeVisible();
  expect(errors).toEqual([]);
});
```
- [ ] **Step 3: 运行 `npm run test:e2e`，观察失败点，按源头修复规则、配置或 UI；不以删断言、加任意长等待来制造绿灯。** 对随机测试注入固定 `seed`，商队掷骰失败和成功都要有确定性覆盖。添加 `page.on('pageerror', ...)` 令浏览器异常直接使测试失败。
- [ ] **Step 4: `README.md` 写明 `npm ci`、`npm run dev`、`npm test -- --run`、`npm run test:e2e`、`npm run build`，以及“浏览器本地存档，清浏览器数据会丢失，请导出备份”。** 明确首版只有青石镇和黑风寨、不含账户与云同步。
- [ ] **Step 5: 在手机视口手工完成两局；执行以下发布门槛，预期全绿、无未处理异常；提交。**

```powershell
npm ci
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
git diff --check
```

```powershell
git add playwright.config.ts e2e/full-loop.spec.ts README.md package.json package-lock.json
git commit -m "test: verify complete mobile extraction loop"
```

## 需求覆盖自查表

| 设计要求 | 对应任务 / 验收 |
| --- | --- |
| 安全区→出发→危险区→撤离→结算 | 1–5，Phase 1 最短路径 |
| 搜索、战利品、重量、死亡损失 | 6–7 |
| 风声 0–100、阈值、追捕 | 8 |
| 六类回合动作、意图、标签策略 | 9–11 |
| 六门武学、参悟与重游 | 11、15、18 |
| 五条撤离路线与商队投骰 | 12、18 |
| 情报可信度、确认、血刀经链 | 13–15 |
| 10+ NPC、6+ 武学、20+ 情报、10+ 道具 | 15 的可达性测试 |
| 本地自动存档、双份恢复、导入导出 | 5、16、18 |
| 竖屏“图文各半”、朱印侠录与减少动效 | 4、17、18 |
| 配置校验、错误页、规则/组件/E2E 测试 | 2、5、15–18 |

## 不扩张事项

完成这 18 个任务前不添加其他地图、门派、经脉、账号、后端、联机、装备强化或程序生成剧情。扩内容先改 JSON 并运行内容覆盖/引用测试；改规则先加红灯测试。设计文档中的用户未提交修改独立保留，除非用户要求，不要把它混进计划或实现提交。
