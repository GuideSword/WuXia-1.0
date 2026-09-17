# Unique Manuals, Insights, and Qingyan Ruins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make books and unique quest items persist as individual objects, let authored manuscripts teach distinct insights, make failure an item-aware rescue, and add Qingyan Ruins as a second exploration map.

**Architecture:** Static content defines each unique copy and its original source; one game-state registry owns its current location. The run owns only transient danger state such as hiding and patrol progress. Reading changes permanent knowledge without consuming the physical copy. Region-aware content and exits keep Blackwind Fort and Qingyan Ruins separate.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Zod 4, Vitest 5, Playwright.

---

## Working conditions and file map

Read the approved design first: `docs/superpowers/specs/2026-09-18-unique-manuals-and-insights-design.md`. The working tree already contains unrelated, uncommitted onboarding and UI edits. Preserve them. Before each commit, stage only the task's hunks with `git add -p` where a file was already dirty; inspect `git diff --cached` before committing. Do not reset, clean, or overwrite these edits.

This is one sequential plan because all four player-facing changes share the same physical-copy registry. Each task has a focused, testable result and commits only after its affected tests pass.

| Unit | Files | Responsibility |
| --- | --- | --- |
| Content contract | `src/game/model.ts`, `src/game/content/schema.ts`, `src/game/content/load.ts`, `src/game/content/copies.json`, `src/game/content/locations.json`, `src/game/content/events.json`, `src/game/content/npcs.json`, `src/game/content/rumors.json`, `src/game/content/items.json`, `src/game/content/martial-arts.json` | Define unique copies, region ownership, source rules, and authored insights. |
| Copy registry | `src/game/engine/copies.ts` | Validate and move one physical copy between source, run bag, pocket, home, and lost site. |
| Knowledge | `src/game/engine/martial.ts`, `src/game/engine/study.ts`, `src/game/engine/combat.ts`, `src/game/engine/exits.ts` | Read without consuming, record one insight per authored text, and expose its actual effects. |
| Lifecycle | `src/game/engine/lifecycle.ts`, `src/game/engine/events.ts`, `src/game/engine/inventory.ts`, `src/game/engine/shop.ts`, `src/game/engine/rumors.ts` | Pickup, region entry, extraction, rescue, carry placement, and one-copy NPC transfers. |
| Persistence | `src/game/save.ts` | Version 2 migration and single-location validation. |
| UI and guidance | `src/App.tsx`, `src/ui/PrepScreen.tsx`, `src/ui/ExploreScreen.tsx`, `src/ui/TownScreen.tsx`, `src/ui/ResultScreen.tsx`, `src/game/onboarding.ts`, `src/styles.css` | Region choice, hiding, study, pocket actions, copy locations, rescue details, and context-aware tutorial. |
| Verification | Adjacent `*.test.ts(x)` files and `e2e/full-loop.spec.ts` | Guard persistent uniqueness, learning order, rescue, migration, and both maps. |

Use these stable identifiers throughout the plan: `swallow_biaoshi_copy` (Blackwind manuscript), `swallow_original_copy` (Qingyan original), `blood_page_copy`, `tunnel_map_copy`, `insight_borrow_wall`, `insight_soft_landing`, and region IDs `blackwind` and `qingyan`.

## Task 1: Define individual copies and region-owned content

**Files:** Create `src/game/content/copies.json`; modify `src/game/model.ts`, `src/game/content/schema.ts`, `src/game/content/load.ts`, `src/game/content/locations.json`, `src/game/content/items.json`; test `src/game/content/load.test.ts`.

- [ ] **Step 1: Write a failing content test.** Assert `loadBundledContent().copies` contains the two燕回身 versions with different `insightId`s; duplicate `copyId`, nonexistent `itemId`/`artId`/source location, or two available manuscripts at one location must throw. Assert every dangerous location has a `regionId` and every edge stays in that region.

