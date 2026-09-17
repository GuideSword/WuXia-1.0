import { useState } from 'react';
import type { BattleState, Counts } from '../game/model';
import type { CombatAction } from '../game/engine/combat';

interface Props {
  battle: BattleState;
  hp: number;
  items: Counts;
  availableTechniques: { id: string; name: string }[];
  notice?: string | null;
  onAction: (action: CombatAction) => void;
}

const intentions = { strike: '挥刀进攻【先手】', heavy: '蓄势重击【刚】【爆发】', guard: '收刀防守【守势】' };

export function CombatScreen({ battle, hp, items, availableTechniques, notice, onAction }: Props) {
  const [selectedArt, setSelectedArt] = useState(availableTechniques[0]?.id ?? '');
  return <main className="page combat-page">
    <div className="page-content">
      <p className="eyebrow">黑风寨 · 交锋 · 第 {battle.round} 回合</p>
      <h1>刀光相向</h1>
      <p className="intro">敌方意图：<strong>{intentions[battle.intent]}</strong></p>
      <div className="status-card"><div><span>你的气血</span><strong>{hp} / 100</strong></div><div><span>敌方气血</span><strong>{battle.enemyHp}</strong></div></div>
      <p className="scene-notice" aria-live="polite">{notice ?? '观察对方架势，再决定出手。'}</p>
      <label className="field-label" htmlFor="combat-art">选择武学招式</label>
      <select className="art-select" id="combat-art" value={selectedArt} disabled={availableTechniques.length === 0} onChange={(event) => setSelectedArt(event.target.value)}>
        {availableTechniques.length === 0 && <option value="">尚未习得武学</option>}
        {availableTechniques.map((art) => <option key={art.id} value={art.id}>{art.name}</option>)}
      </select>
      <div className="combat-actions">
        <button type="button" onClick={() => onAction({ type: 'attack' })}>普通攻击 <small>8 点伤害</small></button>
        <button type="button" disabled={!selectedArt} onClick={() => onAction({ type: 'technique', artId: selectedArt })}>施展招式 <small>{availableTechniques.find((art) => art.id === selectedArt)?.name ?? '尚未习得武学'}</small></button>
        <button type="button" onClick={() => onAction({ type: 'defend' })}>防御 <small>本回合伤害减半</small></button>
        <button type="button" onClick={() => onAction({ type: 'movement' })}>施展身法 <small>避开大半伤害</small></button>
        <button type="button" disabled={!items.medicine} onClick={() => onAction({ type: 'item' })}>使用道具 <small>金疮药 {items.medicine ?? 0}；恢复 20 气血</small></button>
        <button type="button" onClick={() => onAction({ type: 'retreat' })}>撤出战斗 <small>风声 +15</small></button>
      </div>
    </div>
  </main>;
}
