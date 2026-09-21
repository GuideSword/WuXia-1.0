import type { Condition, Content, Effect, EventChoice, GameState, RunState } from '../model';
import { moveTo } from './lifecycle';
import { addHeat, heatLabels, heatStage } from './heat';
import { BAG_CAPACITY, bagSlots, runWeight } from './inventory';
import { confirmRumor } from './rumors';
import { canUseGate } from './heat';
import { moveCopy } from './copies';
import { actionResults } from '../content/action-results';

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
    case 'hasInsight': return state.permanent.learnedInsights.includes(condition.value);
    case 'hasRumor': return state.permanent.heardRumors.includes(condition.value) || state.permanent.confirmedRumors.includes(condition.value) || run.pendingRumors.includes(condition.value);
    case 'heatAtLeast': return run.heat >= (condition.amount ?? Number(condition.value));
    case 'heatBelow': return run.heat < (condition.amount ?? Number(condition.value));
    case 'relationAtLeast': return (state.permanent.relations[condition.value] ?? 0) >= (condition.amount ?? 1);
    case 'gateCheckRequired': return run.locationId === 'gate' && !canUseGate(run) && run.heat < 100;
  }
}

function movementChoices(state: GameState, content: Content): EventChoice[] {
  const location = content.locations.find((entry) => entry.id === state.run?.locationId);
  return (location?.next ?? []).filter((id) => {
    const target = content.locations.find((entry) => entry.id === id);
    return !target?.requiresFlag || !!state.run?.flags.includes(target.requiresFlag) || state.permanent.flags.includes(target.requiresFlag);
  }).map((id) => {
    const target = content.locations.find((entry) => entry.id === id);
    return { id: `go:${id}`, label: `前往${target?.name.replace('黑风寨', '') ?? id}`, conditions: [], effects: [{ type: 'move', value: id }], riskHint: '转移地点' };
  });
}

export function getChoices(state: GameState, content: Content): EventChoice[] {
  if (state.phase !== 'explore' || !state.run) return [];
  const storyChoices = content.events
    .filter((event) => event.locationId === state.run?.locationId)
    .flatMap((event) => event.choices)
    .filter((choice) => choice.conditions.every((condition) => conditionMet(condition, state, content)))
    .filter((choice) => choice.effects.every((effect) => effect.type !== 'takeCopy' || state.permanent.copyPositions[String(effect.value)]?.kind === 'source'));
  const recoveryChoices: EventChoice[] = content.copies
    .filter((copy) => {
      const at = state.permanent.copyPositions[copy.id];
      return at?.kind === 'lost' && at.locationId === state.run?.locationId;
    })
    .map((copy) => ({ id: `recover:${copy.id}`, label: `找回遗落的${copy.title}`, conditions: [], effects: [{ type: 'takeCopy', value: copy.id }], riskHint: '找回原件；未读者仍可研读' }));
  return [...movementChoices(state, content), ...storyChoices, ...recoveryChoices];
}

export function getSceneText(state: GameState, content: Content): string {
  const location = content.locations.find((entry) => entry.id === state.run?.locationId);
  const available = new Set(getChoices(state, content).map((choice) => choice.id));
  const event = content.events.find((entry) => entry.locationId === state.run?.locationId && entry.choices.some((choice) => available.has(choice.id)));
  const sourceNotes = content.copies
    .filter((copy) => copy.sourceLocationId === location?.id && state.permanent.copyPositions[copy.id]?.kind !== 'source')
    .map((copy) => `${copy.title}原先存放的地方已经空了。`);
  const groundNotes = Object.entries(state.run?.groundItems?.[location?.id ?? ''] ?? {})
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `地上留着${content.items.find((item) => item.id === id)?.name ?? id}${count > 1 ? ` ×${count}` : ''}。`);
  const lostCopyNotes = content.copies
    .filter((copy) => {
      const position = state.permanent.copyPositions[copy.id];
      return position?.kind === 'lost' && position.locationId === location?.id;
    })
    .map((copy) => `${copy.title}仍留在这里。`);
  const description = location?.id === 'prisoner_cell' && state.permanent.flags.includes('prisoner_freed') ? '铁栅已空，囚犯脱身后只留下磨损的绳结。' : location?.description ?? '';
  return [description, event?.text ?? '', ...sourceNotes, ...groundNotes, ...lostCopyNotes].filter(Boolean).join('\n\n');
}

