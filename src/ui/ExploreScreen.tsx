import { useState } from 'react';
import type { EventChoice, ItemDefinition, RunState } from '../game/model';
import { heatLabels, heatStage } from '../game/engine/heat';
import type { ExitEvaluation, ExitId } from '../game/engine/exits';

interface Props {
  title: string;
  description: string;
  notice?: string | null;
  run: RunState;
  weight: number;
  choices: EventChoice[];
  exits: { id: ExitId; name: string; evaluation: ExitEvaluation }[];
  items?: ItemDefinition[];
  objective?: string | null;
  mapNext?: string[];
  onChoose: (choiceId: string) => void;
  onAbandon?: () => void;
}

export function ExploreScreen({ title, description, notice, run, weight, choices, exits, items = [], objective, mapNext = [], onChoose, onAbandon }: Props) {
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const localExitIds: Record<string, ExitId[]> = { gate: ['gate'], foothill: ['caravan'], back_hill: ['cliff', 'tunnel'], waterway: ['waterway'] };
  const localExits = exits.filter((exit) => localExitIds[run.locationId]?.includes(exit.id));
  const otherExits = exits.filter((exit) => !localExitIds[run.locationId]?.includes(exit.id));
  const itemName = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  const renderExit = ({ id, name, evaluation }: Props['exits'][number]) => {
    const label = evaluation.status.startsWith('roll') ? `掷骰争取${name}通行` : `从${name}撤离`;
    return <button className="choice-button exit-choice" key={id} type="button" aria-label={label} disabled={evaluation.status === 'closed'} aria-describedby={`exit-reason-${id}`} onClick={() => onChoose(`extract:${id}`)}><span>{label}</span><small id={`exit-reason-${id}`}>{evaluation.reason}</small></button>;
  };
  return (
    <main className="page explore-page">
      <div className="explore-illustration" aria-hidden="true" />
      <div className="explore-content">
        <p className="eyebrow">黑风寨 · 试探</p>
        <h1>{title}</h1>
        <div className="heat-line"><span>风声 · {heatLabels[heatStage(run.heat)]}</span><div className="heat-track"><div style={{ width: `${run.heat}%` }} /></div><strong>{run.heat}</strong></div>
        <p className="scene-description">{description}</p>
        {notice && <p className="scene-notice" role="status">{notice}</p>}
        <div className="quick-stats"><span>气血 {run.hp}</span><span>负重 {weight} / 30</span><span>携银 {run.coins}</span></div>
        {objective && <p className="objective-line">追查：{objective}</p>}
        <div className="choice-list">
          {choices.map((choice) => <button className="choice-button" key={choice.id} type="button" onClick={() => onChoose(choice.id)}><span>{choice.label}</span>{choice.riskHint && <small aria-hidden="true">{choice.riskHint}</small>}</button>)}
          <h2 className="exit-heading">撤离路线</h2>
          {localExits.length ? localExits.map(renderExit) : <p className="hint">此处没有出口，需继续寻找。</p>}
        </div>
        <details className="route-drawer"><summary>查看全部撤离路线</summary><div className="choice-list">{otherExits.map(renderExit)}</div></details>
        <details className="route-drawer"><summary>地图</summary><p className="hint">当前位置：{title}</p><p className="hint">下一步可到：{mapNext.join('、') || '暂无可通行道路'}</p></details>
        <details className="route-drawer"><summary>行动日志</summary><ol className="action-log">{(run.log ?? []).map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol></details>
        <details className="route-drawer"><summary>行囊与局势</summary>
          <p className="hint">气血 {run.hp} · 风声 {run.heat} · 负重 {weight}/30 · 携银 {run.coins}</p>
          <p className="hint">携带：{Object.entries(run.inventory).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}`).join('、') || '无'}</p>
          <p className="hint">战利品：{Object.entries(run.loot).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}`).join('、') || '无'}</p>
          {onAbandon && (!confirmAbandon ? <button className="abandon-button" type="button" onClick={() => setConfirmAbandon(true)}>放弃本局</button> : <div className="confirm-box"><p>放弃后，本局携带物资与战利品会遗失。确定吗？</p><button type="button" onClick={onAbandon}>确认放弃本局</button><button type="button" onClick={() => setConfirmAbandon(false)}>取消</button></div>)}
        </details>
      </div>
    </main>
  );
}
