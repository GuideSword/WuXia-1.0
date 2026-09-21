import type { TutorialStep } from '../game/onboarding';

interface Props {
  step: TutorialStep | null;
  onSkip: () => void;
  onAction?: () => void;
}

export function TutorialCard({ step, onSkip, onAction }: Props) {
  if (!step) return null;
  return <aside className="tutorial-card" aria-label="新手指引">
    <div className="tutorial-heading"><span>新手指引</span>{step.skippable !== false && <button type="button" onClick={onSkip}>跳过指引</button>}</div>
    <h2>{step.title}</h2>
    <p>{step.instruction}</p>
    {step.actionLabel && <p className="tutorial-next">下一步：{step.actionLabel}</p>}
    {onAction && step.actionLabel && <button className="tutorial-action" type="button" onClick={onAction}>开始这一步</button>}
  </aside>;
}