function applyEffect(state: GameState, effect: Effect, content: Content): GameState {
  const run = state.run;
  if (!run) throw new Error('当前没有进行中的本局探索');
  const id = String(effect.value);
  const count = effect.amount ?? 1;
  switch (effect.type) {
    case 'move': return moveTo(state, id, content);
    case 'setFlag': return { ...state, run: { ...run, flags: [...new Set([...run.flags, id])] } };
    case 'setPermanentFlag': return { ...state, permanent: { ...state.permanent, flags: [...new Set([...state.permanent.flags, id])] } };
    case 'addLoot': {
      const nextRun = { ...run, loot: { ...run.loot, [id]: (run.loot[id] ?? 0) + count } };
      if (runWeight(nextRun, content, state.permanent.copyPositions) > 30) throw new Error('负重已达上限');
      if (bagSlots(nextRun, content, state.permanent.copyPositions) > BAG_CAPACITY) throw new Error('背包格子已满');
      return { ...state, run: nextRun };
    }
    case 'addHeat': return { ...state, run: { ...run, heat: addHeat(run.heat, Number(effect.value)) } };
    case 'addRumor': return { ...state, run: { ...run, pendingRumors: [...new Set([...run.pendingRumors, id])] } };
    case 'addItem': {
      const nextRun = { ...run, inventory: { ...run.inventory, [id]: (run.inventory[id] ?? 0) + count } };
      if (runWeight(nextRun, content, state.permanent.copyPositions) > 30) throw new Error('负重已达上限');
      if (bagSlots(nextRun, content, state.permanent.copyPositions) > BAG_CAPACITY) throw new Error('背包格子已满');
      return { ...state, run: nextRun };
    }
    case 'takeItem': {
      if ((run.inventory[id] ?? 0) < count) throw new Error(`物品不足：${id}`);
      const remaining = run.inventory[id] - count;
      const pocketItems = { ...run.pocketItems };
      if ((pocketItems[id] ?? 0) > remaining + (run.loot[id] ?? 0)) pocketItems[id] = remaining + (run.loot[id] ?? 0);
      return { ...state, run: { ...run, inventory: { ...run.inventory, [id]: remaining }, pocketItems } };
    }
    case 'addCoins': return { ...state, run: { ...run, coins: Math.max(0, run.coins + Number(effect.value)) } };
    case 'heal': return { ...state, run: { ...run, hp: Math.min(100, run.hp + Number(effect.value)) } };
    case 'addRelation': return { ...state, permanent: { ...state.permanent, relations: { ...state.permanent.relations, [id]: (state.permanent.relations[id] ?? 0) + count } } };
    case 'confirmRumor': return confirmRumor(state, id, content);
    case 'takeCopy': {
      const copy = content.copies.find((entry) => entry.id === id);
      if (!copy) throw new Error(`独本不存在：${id}`);
      const at = state.permanent.copyPositions[id];
      if (at?.kind === 'source' && copy.sourceLocationId === run.locationId) return moveCopy(state, id, { kind: 'bag' }, { kind: 'source' }, content);
      if (at?.kind === 'lost' && at.locationId === run.locationId) return moveCopy(state, id, { kind: 'bag' }, at, content);
      throw new Error('秘籍已不在此处');
    }
    case 'startBattle': {
      const npc = content.npcs.find((entry) => entry.id === id);
      if (!npc?.hp) throw new Error(`战斗角色不存在：${id}`);
      return { ...state, phase: 'combat', run: { ...run, hiddenAt: null, battle: { npcId: id, enemyHp: npc.hp, round: 1, intent: 'strike', defending: false } } };
    }
  }
}

export function chooseEvent(state: GameState, choiceId: string, content: Content): GameState {
  const choice = getChoices(state, content).find((entry) => entry.id === choiceId);
  if (!choice) throw new Error(`当前选项不可用：${choiceId}`);
  const applied = choice.effects.reduce((current, effect) => applyEffect(current, effect, content), state);
  const destination = choice.effects.find((effect) => effect.type === 'move');
  const destinationName = destination && content.locations.find((location) => location.id === String(destination.value))?.name;
  const prose = actionResults[choice.id] ?? (destinationName ? `你来到${destinationName}。` : choice.id.startsWith('recover:') ? `你在此处${choice.label}。` : `你${choice.label}。`);
  const changes: string[] = [];
  if (state.run && applied.run) {
    const heat = applied.run.heat - state.run.heat;
    const hp = applied.run.hp - state.run.hp;
    const coins = applied.run.coins - state.run.coins;
    const weight = runWeight(applied.run, content, applied.permanent.copyPositions) - runWeight(state.run, content, state.permanent.copyPositions);
    if (heat) changes.push(`风声 ${heat > 0 ? '+' : ''}${heat}`);
    if (hp) changes.push(`气血 ${hp > 0 ? '+' : ''}${hp}`);
    if (coins) changes.push(`携银 ${coins > 0 ? '+' : ''}${coins}`);
    if (weight) changes.push(`负重 ${weight > 0 ? '+' : ''}${weight}`);
    for (const item of content.items) {
      const before = (state.run.inventory[item.id] ?? 0) + (state.run.loot[item.id] ?? 0);
      const after = (applied.run.inventory[item.id] ?? 0) + (applied.run.loot[item.id] ?? 0);
      if (after > before) changes.push(`获得${item.name} ×${after - before}`);
      if (after < before) changes.push(`用掉${item.name} ×${before - after}`);
    }
    for (const copy of content.copies) {
      const before = state.permanent.copyPositions[copy.id]?.kind;
      const after = applied.permanent.copyPositions[copy.id]?.kind;
      if (before !== after && after === 'bag') changes.push(`获得${copy.title}`);
    }
  }
  const before = heatStage(state.run?.heat ?? 0);
  const after = heatStage(applied.run?.heat ?? 0);
  if (before !== after) changes.push(`风声升至「${heatLabels[after]}」`);
  const notice = changes.length ? `${prose}\n${changes.join(' · ')}` : prose;
  return {
    ...applied,
    notice,
    run: applied.run ? { ...applied.run, log: [...(state.run?.log ?? []), choice.label, prose].slice(-30) } : null,
  };
}
