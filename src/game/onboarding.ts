import type { GameState } from './model';
import { loadBundledContent } from './content/load';

const onboardingContent = loadBundledContent();

const ACTIVE = 'tutorial_active';
const COMPLETE = 'tutorial_complete';
const SKIPPED = 'tutorial_skipped';
const FINISHED = 'tutorial_finished';

export interface TutorialStep {
  title: string;
  instruction: string;
  actionId?: string;
  actionLabel?: string;
  skippable?: boolean;
}

export function advanceTutorial(previous: GameState, next: GameState): GameState {
  const flags = next.permanent.flags;
  if (previous.phase === 'result' && next.phase === 'town' && flags.includes(COMPLETE)) {
    return { ...next, permanent: { ...next.permanent, flags: [...flags.filter((flag) => flag !== COMPLETE), FINISHED] } };
  }
  if (flags.includes(SKIPPED) || flags.includes(COMPLETE) || flags.includes(FINISHED)) return next;
  if (next.phase === 'result' && next.lastResult?.success && previous.run?.flags.includes('blood_page_taken') && (previous.permanent.raids === 0 || flags.includes(ACTIVE))) {
    return { ...next, permanent: { ...next.permanent, flags: [...flags.filter((flag) => flag !== ACTIVE), COMPLETE] } };
  }
  if (previous.permanent.raids === 0 && next.permanent.raids > 0 && !flags.includes(ACTIVE)) {
    return { ...next, permanent: { ...next.permanent, flags: [...flags, ACTIVE] } };
  }
  return next;
}

export function skipTutorial(state: GameState): GameState {
  return { ...state, permanent: { ...state.permanent, flags: [...state.permanent.flags.filter((flag) => flag !== ACTIVE), SKIPPED] } };
}

