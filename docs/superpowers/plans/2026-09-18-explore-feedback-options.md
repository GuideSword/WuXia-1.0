# Explore Feedback and Options Implementation Plan

> **For agentic workers:** Implement the tasks below in order, with focused verification after each task. This session executes inline because the approved design is already in context.

**Goal:** Keep narrative feedback visible and give scene actions and destinations separate scroll areas on portrait screens.

**Architecture:** `ExploreScreen` renders a story pane and an action pane. A small pure helper in the event engine creates authored action results in `GameState.notice`, while existing state and save plumbing remain intact.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Playwright.

---

### Task 1: Event feedback

**Files:** `src/game/content/action-results.ts`, `src/game/engine/events.ts`, `src/game/engine/events.test.ts`

- [x] Add a keyed table of short result prose for all authored event choices. Movement results are derived from the destination name.
- [x] In `chooseEvent`, keep the existing atomic effect application, then set `notice` to the prose plus actual heat, HP, coin and carried-weight changes. Preserve a heat-stage warning when the stage changes.
- [x] Append the result to the action log while retaining the existing choice label entry, so older tests and saved logs remain compatible.
- [x] Test warehouse loot result, movement result, heat-stage result and a zero-delta action.

### Task 2: Split the explore layout

**Files:** `src/ui/ExploreScreen.tsx`, `src/styles.css`, `src/theme.css`, `src/ui/ExploreScreen.accessibility.test.tsx`

- [x] Group title, description, latest result, status and tutorial into a named story scroll area.
- [x] Partition choices using `choice.id.startsWith('go:')`; place movement in a two-column scroll area and all other actions, local exits, hide and study in a separate scene-action scroll area.
- [x] Give each list a persistent heading, total count, visible scroll affordance, and a `tabIndex`/accessible label. Hide an empty list and let the populated list grow.
- [x] Replace the old single `.explore-content` scroll with a flex layout whose story pane and action lists have independent `overflow-y: auto` and `overscroll-behavior: contain`. Use shorter artwork on short viewports.
- [x] Test grouping, accessible names and independent container structure.

### Task 3: Portrait verification

**Files:** `e2e/full-loop.spec.ts`

- [x] At 390×844, verify scene actions and movement each scroll without moving the other list, story pane or bottom nav.
- [x] At 390×667, verify latest feedback, a scene action, one movement row and bottom nav are visible.
- [x] Run `npm run build`, the full Vitest suite and the full Playwright suite. Inspect screenshots and correct clipping or overlap.
