import type { EventChoice, RunState } from '../game/model';

interface Props {
  title: string;
  description: string;
  run: RunState;
  choices: EventChoice[];
  onChoose: (choiceId: string) => void;
}

export function ExploreScreen({ title, description, run, choices, onChoose }: Props) {
  return (
    <main className="page explore-page">
      <div className="explore-illustration" aria-hidden="true"><div className="mountain mountain-back" /><div className="mountain mountain-front" /></div>
      <div className="explore-content">
        <p className="eyebrow">黑风寨 · 试探</p>
        <h1>{title}</h1>
        <div className="heat-line"><span>风声</span><div className="heat-track"><div style={{ width: `${run.heat}%` }} /></div><strong>{run.heat}</strong></div>
        <p className="scene-description">{description}</p>
        <div className="quick-stats"><span>气血 {run.hp}</span><span>负重 0 / 30</span><span>携银 {run.coins}</span></div>
        <div className="choice-list">
          {choices.map((choice) => <button className={`choice-button ${choice.id.startsWith('extract:') ? 'exit-choice' : ''}`} key={choice.id} type="button" onClick={() => onChoose(choice.id)}><span>{choice.label}</span>{choice.riskHint && <small aria-hidden="true">{choice.riskHint}</small>}</button>)}
        </div>
      </div>
    </main>
  );
}
