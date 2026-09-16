import { useMemo, useState } from 'react';
import { loadBundledContent } from './game/content/load';
import { extract, returnToTown, startRun } from './game/engine/lifecycle';
import { chooseEvent, getChoices, getSceneText } from './game/engine/events';
import type { EventChoice, GameState } from './game/model';
import { loadGame, saveGame } from './game/save';
import { ExploreScreen } from './ui/ExploreScreen';
import { PrepScreen } from './ui/PrepScreen';
import { ResultScreen } from './ui/ResultScreen';
import { TownScreen } from './ui/TownScreen';

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

  if (!game) {
    return <main className="page"><div className="page-content"><h1>存档需要处理</h1><p role="alert">{initial.error}</p><p className="hint">原始存档仍保留在浏览器中。请勿清除网站数据。</p></div></main>;
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
    return <><PrepScreen permanent={game.permanent} onBack={() => commit({ ...game, phase: 'town' })} onStart={(coins) => commit(startRun(game, {}, coins, Date.now()))} />{notice && <div className="floating-notice" role="status">{notice}</div>}</>;
  }

  if (game.phase === 'explore' && game.run) {
    const run = game.run;
    const location = content.locations.find((entry) => entry.id === run.locationId);
    const choices: EventChoice[] = getChoices(game, content);
    if (run.locationId === 'gate') choices.push({ id: 'extract:gate', label: '从山门撤离', conditions: [], effects: [], riskHint: '安全路线' });
    return (
      <ExploreScreen
        title={location?.name ?? '黑风寨'}
        description={getSceneText(game, content)}
        run={run}
        choices={choices}
        onChoose={(id) => commit(id.startsWith('extract:') ? extract(game, 'gate') : chooseEvent(game, id, content))}
      />
    );
  }

  if (game.phase === 'result' && game.lastResult) return <ResultScreen result={game.lastResult} onReturn={() => commit(returnToTown(game))} />;

  return <><TownScreen permanent={game.permanent} onPrep={() => commit({ ...game, phase: 'prep' })} />{notice && <div className="floating-notice" role="status">{notice}</div>}</>;
}
