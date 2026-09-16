import { useMemo, useState } from 'react';
import { loadBundledContent } from './game/content/load';
import { moveTo, returnToTown, startRun } from './game/engine/lifecycle';
import { chooseEvent, getChoices, getSceneText } from './game/engine/events';
import { runWeight } from './game/engine/inventory';
import { resolveTurn } from './game/engine/combat';
import { attemptExit, evaluateExit, exitContext, exitIds, exitNames, type ExitId } from './game/engine/exits';
import type { EventChoice, GameState } from './game/model';
import { commitImport, exportSave, loadGame, parseImport, saveGame } from './game/save';
import { ExploreScreen } from './ui/ExploreScreen';
import { PrepScreen } from './ui/PrepScreen';
import { ResultScreen } from './ui/ResultScreen';
import { TownScreen } from './ui/TownScreen';
import { CombatScreen } from './ui/CombatScreen';
import { learnArt } from './game/engine/martial';
import { hearRumor } from './game/engine/rumors';
import { RumorScreen } from './ui/RumorScreen';
import { buyItem } from './game/engine/shop';
import { ErrorScreen } from './ui/ErrorScreen';
import { downloadText } from './ui/download';
import { createGame } from './game/engine/lifecycle';

export default function App() {
  const content = useMemo(loadBundledContent, []);
  const initial = useMemo(() => {
    let recovered = false;
    try {
      return { game: loadGame(localStorage, () => { recovered = true; }), recovered, error: null as string | null };
    } catch (error) {
      return { game: null as GameState | null, recovered: false, error: error instanceof Error ? error.message : '存档无法读取' };
    }
  }, []);
  const [game, setGame] = useState<GameState | null>(initial.game);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<GameState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  if (!game) {
    return <ErrorScreen error={initial.error ?? '存档无法读取'} onExport={() => downloadText('wuxia-diagnostic.json', JSON.stringify({ current: localStorage.getItem('wuxia.current'), lastKnownGood: localStorage.getItem('wuxia.lastKnownGood') }, null, 2))} onReset={() => { downloadText('wuxia-raw-backup.json', JSON.stringify({ current: localStorage.getItem('wuxia.current'), lastKnownGood: localStorage.getItem('wuxia.lastKnownGood') }, null, 2)); const fresh = createGame(); saveGame(localStorage, fresh); setGame(fresh); }} />;
  }

  function commit(next: GameState) {
    try {
      saveGame(localStorage, next);
      setGame(next);
      setStorageError(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : '无法保存进度');
    }
  }

  const notice = storageError ?? (initial.recovered ? '已恢复上一稳定存档。' : null);

  if (game.phase === 'prep') {
    return <><PrepScreen permanent={game.permanent} items={content.items} onBack={() => commit({ ...game, phase: 'town' })} onStart={(coins, loadout) => commit(startRun(game, loadout, coins, Date.now(), content))} />{notice && <div className="floating-notice" role="status">{notice}</div>}</>;
  }

  if (game.phase === 'rumors') {
    const offered = content.npcs.find((npc) => npc.id === 'storyteller')?.rumorsOffered ?? [];
    return <RumorScreen rumors={content.rumors.filter((rumor) => offered.includes(rumor.id) || game.permanent.confirmedRumors.includes(rumor.id))} heard={game.permanent.heardRumors} confirmed={game.permanent.confirmedRumors} selected={game.selectedRumorId} coins={game.permanent.coins} onHear={(id) => commit(hearRumor(game, id, content))} onTrack={(id) => commit({ ...game, selectedRumorId: id, phase: 'prep' })} onBack={() => commit({ ...game, phase: 'town' })} />;
  }

  if (game.phase === 'explore' && game.run) {
    const run = game.run;
    const location = content.locations.find((entry) => entry.id === run.locationId);
    const choices: EventChoice[] = getChoices(game, content);
    const context = exitContext(game, content);
    const exits = exitIds.map((id) => ({ id, name: exitNames[id], evaluation: evaluateExit(id, context) }));
    return (
      <ExploreScreen
        title={location?.name ?? '黑风寨'}
        description={getSceneText(game, content)}
        notice={game.notice}
        run={run}
        weight={runWeight(run, content)}
        choices={choices}
        exits={exits}
        onChoose={(id) => commit(id.startsWith('extract:') ? attemptExit(game, id.slice(8) as ExitId, content) : chooseEvent(game, id, content))}
      />
    );
  }

  if (game.phase === 'combat' && game.run?.battle) {
    return <CombatScreen battle={game.run.battle} hp={game.run.hp} items={game.run.inventory} availableTechniques={game.permanent.learnedArts.map((id) => ({ id, name: content.arts.find((art) => art.id === id)?.name ?? id }))} notice={game.notice} onAction={(action) => commit(resolveTurn(game, action))} />;
  }

  if (game.phase === 'result' && game.lastResult) return <ResultScreen result={game.lastResult} onReturn={() => commit(returnToTown(game))} />;

  const location = content.locations.find((entry) => entry.id === game.safeLocationId) ?? content.locations[0];
  const nextLocations = location.next.map((id) => content.locations.find((entry) => entry.id === id)).filter((entry): entry is NonNullable<typeof entry> => !!entry);
  return <><TownScreen permanent={game.permanent} arts={content.arts} location={location} nextLocations={nextLocations} npcs={content.npcs} items={content.items} onVisit={(id) => commit(moveTo(game, id, content))} onBuy={(npcId, itemId) => commit(buyItem(game, npcId, itemId, content))} onLearn={(artId) => commit(learnArt(game, artId))} onRumors={() => commit({ ...game, safeLocationId: 'teahouse', phase: 'rumors' })} onPrep={() => commit({ ...game, phase: 'prep' })} onExport={() => downloadText('wuxia-save.json', exportSave(game))} onImportFile={(file) => { void file.text().then((text) => { setPendingImport(parseImport(text)); setImportError(null); }).catch((error: unknown) => { setPendingImport(null); setImportError(error instanceof Error ? error.message : '导入失败'); }); }} importPending={!!pendingImport} importError={importError} onConfirmImport={() => { if (!pendingImport) return; try { commitImport(localStorage, pendingImport); setGame(pendingImport); setPendingImport(null); setImportError(null); } catch (error) { setImportError(error instanceof Error ? error.message : '无法导入存档'); } }} onCancelImport={() => setPendingImport(null)} />{notice && <div className="floating-notice" role="status">{notice}</div>}</>;
}
