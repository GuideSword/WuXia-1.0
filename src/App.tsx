import { useMemo, useState } from 'react';
import { loadBundledContent } from './game/content/load';
import { createGame, extract, moveTo, returnToTown, startRun } from './game/engine/lifecycle';
import type { EventChoice, GameState } from './game/model';
import { ExploreScreen } from './ui/ExploreScreen';
import { PrepScreen } from './ui/PrepScreen';
import { ResultScreen } from './ui/ResultScreen';
import { TownScreen } from './ui/TownScreen';

export default function App() {
  const content = useMemo(loadBundledContent, []);
  const [game, setGame] = useState<GameState>(createGame);

  if (game.phase === 'prep') {
    return <PrepScreen permanent={game.permanent} onBack={() => setGame((current) => ({ ...current, phase: 'town' }))} onStart={(coins) => setGame((current) => startRun(current, {}, coins, Date.now()))} />;
  }

  if (game.phase === 'explore' && game.run) {
    const run = game.run;
    const location = content.locations.find((entry) => entry.id === run.locationId);
    const choices: EventChoice[] = (location?.next ?? []).map((id) => ({ id: `go:${id}`, label: `前往${content.locations.find((entry) => entry.id === id)?.name.replace('黑风寨', '') ?? id}`, conditions: [], effects: [], riskHint: '转移地点' }));
    if (run.locationId === 'gate') choices.push({ id: 'extract:gate', label: '从山门撤离', conditions: [], effects: [], riskHint: '安全路线' });
    return (
      <ExploreScreen
        title={location?.name ?? '黑风寨'}
        description={location?.description ?? ''}
        run={run}
        choices={choices}
        onChoose={(id) => setGame((current) => id.startsWith('go:') ? moveTo(current, id.slice(3), content) : extract(current, 'gate'))}
      />
    );
  }

  if (game.phase === 'result' && game.lastResult) return <ResultScreen result={game.lastResult} onReturn={() => setGame(returnToTown)} />;

  return <TownScreen permanent={game.permanent} onPrep={() => setGame((current) => ({ ...current, phase: 'prep' }))} />;
}
