import type { EventChoice, ItemDefinition, RunState } from '../game/model';
import type { ItemPlace } from '../game/engine/bag';
import { heatLabels, heatStage } from '../game/engine/heat';
import type { ExitEvaluation, ExitId } from '../game/engine/exits';
import type { TutorialStep } from '../game/onboarding';
import { TutorialCard } from './TutorialCard';
import { BagPanel, type BagCopyView } from './BagPanel';

interface Props {
  title: string;
  description: string;
  notice?: string | null;
  error?: string | null;
  run: RunState;
  weight: number;
  slotsUsed?: number;
  choices: EventChoice[];
  exits: { id: ExitId; name: string; evaluation: ExitEvaluation }[];
  items?: ItemDefinition[];
  objective?: string | null;
  mapNext?: string[];
  onChoose: (choiceId: string) => void;
  onAbandon?: () => void;
  hideAvailable?: boolean;
  hidden?: boolean;
  onHide?: () => void;
  onLeaveHide?: () => void;
  studyOptions?: { id: string; title: string; reason: string | null }[];
  onStudy?: (copyId: string) => void;
  bagCopies?: BagCopyView[];
  pocketCopies?: BagCopyView[];
  pocketWeight?: number;
  onStowCopy?: (copyId: string) => void;
  onStowItem?: (itemId: string) => void;
  onDropItem?: (itemId: string, place: ItemPlace) => void;
  onDropCopy?: (copyId: string) => void;
  onRecoverItem?: (itemId: string) => void;
  tutorial?: TutorialStep | null;
  onSkipTutorial?: () => void;
}

