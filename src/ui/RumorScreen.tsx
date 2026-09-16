import type { RumorDefinition } from '../game/model';

interface Props {
  rumors: RumorDefinition[];
  heard: string[];
  confirmed: string[];
  selected: string | null;
  coins: number;
  onHear: (id: string) => void;
  onTrack: (id: string) => void;
  onBack: () => void;
}

export function RumorScreen({ rumors, heard, confirmed, selected, coins, onHear, onTrack, onBack }: Props) {
  return <main className="page rumors-page">
    <div className="page-content">
      <button className="text-button" type="button" onClick={onBack}>← 返回青石镇</button>
      <p className="eyebrow">茶馆 · 风闻</p>
      <h1>江湖传闻</h1>
      <p className="intro">听来的事未必是真。先探听，再入寨找证据。现有银两 {coins}。</p>
      <div className="rumor-list">
        {rumors.map((rumor) => {
          const known = heard.includes(rumor.id) || confirmed.includes(rumor.id);
          const proven = confirmed.includes(rumor.id);
          return <article className="rumor-card" key={rumor.id}>
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