```ts
const content = loadBundledContent();
expect(content.copies.filter((copy) => copy.artId === 'swallow_step').map((copy) => copy.insightId))
  .toEqual(expect.arrayContaining(['insight_borrow_wall', 'insight_soft_landing']));
expect(() => loadContent({ ...raw, copies: [...content.copies, content.copies[0]] })).toThrow(/重复/);
```

- [ ] **Step 2: Verify red.** Run `npm test -- --run src/game/content/load.test.ts`; expect the new assertions to fail because `copies` and `regionId` are absent.
- [ ] **Step 3: Add the content contract.** Extend `Content` and Zod together; use one item ID per physical copy and retain legacy item IDs solely for save migration. A complete copy record has this shape:

```ts
export interface CopyDefinition {
  id: Id; itemId: Id; sourceLocationId: Id; author: string;
  artId?: Id; insightId?: Id; title: string;
  requiresLight: boolean; requiresPracticeSpace: boolean;
}
export interface Location {
  id: Id; name: string; next: Id[]; kind: 'safe' | 'danger';
  regionId?: 'blackwind' | 'qingyan'; description: string; requiresFlag?: Id;
  light?: boolean; practiceSpace?: boolean; patrolPeriod?: number;
}
```

Define both燕回身 copies, `blood_page_copy`, and `tunnel_map_copy` in `copies.json`; mark the latter two as quest items by omitting `artId` and `insightId`. Add the Qingyan gate, corridor, and hall as connected, region-tagged content now, but do not expose Qingyan as a startable raid until Task 7. `loadContent` must reject an insight without an art, an unknown item or source, cross-region edges, and multiple active manuscript sources at the same initial scene. Update `findConsumers` so copy sources satisfy item/content coverage tests.
- [ ] **Step 4: Verify green and commit.** Run `npm test -- --run src/game/content/load.test.ts src/game/content/coverage.test.ts` and `npm run typecheck`; expect passes. Stage only these files and commit `feat: define authored manual copies`.

## Task 2: Establish one authoritative copy registry and save migration

**Files:** Create `src/game/engine/copies.ts`, `src/game/engine/copies.test.ts`; modify `src/game/model.ts`, `src/game/engine/lifecycle.ts`, `src/game/save.ts`, `src/game/save.test.ts`.

- [ ] **Step 1: Write failing registry and migration tests.** A fresh save puts every copy at its source; moving a copy to a bag removes it from source; moving it twice throws; an imported version-1 save with `swallow_manual: 3`, existing `learnedArts`, and unrelated coins retains all three legacy books and the original coins. An active version-1 raid holding `blood_blade_page` must not leave `blood_page_copy` at source.

```ts
const game = createGame();
const taken = moveCopy(game, 'swallow_biaoshi_copy', { kind: 'bag' });
expect(taken.permanent.copyPositions.swallow_biaoshi_copy).toEqual({ kind: 'bag' });
expect(() => moveCopy(taken, 'swallow_biaoshi_copy', { kind: 'bag' })).toThrow(/来源/);
```

- [ ] **Step 2: Verify red.** Run `npm test -- --run src/game/engine/copies.test.ts src/game/save.test.ts`; expect missing registry/fields.
- [ ] **Step 3: Add a single position field and guarded transitions.** `PermanentState.copyPositions` maps each `copyId` to `{kind:'source'|'bag'|'pocket'|'home'|'lost', locationId?:Id}`; `learnedInsights: Id[]` records permanent insight IDs. Export `copyAtSource`, `copiesAt`, `moveCopy(state, copyId, destination, expectedOrigin)`, and `assertCopyRegistry(state, content)` from `copies.ts`. `moveCopy` must fail when origin differs, when a lost copy is recovered from the wrong scene, or when a run-only destination is used without `run`. Do not also store new copy IDs inside `stash`, `inventory`, or `loot`; those Counts remain for ordinary and legacy objects. Update `runWeight` to add each carried copy's `itemId` weight exactly once.