export function getTutorialStep(state: GameState): TutorialStep | null {
  const flags = state.permanent.flags;
  if (flags.includes(SKIPPED) || flags.includes(FINISHED)) return null;
  if (flags.includes(COMPLETE)) {
    return state.phase === 'result' && state.lastResult?.success
      ? { title: '首局完成', instruction: '你已走完探听、潜入、交战和撤离。战利品与银两已带回镇中；下一局可自行选择线索和退路。', skippable: false }
      : null;
  }
  if (state.permanent.raids > 0 && !flags.includes(ACTIVE)) return null;

  if (state.phase === 'result') {
    if (state.lastResult?.success) return { title: '成功撤离，继续追查', instruction: '你已学会将战利品带回镇中。下次先在茶馆追查西域经书，再去西仓找二当家，取回血刀经残页。', actionId: 'return', actionLabel: '返回青石镇' };
    const lostCopy = Object.entries(state.permanent.copyPositions).find(([, position]) => position.kind === 'lost' && position.locationId === state.lastResult?.lostAt);
    const lostLocation = onboardingContent.locations.find((location) => location.id === state.lastResult?.lostAt)?.name;
    return { title: '此行失手，再试一次', instruction: `神秘人会救你回镇。家中收藏、贴身物品、穿戴装备、已学武学与重要情报会保留。${lostCopy ? `独本遗落在${lostLocation ?? '失手地点'}，下次到那里找回。` : '行囊可能遗落在失手地点。'}回镇后可重新整备出发。`, actionId: 'return', actionLabel: '返回青石镇' };
  }
  if (state.phase === 'town') {
    if (!state.permanent.heardRumors.includes('western_scripture') || state.selectedRumorId !== 'western_scripture') {
      return { title: '第一步 · 去茶馆探听', instruction: '先找说书人了解“西域经书的传闻”，再选它为本局追查目标。情报会告诉你该去哪儿。', actionId: 'rumors', actionLabel: '查看可用情报' };
    }
    return { title: '下一步 · 出发整备', instruction: '已锁定西域经书线索。去整备页决定携带物资和银两；首局可空手出发，避免失手时损失。', actionId: 'prep', actionLabel: '出发整备' };
  }
  if (state.phase === 'rumors') {
    if (!state.permanent.heardRumors.includes('western_scripture')) {
      return { title: '探听目标线索', instruction: '花 20 两探听“西域经书的传闻”。传闻还未证实，入寨后要找到证据。', actionId: 'hear:western_scripture', actionLabel: '探听西域经书的传闻' };
    }
    return { title: '追查这条线索', instruction: '选择“追查此线索”，随后会进入整备页。', actionId: 'track:western_scripture', actionLabel: '追查此线索' };
  }
  if (state.phase === 'prep') {
    return { title: '整备后入寨', instruction: '携银和行囊在失手时可能遗失；穿戴与贴身物品可带回。首局可直接前往黑风寨。', actionId: 'start', actionLabel: '前往黑风寨' };
  }
  if (state.phase === 'combat') {
    const heavy = state.run?.battle?.intent === 'heavy';
    return heavy
      ? { title: '看招防守', instruction: '对手正在蓄势重击。先防御可减少本回合受到的伤害；下一回合再看架势出招。', actionId: 'combat:defend', actionLabel: '防御' }
      : { title: '出招交锋', instruction: '观察敌方意图，施展基础剑法攻击。若气血不足，可用道具或撤出战斗。', actionId: 'combat:technique', actionLabel: '施展招式' };
  }
  const run = state.run;
  if (!run || state.phase !== 'explore') return null;
  const lostCopy = Object.entries(state.permanent.copyPositions).find(([, position]) => position.kind === 'lost' && onboardingContent.locations.find((location) => location.id === position.locationId)?.regionId === (run.regionId ?? 'blackwind'));
  if (lostCopy) {
    const [copyId, position] = lostCopy;
    if (position.kind === 'lost') {
      const copy = onboardingContent.copies.find((entry) => entry.id === copyId);
      const place = onboardingContent.locations.find((location) => location.id === position.locationId);
      return { title: '找回遗落的独本', instruction: run.locationId === position.locationId ? `${copy?.title ?? '独本'}就在此处，找回后仍只会获得原有的一份见解。` : `${copy?.title ?? '独本'}遗落在${place?.name ?? position.locationId}。查看地图并前往该处找回。`, actionId: run.locationId === position.locationId ? `recover:${copyId}` : undefined, actionLabel: run.locationId === position.locationId ? `找回遗落的${copy?.title ?? '独本'}` : undefined };
    }
  }
  if (run.regionId === 'qingyan') return null;
  const hasPage = (run.loot.blood_blade_page ?? 0) > 0 || run.flags.includes('blood_page_taken');
  const swallowAtSource = state.permanent.copyPositions.swallow_biaoshi_copy?.kind === 'source';
  const hasPracticeLoot = !state.permanent.heardRumors.includes('western_scripture') && run.flags.includes('swallow_manual_taken');
  if (!state.permanent.heardRumors.includes('western_scripture') && !swallowAtSource && !hasPracticeLoot) return null;
  if (run.locationId === 'foothill') return { title: hasPage || hasPracticeLoot ? '带着战利品撤离' : '进入黑风寨', instruction: hasPage || hasPracticeLoot ? '沿山道回到山门，选择撤离，才能把所得带回青石镇。' : '先前往山门，再进入西仓寻找经书线索。行动会改变风声；风声太高会影响撤离。', actionId: 'go:gate', actionLabel: '前往山门' };
  if (run.locationId === 'gate') {
    if (hasPage || hasPracticeLoot) {
      if (run.heat >= 50 && run.heat < 100 && !run.flags.includes('gate_cleared')) return { title: '通过山门盘查', instruction: '风声已高，先接受盘查，再从山门撤离。', actionId: 'pass_gate_check', actionLabel: '接受山门盘查' };
      if (run.heat < 100) return { title: '现在撤离', instruction: '点击山门撤离，战利品才会结算入库。继续搜刮会增加风声和风险。', actionId: 'extract:gate', actionLabel: '从山门撤离' };
      return { title: '寻找其他退路', instruction: '风声已到封寨程度，山门关闭。查看撤离路线的条件，或返回后山寻找出口。', actionId: 'go:back_hill', actionLabel: '前往后山' };
    }
    return { title: '前往西仓', instruction: '经书线索指向西仓。点击“前往西仓”，在那里核实消息并寻找二当家的独行时辰。', actionId: 'go:warehouse', actionLabel: '前往西仓' };
  }
  if (run.locationId === 'warehouse') {
    if (hasPage) return { title: '原路返回山门', instruction: '主目标已到手。先回山门，再选择撤离；不要只停在寨内。', actionId: 'go:gate', actionLabel: '前往山门' };
    if (!state.permanent.heardRumors.includes('western_scripture')) return run.flags.includes('swallow_manual_taken')
      ? { title: '带着秘笈返回', instruction: '战利品已经入囊。返回山门并撤离，才能永久带回。', actionId: 'go:gate', actionLabel: '前往山门' }
      : { title: '先拿一件战利品', instruction: '你未追查经书传闻。可取走燕回身秘笈，再经山门撤离，体验带回战利品的流程。', actionId: 'take_swallow_manual', actionLabel: '翻取燕回身秘笈' };
    if (!run.flags.includes('warehouse_script_seen')) return { title: '核实传闻', instruction: '辨认仓内的西域经书印记。重要情报一旦证实，即使失手也会保留。', actionId: 'inspect_script_mark', actionLabel: '辨认西域经书印记' };
    if (!run.flags.includes('second_chief_schedule')) return { title: '找出二当家行踪', instruction: '抄录二当家独行时辰，才能单独迎战他。', actionId: 'observe_chief_schedule', actionLabel: '抄录二当家独行时辰' };
    if (!run.flags.includes('swallow_manual_taken') && swallowAtSource) return { title: '取得一件秘笈', instruction: '取走燕回身手抄本，撤离后可在镇中练功处研读。注意负重和风声的变化。', actionId: 'take_swallow_manual', actionLabel: '翻取燕回身秘笈' };
    return { title: '前往二当家偏房', instruction: '线索已经备齐。进入偏房迎战二当家，取得血刀经残页。', actionId: 'go:second_chief_room', actionLabel: '前往二当家偏房' };
  }
  if (run.locationId === 'second_chief_room') {
    if (hasPage) return { title: '见好就收', instruction: '主目标已到手。选择返回西仓，再经山门撤离。', actionId: 'leave_with_page', actionLabel: '就此收手，返回西仓' };
    if (run.flags.includes('second_chief_defeated')) return state.permanent.copyPositions.blood_page_copy?.kind === 'source'
      ? { title: '取走主目标', instruction: '二当家已败。取走血刀经残页，随后尽快撤离。', actionId: 'take_blood_page', actionLabel: '取走血刀经残页' }
      : { title: '线索已明', instruction: '残页已经易主。可返回西仓撤离，或继续查探已发现的密室。', actionId: 'go:warehouse', actionLabel: '返回西仓' };
    if (run.flags.includes('second_chief_schedule')) return { title: '迎战二当家', instruction: '点击迎战进入回合制战斗。观察敌方意图，选择攻击、招式或防御。', actionId: 'challenge_second_chief', actionLabel: '迎战二当家' };
    return { title: '先回西仓找时辰', instruction: '尚未查到二当家独行时辰。返回西仓抄录记录。', actionId: 'go:warehouse', actionLabel: '前往西仓' };
  }
  const wayBack: Record<string, string> = { prisoner_cell: 'warehouse', waterway: 'warehouse', chief_secret: 'second_chief_room', back_hill: 'gate' };
  const destination = wayBack[run.locationId];
  if (destination) return { title: '返回主线', instruction: '首局先完成经书线索。沿路返回，完成目标后再探索其他路线。', actionId: `go:${destination}`, actionLabel: `前往${destination === 'warehouse' ? '西仓' : destination === 'gate' ? '山门' : '二当家偏房'}` };
  return null;
}
