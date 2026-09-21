import { useMemo, useState } from 'react';
import { loadBundledContent } from './game/content/load';
import { failRun, moveTo, returnToTown, startRun } from './game/engine/lifecycle';
import { chooseEvent, getChoices, getSceneText } from './game/engine/events';
import { bagSlots, itemSlots, runWeight } from './game/engine/inventory';
import { dropCarriedCopy, dropCarriedItem, recoverGroundItem } from './game/engine/bag';
import { resolveTurn } from './game/engine/combat';
import { attemptExit, evaluateExit, exitContext, exitIds, exitNames, type ExitId } from './game/engine/exits';
import type { EventChoice, GameState } from './game/model';
import { commitImport, exportSave, inspectSaveSlot, loadGame, parseImport, saveGame, SAVE_SLOTS, slotKeys, type SaveSlot, type SlotSummary } from './game/save';
import { ExploreScreen } from './ui/ExploreScreen';
import { PrepScreen } from './ui/PrepScreen';
import { ResultScreen } from './ui/ResultScreen';
import { TownScreen } from './ui/TownScreen';
import { CombatScreen } from './ui/CombatScreen';
import { learnArt } from './game/engine/martial';
import { fieldStudyReason, hideAt, leaveHiding, studyCopy, studyInField } from './game/engine/study';
import { pocketWeight, stowCopy, stowSmallItem } from './game/engine/placement';
import { hearRumor } from './game/engine/rumors';
import { RumorScreen } from './ui/RumorScreen';
import { buyItem } from './game/engine/shop';
import { ErrorScreen } from './ui/ErrorScreen';
import { downloadText } from './ui/download';
import { createGame } from './game/engine/lifecycle';
import { advanceTutorial, getTutorialStep, skipTutorial } from './game/onboarding';
import { SaveSelectScreen, TitleScreen } from './ui/StartMenu';