```ts
export type CopyPosition =
  | { kind: 'source' | 'bag' | 'pocket' | 'home' }
  | { kind: 'lost'; locationId: Id };

export function moveCopy(state: GameState, copyId: Id, to: CopyPosition, from: CopyPosition): GameState {
  const actual = state.permanent.copyPositions[copyId];
  if (actual?.kind !== from.kind || (actual.kind === 'lost' &&
    actual.locationId !== (from.kind === 'lost' ? from.locationId : undefined)))
    throw new Error('秘籍已不在预期来源');
  if (['bag', 'pocket'].includes(to.kind) && !state.run) throw new Error('当前没有探索行囊');
  return { ...state, permanent: { ...state.permanent,
    copyPositions: { ...state.permanent.copyPositions, [copyId]: to } } };
}
```
- [ ] **Step 4: Save version 2 and legacy conversion.** Add `schemaVersion: 2`; accept versions 0 and 1 through their existing schemas, then normalize into version 2. Initialize missing copy positions to `source`, map one legacy held copy or quest item to the new `home`/`bag` position, leave excess same-title legacy counts in stash/loot, and retain learned art IDs, coins, relationships, rumors, raid number, current location, and tutorial flags. For an existing version-2 save written before a new content copy was introduced, insert only the newly defined missing copy IDs at `source`; reject unknown extra IDs and duplicate ownership. Validate every copy ID appears exactly once, `bag`/`pocket` requires an active run, and `lost` has a valid region location. Export only version 2. Preserve three save slots and last-known-good recovery.
- [ ] **Step 5: Verify and commit.** Run `npm test -- --run src/game/engine/copies.test.ts src/game/save.test.ts` and `npm run typecheck`; expect passes. Stage exact hunks and commit `feat: persist individual book locations`.

## Task 3: Replace repeatable unique drops with physical transfers

**Files:** Modify `src/game/model.ts`, `src/game/content/schema.ts`, `src/game/content/events.json`, `src/game/content/load.ts`, `src/game/engine/events.ts`, `src/game/engine/lifecycle.ts`, `src/game/engine/exits.ts`; test `src/game/engine/events.test.ts`, `src/game/engine/lifecycle.test.ts`, `src/game/engine/exits.test.ts`.

- [ ] **Step 1: Write failing behavior tests.** Take `swallow_biaoshi_copy`, extract, start a second Blackwind raid, and assert `take_swallow_manual` is absent and the warehouse text mentions the empty hiding place. Taking `blood_page_copy` must keep the chief-secret route reachable on a later raid. A rescue before extraction must put the page at a lost location, never back on the knife rack. A lost copy must offer a recovery choice at the actual lost scene, even when that scene differs from its original source.
- [ ] **Step 2: Verify red.** Run `npm test -- --run src/game/engine/events.test.ts src/game/engine/lifecycle.test.ts src/game/engine/exits.test.ts`; expect duplicate acquisition to remain possible.
- [ ] **Step 3: Add `takeCopy` event effect and source visibility.** The effect takes a `copyId`; `getChoices` only shows authored source choices when the copy is at that source. Add one generic “找回遗落的…” choice for each copy whose position is `{kind:'lost', locationId:run.locationId}`. `chooseEvent` calls `moveCopy(..., {kind:'bag'}, expectedOrigin)`; source-absent scene text is selected by registry state, not by run flags. Use one state transition for the copy plus other effects, so a weight/error failure leaves the original state untouched.

```ts
// In the `applyEffect` switch, after confirming the current event location:
case 'takeCopy': {
  const at = state.permanent.copyPositions[id];
  const origin = at?.kind === 'lost' && at.locationId === run.locationId
    ? at : { kind: 'source' } as const;
  return moveCopy(state, id, { kind: 'bag' }, origin);
}
```
- [ ] **Step 4: Make quest progress independent of repeat pickup.** Replace `blood_page_taken` as an entrance prerequisite with a durable `chief_secret_discovered` flag or held/previously-owned page state. Keep post-pickup “leave or continue” choices in the current raid. Subsequent visits may reach the secret using the known entrance. Move `blood_page_copy` and `tunnel_map_copy` through the same registry on successful exit, rescue, and recovery. `exitContext` recognizes a carried or home `tunnel_map_copy`. The tutorial reads this state rather than requesting a depleted source.
- [ ] **Step 5: Verify and commit.** Run the three focused tests plus `npm run typecheck`; expect passes. Commit `feat: consume unique world sources on pickup` with only task hunks staged.

