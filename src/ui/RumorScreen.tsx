import type { RumorDefinition } from '../game/model';
import type { TutorialStep } from '../game/onboarding';
import { TutorialCard } from './TutorialCard';

interface Props {
  rumors: RumorDefinition[];
  heard: string[];
  confirmed: string[];
  selected: string | null;
  coins: number;
  witnessedStyles?: string[];
  onHear: (id: string) => void;
  onTrack: (id: string) => void;
  onBack: () => void;
  tutorial?: TutorialStep | null;
  onSkipTutorial?: () => void;
}

export function RumorScreen({ rumors, heard, confirmed, selected, coins, witnessedStyles = [], onHear, onTrack, onBack, tutorial, onSkipTutorial }: Props) {
  return <main className="page rumors-page">
    <div className="page-content">
      <button className="text-button" type="button" onClick={onBack}>← 返回青石镇</button>
      <p className="eyebrow">茶馆 · 风闻</p>
      <h1>江湖传闻</h1>
      <p className="intro">听来的事未必是真。先探听，再赴目标地点查证。现有银两 {coins}。</p>
      <TutorialCard step={tutorial ?? null} onSkip={onSkipTutorial ?? (() => {})} />
      {witnessedStyles.map((name) => <p className="scene-notice" key={name}>寨中有人传出疑似{name}招式的目击消息；尚未证实。再入寨时山门盘查更严。</p>)}
      <div className="rumor-list">
        {rumors.map((rumor) => {
          const known = heard.includes(rumor.id) || confirmed.includes(rumor.id);
          const proven = confirmed.includes(rumor.id);
          return <article className={`rumor-card${tutorial?.actionId === `${known ? 'track' : 'hear'}:${rumor.id}` ? ' tutorial-target' : ''}`} key={rumor.id}>
            <h2>{rumor.title}</h2>
            <p>来源：{rumor.source} · 可信度 {Math.round(rumor.credibility * 100)}%</p>
            <p>目标：{rumor.targetLocation} · 可能所得：{rumor.valueHint}</p>
            <p>风险：{rumor.dangerHint}</p>
            <p className="hint">{proven ? '已证实' : known ? '已探听，尚未证实' : `探听需 ${rumor.cost} 两`}{selected === rumor.id ? ' · 当前追查' : ''}</p>
            {!known ? <button type="button" disabled={coins < rumor.cost} onClick={() => onHear(rumor.id)}>探听{rumor.title}</button> : <button type="button" onClick={() => onTrack(rumor.id)}>追查此线索</button>}
          </article>;
        })}
      </div>
    </div>
  </main>;
}