export function ExploreScreen({ title, description, notice, error, run, weight, slotsUsed = 0, choices, exits, items = [], objective, mapNext = [], onChoose, onAbandon, hideAvailable, hidden, onHide, onLeaveHide, studyOptions = [], onStudy, bagCopies = [], pocketCopies = [], pocketWeight = 0, onStowCopy, onStowItem, onDropItem, onDropCopy, onRecoverItem, tutorial, onSkipTutorial }: Props) {
  const localExitIds: Record<string, ExitId[]> = { gate: ['gate'], foothill: ['caravan'], back_hill: ['cliff', 'tunnel'], waterway: ['waterway'], qingyan_gate: ['qingyan_return'], qingyan_hall: ['qingyan_cliff'] };
  const localExits = exits.filter((exit) => localExitIds[run.locationId]?.includes(exit.id));
  const otherExits = exits.filter((exit) => !localExitIds[run.locationId]?.includes(exit.id));
  const movementChoices = choices.filter((choice) => choice.id.startsWith('go:'));
  const sceneChoices = choices.filter((choice) => !choice.id.startsWith('go:'));
  const sceneActionCount = sceneChoices.length + localExits.length + studyOptions.length + Number(!!hideAvailable || !!hidden);
  const [resultText, resultChanges] = notice?.split('\n', 2) ?? [];
  const renderExit = ({ id, name, evaluation }: Props['exits'][number], placement: 'scene' | 'menu') => {
    const label = evaluation.status.startsWith('roll') ? `掷骰争取${name}通行` : `从${name}撤离`;
    const reasonId = `exit-reason-${placement}-${id}`;
    return <button className={`choice-button exit-choice option-exit option-exit--${evaluation.status}${tutorial?.actionId === `extract:${id}` ? ' tutorial-target' : ''}`} key={id} type="button" aria-label={label} disabled={evaluation.status === 'closed'} aria-describedby={reasonId} onClick={() => onChoose(`extract:${id}`)}><span className="option-icon" aria-hidden="true">{evaluation.status === 'closed' ? '锁' : evaluation.status === 'open' ? '离' : '骰'}</span><span className="option-label">{label}</span><small className="option-detail" id={reasonId}>{evaluation.reason}</small></button>;
  };
  const renderChoice = (choice: EventChoice, compact = false) => {
    const kind = choice.effects.some((effect) => effect.type === 'startBattle') ? 'combat' : choice.riskHint?.includes('风声 +') ? 'risk' : 'event';
    const hintId = choice.riskHint && !compact ? `choice-hint-${choice.id}` : undefined;
    return <button className={`choice-button option-${compact ? 'move' : kind}${compact ? ' compact-move' : ''}${tutorial?.actionId === choice.id ? ' tutorial-target' : ''}`} key={choice.id} type="button" aria-label={choice.label} aria-describedby={hintId} onClick={() => onChoose(choice.id)}><span className="option-icon" aria-hidden="true">{compact ? '行' : { combat: '战', risk: '险', event: '事' }[kind]}</span><span className="option-label">{compact ? choice.label.replace(/^前往/, '') : choice.label}</span>{hintId && <small className="option-detail" id={hintId}>{choice.riskHint}</small>}</button>;
  };
  return (
    <main className="page explore-page">
      <div className="explore-illustration" aria-hidden="true" />
      <section className="explore-story" aria-label="当前场景与最新反馈">
        <p className="eyebrow">{run.regionId === 'qingyan' ? '青燕门旧址' : '黑风寨'} · 试探</p>
        <h1>{title}</h1>
        <div className="heat-line"><span>风声 · {heatLabels[heatStage(run.heat)]}</span><div className="heat-track"><div style={{ width: `${run.heat}%` }} /></div><strong>{run.heat}</strong></div>
        <div className="explore-story-scroll" tabIndex={0} role="region" aria-label="场景文字，可独立滚动"><p className="scene-description">{description}</p>{objective && <p className="objective-line">追查：{objective}</p>}{tutorial && <p className="explore-guide">当前指引：{tutorial.actionLabel ?? tutorial.title}</p>}<TutorialCard step={tutorial ?? null} onSkip={onSkipTutorial ?? (() => {})} /></div>
        {error ? <div className="explore-result explore-error" role="alert"><strong>行动未完成</strong><p>{error}</p></div> : resultText && <div className="scene-notice explore-result" role="status"><strong>刚刚发生</strong><p>{resultText}</p>{resultChanges && <small>{resultChanges}</small>}</div>}
        <div className="quick-stats"><span>气血 {run.hp}</span><span>负重 {weight} / 30</span><span>背包 {slotsUsed} / 12 格</span><span>携银 {run.coins}</span></div>
      </section>
      <section className="explore-actions" key={run.locationId} aria-label="探索行动">
        {sceneActionCount > 0 && <div className="explore-action-group explore-scene-group"><div className="explore-group-heading"><h2>眼前的事</h2><span>{sceneActionCount} 项 · 独立滚动</span></div><div className="explore-action-scroll" role="region" aria-label="当前场景行动，可独立滚动" tabIndex={0}><div className="choice-list option-list">
          {sceneChoices.map((choice) => renderChoice(choice))}
          {hideAvailable && !hidden && <button className="choice-button option-hide" type="button" aria-label="寻找藏身处" aria-describedby="hide-spot-hint" onClick={onHide}><span className="option-icon" aria-hidden="true">隐</span><span className="option-label">寻找藏身处</span><small className="option-detail" id="hide-spot-hint">避开视线后可以研读随身秘籍</small></button>}
          {hidden && <p className="hint" role="status">你已藏好身形；移动或交战会暴露位置。</p>}
          {hidden && <button className="choice-button option-hide" type="button" onClick={onLeaveHide}><span className="option-icon" aria-hidden="true">隐</span><span className="option-label">离开藏身处</span></button>}
          {studyOptions.map((option) => <button className="choice-button option-study" key={option.id} type="button" disabled={!!option.reason} aria-label={`研读${option.title}`} aria-describedby={`study-hint-${option.id}`} onClick={() => onStudy?.(option.id)}><span className="option-icon" aria-hidden="true">{option.reason ? '锁' : '悟'}</span><span className="option-label">研读{option.title}</span><small className="option-detail" id={`study-hint-${option.id}`}>{option.reason ?? '花一次行动，巡逻继续推进'}</small></button>)}
          {localExits.map((exit) => renderExit(exit, 'scene'))}
        </div></div></div>}
        {movementChoices.length > 0 && <div className="explore-action-group explore-move-group"><div className="explore-group-heading"><h2>前往别处</h2><span>{movementChoices.length} 处 · 独立滚动</span></div><div className="explore-action-scroll" role="region" aria-label="可前往地点，可独立滚动" tabIndex={0}><div className="explore-move-list">{movementChoices.map((choice) => renderChoice(choice, true))}</div></div></div>}
      </section>
      <nav className="explore-menu" aria-label="探索工具">
        <details className="route-drawer" name="explore-tool"><summary>撤离局势</summary><div className="menu-popover"><p className="hint">当前位置：{title}。可从当前位置撤离的路线显示在行动列表中。</p><div className="choice-list">{otherExits.map((exit) => renderExit(exit, 'menu'))}</div></div></details>
        <details className="route-drawer" name="explore-tool"><summary>地图</summary><div className="menu-popover"><p className="hint">当前位置：{title}</p><p className="hint">下一步可到：{mapNext.join('、') || '暂无可通行道路'}</p></div></details>
        <details className="route-drawer" name="explore-tool"><summary>行动日志</summary><div className="menu-popover"><ol className="action-log">{(run.log ?? []).map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol></div></details>
        <details className="route-drawer" name="explore-tool"><summary>行囊与局势</summary><div className="menu-popover pack-popover"><BagPanel run={run} items={items} weight={weight} slotsUsed={slotsUsed} pocketWeight={pocketWeight} bagCopies={bagCopies} pocketCopies={pocketCopies} feedback={notice} error={error} onStowCopy={onStowCopy} onStowItem={onStowItem} onDropItem={onDropItem} onDropCopy={onDropCopy} onRecoverItem={onRecoverItem} onAbandon={onAbandon} /></div></details>
      </nav>
    </main>
  );
}