## Task 4: Read authored copies without consuming them

**Files:** Create `src/game/engine/study.ts`, `src/game/engine/study.test.ts`; modify `src/game/engine/martial.ts`, `src/game/engine/combat.ts`, `src/game/engine/exits.ts`, `src/game/content/martial-arts.json`, `src/ui/TownScreen.tsx`, `src/App.tsx`; test adjacent martial/UI tests.

- [ ] **Step 1: Write failing tests.** A `home`镖师手抄本 read first grants `swallow_step` and `insight_borrow_wall` but remains at home. A later read of the Qingyan original grants `insight_soft_landing` once, no matter the reading order. A second read of either book has no reward. The source insight exposes a warehouse wall-turn action; the original insight raises the cliff load allowance from 20 to 25. The incomplete blood page cannot be read as a complete art.
- [ ] **Step 2: Verify red.** Run `npm test -- --run src/game/engine/study.test.ts src/game/engine/martial.test.ts src/game/engine/exits.test.ts`; expect failures.
- [ ] **Step 3: Implement `studyCopy(state, copyId, content)`.** Require the copy at `home`, `state.phase === 'town'`, and `safeLocationId === 'training_yard'`; require `artId` and `insightId`; union the art and insight into permanent arrays; keep the copy's position unchanged. `learnArt` handles migrated legacy manuals only, no longer consumes them, and grants one legacy insight per art. Surface each unstudied home copy as its own named button showing author and insight, while already-read books remain visible in the collection.

```ts
export function grantCopyInsight(state: GameState, copy: CopyDefinition): GameState {
  if (!copy.artId || !copy.insightId) throw new Error('这份残篇不能教授完整武学');
  if (state.permanent.learnedInsights.includes(copy.insightId)) return state;
  return { ...state, permanent: { ...state.permanent,
    learnedArts: [...new Set([...state.permanent.learnedArts, copy.artId])],
    learnedInsights: [...state.permanent.learnedInsights, copy.insightId] } };
}
```
- [ ] **Step 4: Wire authored effects.** Add a warehouse choice requiring `insight_borrow_wall` and making a silent wall turn that reduces heat by 8 once per raid. In `evaluateExit('cliff')`, permit load `<=25` only when `insight_soft_landing` is learned; otherwise retain `<=20`. This gives both first copies actual, distinct use without inventing a broad level system.
- [ ] **Step 5: Verify and commit.** Run the focused tests, `npm run typecheck`, then commit `feat: learn fixed insights from retained books` with exact staging.

## Task 5: Offer field study with hiding, light, and patrol

**Files:** Create `src/game/engine/study-field.test.ts`; modify `src/game/model.ts`, `src/game/content/locations.json`, `src/game/engine/study.ts`, `src/game/engine/events.ts`, `src/game/engine/lifecycle.ts`, `src/ui/ExploreScreen.tsx`, `src/App.tsx`.

- [ ] **Step 1: Write failing field tests.** Verify a carried manual cannot be read while visible, fighting, at heat 50, in darkness without a covered lantern, or without its practice space. Hiding behind warehouse boxes at heat 38 with a covered lantern allows a read; movement and battle cancel hiding. A patrol arrival during the read leaves the book and knowledge unchanged, advances patrol, and explains the interruption. A completed read immediately gives art and insight, which survive rescue.
- [ ] **Step 2: Verify red.** Run `npm test -- --run src/game/engine/study-field.test.ts`; expect missing hiding/read actions.
- [ ] **Step 3: Add transient run state.** `RunState.hiddenAt: Id | null` and `patrolStep: number` initialize at departure. Provide `hideAt(state, locationId)` only at a content-marked hide site, and `studyInField(state, copyId, content)` with all three gates from the spec. Each study attempt advances `patrolStep` by one; a scene's `patrolPeriod` deterministically signals arrival on a multiple of that period. If interrupted, add the scene's announced heat penalty, preserve the copy, and add no insight. Check the heat threshold again after patrol effects before awarding knowledge. Successful study invokes the same knowledge-recording helper as town study. Persist run progress so reload does not reroll an interruption.

