import type { EventChoice, RunState } from '../game/model';
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
  onChoose: (choiceId: string) => void;
}

export function ExploreScreen({ title, description, notice, run, weight, choices, exits, onChoose }: Props) {
  return (
    <main className="page explore-page">
      <div className="explore-illustration" aria-hidden="true"><div className="mountain mountain-back" /><div className="mountain mountain-front" /></div>
      <div className="explore-content">
        <p className="eyebrow">黑风寨 · 试探</p>
        <h1>{title}</h1>
        <div className="heat-line"><span>风声 · {heatLabels[heatStage(run.heat)]}</span><div className="heat-track"><div style={{ width: `${run.heat}%` }} /></div><strong>{run.heat}</strong></div>
        <p className="scene-description">{description}</p>
        {notice && <p className="scene-notice" role="status">{notice}</p>}
        <div className="quick-stats"><span>气血 {run.hp}</span><span>负重 {weight} / 30</span><span>携银 {run.coins}</span></div>
        <div className="choice-list">
          {choices.map((choice) => <button className="choice-button" key={choice.id} type="button" onClick={() => onChoose(choice.id)}><span>{choice.label}</span>{choice.riskHint && <small aria-hidden="true">{choice.riskHint}</small>}</button>)}
          <h2 className="exit-heading">撤离路线</h2>
          {exits.map(({ id, name, evaluation }) => {
            const label = evaluation.status.startsWith('roll') ? `掷骰争取${name}通行` : `从${name}撤离`;
            return <button className="choice-button exit-choice" key={id} type="button" aria-label={label} disabled={evaluation.status === 'closed'} aria-describedby={`exit-reason-${id}`} onClick={() => onChoose(`extract:${id}`)}><span>{label}</span><small id={`exit-reason-${id}`}>{evaluation.reason}</small></button>;
          })}
        </div>
      </div>
    </main>
  );
}