export default function App() {
  const content = useMemo(loadBundledContent, []);
  const [screen, setScreen] = useState<'title' | 'slots' | 'game' | 'error'>('title');
  const [activeSlot, setActiveSlot] = useState<SaveSlot | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<GameState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function selectSlot(entry: SlotSummary) {
    setActiveSlot(entry.slot);
    setStorageError(null);
    setPendingImport(null);
    setImportError(null);
    let wasRecovered = false;
    try {
      const latest = inspectSaveSlot(localStorage, entry.slot);
      if (latest.status === 'damaged') throw new Error('当前存档和上一稳定存档均损坏，请先导出备份再处理。');
      const selected = latest.status === 'empty' ? createGame() : loadGame(localStorage, () => { wasRecovered = true; }, entry.slot);
      if (latest.status === 'empty') saveGame(localStorage, selected, entry.slot);
      setGame(selected);
      setRecovered(wasRecovered);
      setLoadError(null);
      setScreen('game');
    } catch (error) {
      setGame(null);
      setLoadError(error instanceof Error ? error.message : '存档无法读取');
      setScreen('error');
    }
  }

  function restartSlot(slot: SaveSlot) {
    setActiveSlot(slot);
    try {
      const previous = loadGame(localStorage, undefined, slot);
      downloadText(`wuxia-slot-${slot}-before-restart.json`, exportSave(previous));
      const fresh = createGame();
      saveGame(localStorage, fresh, slot);
      setGame(fresh);
      setRecovered(false);
      setLoadError(null);
      setStorageError(null);
      setScreen('game');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '无法重新开局');
      setScreen('error');
    }
  }

  function commit(next: GameState) {
    if (!game || !activeSlot) return;
    try {
      const updated = advanceTutorial(game, next);
      saveGame(localStorage, updated, activeSlot);
      setGame(updated);
      setStorageError(null);
      setActionError(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : '无法保存进度');
    }
  }

  function performExplore(action: () => GameState) {
    try { commit(action()); }
    catch (error) { setActionError(error instanceof Error ? error.message : '行动未能完成'); }
  }

  if (screen === 'title') return <TitleScreen onStart={() => setScreen('slots')} />;
  if (screen === 'slots') return <SaveSelectScreen slots={SAVE_SLOTS.map((slot) => inspectSaveSlot(localStorage, slot))} onSelect={selectSlot} onRestart={restartSlot} onBack={() => setScreen('title')} />;
  if (screen === 'error' || !game || !activeSlot) {
    const keys = slotKeys(activeSlot ?? 1);
    const rawBackup = () => JSON.stringify({ slot: activeSlot, current: localStorage.getItem(keys.current), lastKnownGood: localStorage.getItem(keys.good) }, null, 2);
    return <ErrorScreen error={loadError ?? '存档无法读取'} onExport={() => downloadText(`wuxia-slot-${activeSlot}-diagnostic.json`, rawBackup())} onBack={() => setScreen('slots')} onReset={() => { downloadText(`wuxia-slot-${activeSlot}-raw-backup.json`, rawBackup()); const fresh = createGame(); saveGame(localStorage, fresh, activeSlot ?? 1); setGame(fresh); setLoadError(null); setRecovered(false); setScreen('game'); }} />;
  }

  const notice = storageError ?? (recovered ? '已恢复上一稳定存档。' : null);
  const tutorial = getTutorialStep(game);
  const onSkipTutorial = () => commit(skipTutorial(game));

  if (game.phase === 'prep') {
    return <><PrepScreen permanent={game.permanent} items={content.items} copies={content.copies} tutorial={tutorial} onSkipTutorial={onSkipTutorial} onBack={() => commit({ ...game, phase: 'town' })} onStart={(coins, loadout, regionId, carriedCopyIds) => commit(startRun(game, loadout, coins, Date.now(), content, regionId, carriedCopyIds))} />{notice && <div className="floating-notice" role="status">{notice}</div>}</>;
  }

  if (game.phase === 'rumors') {
    const offered = content.npcs.find((npc) => npc.id === 'storyteller')?.rumorsOffered ?? [];
    return <RumorScreen rumors={content.rumors.filter((rumor) => (rumor.id !== 'qingyan_ruins' || game.permanent.raids > 0) && (offered.includes(rumor.id) || game.permanent.confirmedRumors.includes(rumor.id)))} heard={game.permanent.heardRumors} confirmed={game.permanent.confirmedRumors} selected={game.selectedRumorId} coins={game.permanent.coins} witnessedStyles={game.permanent.flags.filter((flag) => flag.startsWith('witnessed_style:')).map((flag) => content.arts.find((art) => art.id === flag.slice('witnessed_style:'.length))?.name ?? '某派')} tutorial={tutorial} onSkipTutorial={onSkipTutorial} onHear={(id) => commit(hearRumor(game, id, content))} onTrack={(id) => commit({ ...game, selectedRumorId: id, phase: 'prep' })} onBack={() => commit({ ...game, phase: 'town' })} />;
  }

  if (game.phase === 'explore' && game.run) {
    const run = game.run;
    const location = content.locations.find((entry) => entry.id === run.locationId);
    const choices: EventChoice[] = getChoices(game, content);
    const context = exitContext(game, content);
    const exits = exitIds.filter((id) => (run.regionId === 'qingyan') === id.startsWith('qingyan_')).map((id) => ({ id, name: exitNames[id], evaluation: evaluateExit(id, context) }));
    const copyView = (copy: typeof content.copies[number]) => {
      const item = content.items.find((entry) => entry.id === copy.itemId);
      return { id: copy.id, title: copy.title, weight: item?.weight ?? 1, slots: item ? itemSlots(item) : 1 };
    };
    return (
      <ExploreScreen
        title={location?.name ?? '黑风寨'}
        description={getSceneText(game, content)}
        notice={actionError || storageError ? null : game.notice}
        error={actionError ?? storageError}
        run={run}
        weight={runWeight(run, content, game.permanent.copyPositions)}
        slotsUsed={bagSlots(run, content, game.permanent.copyPositions)}
        choices={choices}
        exits={exits}
        items={content.items}
        objective={content.rumors.find((rumor) => rumor.id === game.selectedRumorId && content.locations.find((entry) => entry.id === rumor.targetLocation)?.regionId === (run.regionId ?? 'blackwind'))?.title}
        mapNext={(location?.next ?? []).map((id) => content.locations.find((entry) => entry.id === id)).filter((entry) => entry && (!entry.requiresFlag || run.flags.includes(entry.requiresFlag) || game.permanent.flags.includes(entry.requiresFlag))).map((entry) => entry!.name)}
        hideAvailable={!!location?.hideSpot}
        hidden={run.hiddenAt === run.locationId}
        onHide={() => performExplore(() => hideAt(game, content))}
        onLeaveHide={() => performExplore(() => leaveHiding(game))}
        studyOptions={content.copies.filter((copy) => ['bag', 'pocket'].includes(game.permanent.copyPositions[copy.id]?.kind ?? '') && !!copy.artId).map((copy) => ({ id: copy.id, title: copy.title, reason: fieldStudyReason(game, copy.id, content) }))}
        onStudy={(copyId) => performExplore(() => studyInField(game, copyId, content))}
        bagCopies={content.copies.filter((copy) => game.permanent.copyPositions[copy.id]?.kind === 'bag').map(copyView)}
        pocketCopies={content.copies.filter((copy) => game.permanent.copyPositions[copy.id]?.kind === 'pocket').map(copyView)}
        pocketWeight={pocketWeight(game, content)}
        onStowCopy={(copyId) => performExplore(() => stowCopy(game, copyId, content))}
        onStowItem={(itemId) => performExplore(() => stowSmallItem(game, itemId, content))}
        onDropItem={(itemId, place) => performExplore(() => dropCarriedItem(game, itemId, place, content))}
        onDropCopy={(copyId) => performExplore(() => dropCarriedCopy(game, copyId, content))}
        onRecoverItem={(itemId) => performExplore(() => recoverGroundItem(game, itemId, content))}
        tutorial={tutorial}
        onSkipTutorial={onSkipTutorial}
        onChoose={(id) => performExplore(() => id.startsWith('extract:') ? attemptExit(game, id.slice(8) as ExitId, content) : chooseEvent(game, id, content))}
        onAbandon={() => performExplore(() => failRun(game))}
      />
    );
  }

  if (game.phase === 'combat' && game.run?.battle) {
    return <CombatScreen battle={game.run.battle} hp={game.run.hp} items={game.run.inventory} availableTechniques={game.permanent.learnedArts.map((id) => ({ id, name: content.arts.find((art) => art.id === id)?.name ?? id }))} notice={game.notice} tutorial={tutorial} onSkipTutorial={onSkipTutorial} onAction={(action) => commit(resolveTurn(game, action))} />;
  }

  if (game.phase === 'result' && game.lastResult) return <ResultScreen result={game.lastResult} items={content.items} locations={content.locations} copies={content.copies} tutorial={tutorial} onSkipTutorial={onSkipTutorial} onReturn={() => commit(returnToTown(game))} />;

  const location = content.locations.find((entry) => entry.id === game.safeLocationId) ?? content.locations[0];
  const nextLocations = location.next.map((id) => content.locations.find((entry) => entry.id === id)).filter((entry): entry is NonNullable<typeof entry> => !!entry);
  return <>
    <TownScreen
      permanent={game.permanent} arts={content.arts} copies={content.copies} location={location} nextLocations={nextLocations} npcs={content.npcs} items={content.items}
      tutorial={tutorial} onSkipTutorial={onSkipTutorial}
      onVisit={(id) => commit(moveTo(game, id, content))}
      onBuy={(npcId, itemId) => commit(buyItem(game, npcId, itemId, content))}
      onLearn={(artId) => commit(learnArt(game, artId))}
      onStudy={(copyId) => commit(studyCopy(game, copyId, content))}
      onRumors={() => commit({ ...game, safeLocationId: 'teahouse', phase: 'rumors' })}
      onPrep={() => commit({ ...game, phase: 'prep' })}
      onMenu={() => { setGame(null); setActiveSlot(null); setRecovered(false); setScreen('title'); }}
      onExport={() => downloadText(`wuxia-slot-${activeSlot}.json`, exportSave(game))}
      onImportFile={(file) => { void file.text().then((text) => { setPendingImport(parseImport(text)); setImportError(null); }).catch((error: unknown) => { setPendingImport(null); setImportError(error instanceof Error ? error.message : '导入失败'); }); }}
      importPending={!!pendingImport} importError={importError}
      onConfirmImport={() => { if (!pendingImport) return; try { commitImport(localStorage, pendingImport, activeSlot); setGame(pendingImport); setPendingImport(null); setImportError(null); setRecovered(false); } catch (error) { setImportError(error instanceof Error ? error.message : '无法导入存档'); } }}
      onCancelImport={() => setPendingImport(null)}
    />
    {notice && <div className="floating-notice" role="status">{notice}</div>}
  </>;
}