```ts
const nextStep = run.patrolStep + 1;
const interrupted = nextStep % (location.patrolPeriod ?? 3) === 0;
const nextRun = { ...run, patrolStep: nextStep,
  heat: interrupted ? addHeat(run.heat, 8) : run.heat };
if (interrupted || nextRun.heat >= 50) return { ...state, run: nextRun,
  notice: '巡逻逼近，研读中断；秘籍仍在身上。' };
return grantCopyInsight({ ...state, run: nextRun }, copy);
```
- [ ] **Step 4: Expose readable reasons in UI.** Exploration shows “藏身” and “研读《…》” when available; unavailable reading explains which gate is missing. The action log records hiding, reading, and interruption. Use actual buttons and status text; no hover-only instructions. `moveTo` and combat entry clear `hiddenAt`.
- [ ] **Step 5: Verify and commit.** Run focused tests, `npm run typecheck`, and `npm test -- --run src/ui/ExploreScreen.test.tsx`; expect passes. Commit `feat: allow risky field study from hiding`.

## Task 6: Resolve failure as rescue with explicit carry placement

**Files:** Modify `src/game/model.ts`, `src/game/save.ts`, `src/game/engine/inventory.ts`, `src/game/engine/lifecycle.ts`, `src/game/engine/copies.ts`, `src/ui/ExploreScreen.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/PrepScreen.tsx`, `src/App.tsx`, `src/game/onboarding.ts`; test `src/game/engine/lifecycle.test.ts`, `src/game/engine/inventory.test.ts`, `src/game/save.test.ts`, `src/ui/ExploreScreen.test.tsx`.

- [ ] **Step 1: Write failing rescue tests.** Start with one manual in `home`, a different manual in run `bag`, a third run copy in `pocket`, worn sword, loose medicine, silver bag, and carried coins. Rescue preserves home, pocket, worn sword, learned insights, and confirmed rumors; it loses the bag/loose goods and carried coins. Lost unique copies point to the last scene. A copy already read in the field stays learned when its physical book is lost. If nothing is lost, result must not claim otherwise.
- [ ] **Step 2: Verify red.** Run `npm test -- --run src/game/engine/lifecycle.test.ts src/game/engine/inventory.test.ts`; expect the current all-loss behavior to fail.
- [ ] **Step 3: Model placement explicitly.** Add `RunState.wornItemIds: Id[]` for valid equipped gear, and use the copy registry's `bag`/`pocket` for unique objects. Track ordinary pocket items as a subset of `run.inventory + run.loot` in `RunState.pocketItems: Counts`; this subset is not counted a second time by `runWeight` and is disjoint from worn gear. Total pocket weight, including copies, is at most 2. Add `stowSmallItem(state, itemId)` and `stowCopy(state, copyId)` actions; each costs one exploration action, requires weight `<=1`, and rejects full pockets. New loot defaults to bag. At departure, mark the sword and mask as worn if included in loadout; rope, lantern, medicines, and other supplies start in bag.
- [ ] **Step 4: Implement `failRun` rescue transfer.** Retain worn and pocket goods in the home stash; move pocket copies to `home`, bag copies to `{kind:'lost', locationId:run.locationId}`, and lose ordinary bag goods plus run coins. Preserve prior home stash and permanent knowledge. Record separate `kept`, `lost`, and `lostAt` fields in `ResultState`, and show “神秘人将你救出” with itemized outcome. Update version-2 save validation and version-0/1 result migration for these new result fields. Success extraction moves all still-carried copies to `home` and preserves existing route-specific costs.

