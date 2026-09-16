import type { Condition, Content, Effect, EventChoice, GameState, RunState } from '../model';
import { moveTo } from './lifecycle';
import { addHeat, heatLabels, heatStage } from './heat';
import { runWeight } from './inventory';

function hasItem(run: RunState, id: string): boolean {
  return (run.inventory[id] ?? 0) + (run.loot[id] ?? 0) > 0;
}

function conditionMet(condition: Condition, state: GameState, content: Content): boolean {
  const run = state.run;
  if (!run) return false;
  switch (condition.type) {
    case 'flagAbsent': return !run.flags.includes(condition.value) && !state.permanent.flags.includes(condition.value);
    case 'hasFlag': return run.flags.includes(condition.value) || state.permanent.flags.includes(condition.value);
    case 'hasItem': return hasItem(run, condition.value);
    case 'hasArtTag': return state.permanent.learnedArts.some((id) => content.arts.find((art) => art.id === id)?.tags.includes(condition.value));
    case 'hasRumor': return state.permanent.heardRumors.includes(condition.value) || state.permanent.confirmedRumors.includes(condition.value) || run.pendingRumors.includes(condition.value);
    case 'heatAtLeast': return run.heat >= (condition.amount ?? Number(condition.value));
    case 'heatBelow': return run.heat < (condition.amount ?? Number(condition.value));
    case 'relationAtLeast': return (state.permanent.relations[condition.value] ?? 0) >= (condition.amount ?? 1);
  }
}

function movementChoices(state: GameState, content: Content): EventChoice[] {
  const location = content.locations.find((entry) => entry.id === state.run?.locationId);
  return (location?.next ?? []).map((id) => {
    const target = content.locations.find((entry) => entry.id === id);
    return { id: `go:${id}`, label: `前往${target?.name.replace('黑风寨', '') ?? id}`, conditions: [], effects: [{ type: 'move', value: id }], riskHint: '转移地点' };
  });
}

export function getChoices(state: GameState, content: Content): EventChoice[] {
  if (state.phase !== 'explore' || !state.run) return [];
  const storyChoices = content.events
    .filter((event) => event.locationId === state.run?.locationId)
    .flatMap((event) => event.choices)
    .filter((choice) => choice.conditions.every((condition) => conditionMet(condition, state, content)));
  return [...movementChoices(state, content), ...storyChoices];
}

export function getSceneText(state: GameState, content: Content): string {
  const location = content.locations.find((entry) => entry.id === state.run?.locationId);
  const event = content.events.find((entry) => entry.locationId === state.run?.locationId && entry.choices.some((choice) => choice.conditions.every((condition) => conditionMet(condition, state, content))));
  return event ? `${location?.description ?? ''}\n\n${event.text}` : location?.description ?? '';
}

function applyEffect(state: GameState, effect: Effect, content: Content): GameState {
  const run = state.run;
  if (!run) throw new Error('当前没有进行中的本局探索');
  const id = String(effect.value);
  const count = effect.amount ?? 1;
  switch (effect.type) {
    case 'move': return moveTo(state, id, content);
    case 'setFlag': return { ...state, run: { ...run, flags: [...new Set([...run.flags, id])] } };
    case 'addLoot': {
      const nextRun = { ...run, loot: { ...run.loot, [id]: (run.loot[id] ?? 0) + count } };
      if (runWeight(nextRun, content) > 30) throw new Error('负重已达上限');
      return { ...state, run: nextRun };
    }
    case 'addHeat': return { ...state, run: { ...run, heat: addHeat(run.heat, Number(effect.value)) } };
    case 'addRumor': return { ...state, run: { ...run, pendingRumors: [...new Set([...run.pendingRumors, id])] } };
    case 'addItem': return { ...state, run: { ...run, inventory: { ...run.inventory, [id]: (run.inventory[id] ?? 0) + count } } };
    case 'takeItem': {
      if ((run.inventory[id] ?? 0) < count) throw new Error(`物品不足：${id}`);
      return { ...state, run: { ...run, inventory: { ...run.inventory, [id]: run.inventory[id] - count } } };
    }
    case 'addCoins': return { ...state, run: { ...run, coins: Math.max(0, run.coins + Number(effect.value)) } };
    case 'heal': return { ...state, run: { ...run, hp: Math.min(100, run.hp + Number(effect.value)) } };
    case 'addRelation': return { ...state, permanent: { ...state.permanent, relations: { ...state.permanent.relations, [id]: (state.permanent.relations[id] ?? 0) + count } } };
    case 'confirmRumor': return { ...state, permanent: { ...state.permanent, confirmedRumors: [...new Set([...state.permanent.confirmedRumors, id])] } };
    case 'startBattle': {
      const npc = content.npcs.find((entry) => entry.id === id);
      if (!npc?.hp) throw new Error(`战斗角色不存在：${id}`);
      return { ...state, phase: 'combat', run: { ...run, battle: { npcId: id, enemyHp: npc.hp, round: 1, intent: 'strike', defending: false } } };
    }
  }
}

export function chooseEvent(state: GameState, choiceId: string, content: Content): GameState {
  const choice = getChoices(state, content).find((entry) => entry.id === choiceId);
  if (!choice) throw new Error(`当前选项不可用：${choiceId}`);
  const next = choice.effects.reduce((current, effect) => applyEffect(current, effect, content), state);
  const before = heatStage(state.run?.heat ?? 0);
  const after = heatStage(next.run?.heat ?? 0);
  return before === after ? next : { ...next, notice: `风声已升至「${heatLabels[after]}」。` };
}