```ts
for (const [copyId, position] of Object.entries(state.permanent.copyPositions)) {
  if (position.kind === 'pocket') nextPositions[copyId] = { kind: 'home' };
  if (position.kind === 'bag') nextPositions[copyId] = { kind: 'lost', locationId: run.locationId };
}
// Keep state.permanent.stash and learnedInsights; merge only worn and pocket items.
// lastResult.lostAt is run.locationId, and run.coins do not return to permanent.coins.
```
- [ ] **Step 5: Update guidance and verify.** Replace “death”/“all carried items lost” copy in result, prep, tutorial, and README text touched by this feature. Run `npm test -- --run src/game/engine/lifecycle.test.ts src/game/engine/inventory.test.ts src/ui/ExploreScreen.test.tsx src/game/onboarding.test.ts`, `npm run typecheck`; expect passes. Commit `feat: rescue player and settle carried possessions`.

## Task 7: Add Qingyan Ruins as a separate playable region

**Files:** Modify `src/game/content/locations.json`, `src/game/content/events.json`, `src/game/content/rumors.json`, `src/game/content/copies.json`, `src/game/content/load.ts`, `src/game/engine/lifecycle.ts`, `src/game/engine/exits.ts`, `src/ui/PrepScreen.tsx`, `src/App.tsx`; test `src/game/content/load.test.ts`, `src/game/engine/lifecycle.test.ts`, `src/game/engine/exits.test.ts`.

- [ ] **Step 1: Write failing map tests.** After first return from Blackwind, the teahouse offers `qingyan_ruins` rumor; hearing it unlocks `startRun(..., 'qingyan')` without any燕回身 ownership. Earlier entry fails. Qingyan begins at `qingyan_gate`, moves through `qingyan_corridor` to `qingyan_hall`, and cannot use a Blackwind edge or exit. Both `qingyan_return` and lightness-only `qingyan_cliff` exit to town; the original is obtainable before the Blackwind manuscript if the latter was skipped.
- [ ] **Step 2: Verify red.** Run the focused content/lifecycle/exit tests; expect unknown region and location failures.
- [ ] **Step 3: Make entry and exits region-aware.** Give `RunState.regionId` a stable value; extend `startRun(state, loadout, carriedCoins, seed, content?, regionId = 'blackwind')` so old call sites and existing tests stay valid. Filter prep region choices by heard rumors. `moveTo`, content reachability checks, `exitContext`, and `evaluateExit` reject cross-region travel and exits. Use the three Qingyan locations introduced in Task 1, add the sealed hall original-copy event, a short traversal decision, and two named exits. The Blackwind `back_hill` remains unchanged.

```ts
const starts = { blackwind: 'foothill', qingyan: 'qingyan_gate' } as const;
if (regionId === 'qingyan' && !state.permanent.heardRumors.includes('qingyan_ruins'))
  throw new Error('尚未探得青燕门旧址');
// Set these two fields while constructing `run` inside `startRun`:
const regionFields = { regionId, locationId: starts[regionId] };
// `moveTo` requires destination.regionId === run.regionId;
// `evaluateExit` requires the exit's region to equal context.regionId.
```
- [ ] **Step 4: Wire the UI.** Prep shows Blackwind by default and Qingyan after the rumor; the start button names the selected region. Explore headings, map destinations, and exit buttons use the active region. Keep mobile button targets at least 44 CSS px.
- [ ] **Step 5: Verify and commit.** Run focused tests, `npm run typecheck`, then commit `feat: add Qingyan Ruins expedition`.

## Task 8: Remove excess manuals from the beginner map and preserve their sources

**Files:** Modify `src/game/content/events.json`, `src/game/content/npcs.json`, `src/game/content/items.json`, `src/game/content/copies.json`, `src/game/content/rumors.json`, `src/game/content/load.ts`, `src/game/engine/shop.ts`, `src/game/engine/events.ts`, `src/ui/TownScreen.tsx`; test `src/game/content/coverage.test.ts`, `src/game/engine/events.test.ts`, `src/game/engine/shop.test.ts`.

- [ ] **Step 1: Write failing distribution tests.** Blackwind offers only `swallow_biaoshi_copy` as a complete martial manuscript and `blood_page_copy` as the quest page. No `breath_manual`, `wild_manual`, `acupoint_manual`, or `taiji_manual` action remains there. Each art still has a reachable first-learning source; a source handed over once is exhausted across raids.
- [ ] **Step 2: Verify red.** Run the focused tests; expect the current warehouse, prison, and secret-room drops to violate the cap.
- [ ] **Step 3: Relocate content.** Put the trainer's one狂风刀谱 in town sale stock, a走水人's龟息功 in black-market stock, the囚犯's点穴手谱 in a post-rescue town relation event, and太极剑谱 behind a tea-house visitor rumor. Use unique copy transfers for each, finite stock, and distinct author/insight metadata. Replace removed Blackwind rewards with existing actionable information or ordinary goods so waterway, prison, and secret room still offer meaningful choices. Do not add an extra manuscript to Qingyan's initial three scenes.

```ts
// The town transfer uses the same registry as dungeon pickup:
if (state.permanent.copyPositions[copyId]?.kind !== 'source')
  throw new Error('这份手抄本已经易主');
const paid = { ...state, permanent: { ...state.permanent,
  coins: state.permanent.coins - price } };
return moveCopy(paid, copyId, { kind: 'home' }, { kind: 'source' });
```
- [ ] **Step 4: Verify and commit.** Run content coverage, event, shop, and typecheck; expect passes. Commit `feat: distribute manuals across believable sources`.

## Task 9: Regression, migration, and player-facing verification

**Files:** Modify `e2e/full-loop.spec.ts`, `src/game/save.test.ts`, `src/game/onboarding.test.ts`, `src/ui/ResultScreen.tsx`, `README.md`; edit other adjacent tests only for changed behavior.

- [ ] **Step 1: Add actual UI journeys.** Extend E2E with: (a) take the西仓 copy, extract, read, revisit the empty source; (b) ignore that copy, return once, hear旧址 rumor, obtain/read the original first, then read the manuscript; (c) hide and read in Blackwind, fail rescue, retain knowledge, and recover a lost copy without duplicate insight; (d) bring a book home, fail a later raid, confirm the stored book remains. Assert visible scene text and state changes, not just button existence.
- [ ] **Step 2: Run the smallest relevant E2E set.** Run `npm run test:e2e -- --grep "独本|青燕门|神秘人"`; expect all new journeys to pass. Fix concrete failures in their owning module, without broad test rewrites.
- [ ] **Step 3: Run final gates.** Run `npm run typecheck`, `npm test -- --run`, `npm run build`, and `npm run test:e2e`; expect exit code 0. Inspect a 360 px and 430 px viewport for region selection, field-study reasons, home books, and rescue result, with no horizontal overflow. Check `git diff --check` and inspect `git status --short` to ensure unrelated pre-existing edits were preserved.
- [ ] **Step 4: Commit the verification/doc hunks.** Stage only changed E2E, README, and adjacent regression files; inspect staged diff and commit `test: verify unique manuals across raids and regions`.

## Spec coverage review

Tasks 1–3 own physical copies, source depletion, task items, and save compatibility. Task 4 owns authored knowledge and non-consuming study. Task 5 owns in-raid hiding, heat, light, practice space, patrol, and interruption. Task 6 owns the mysterious rescuer, protected home storage, pocket capacity, and lost-site recovery. Tasks 7–8 keep Blackwind sparse while providing a separate, reachable Qingyan map and finite sources for every existing art. Task 9 verifies repeated exploration, reverse acquisition order, rescue, old saves, and mobile UI. No implementation work starts merely by writing this plan.
