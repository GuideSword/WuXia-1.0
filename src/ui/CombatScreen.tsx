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

const intentions = { strike: '挥刀进攻', heavy: '蓄势重击', guard: '收刀防守' };

export function CombatScreen({ battle, hp, items, availableTechniques, notice, onAction }: Props) {
  return <main className="page combat-page">
    <div className="page-content">
      <p className="eyebrow">黑风寨 · 交锋 · 第 {battle.round} 回合</p>
      <h1>刀光相向</h1>
      <p className="intro">敌方意图：<strong>{intentions[battle.intent]}</strong></p>
      <div className="status-card"><div><span>你的气血</span><strong>{hp} / 100</strong></div><div><span>敌方气血</span><strong>{battle.enemyHp}</strong></div></div>
      <p className="scene-notice" aria-live="polite">{notice ?? '观察对方架势，再决定出手。'}</p>
      <div className="combat-actions">
        <button type="button" onClick={() => onAction({ type: 'attack' })}>普通攻击 <small>8 点伤害</small></button>
        <button type="button" disabled={availableTechniques.length === 0} onClick={() => onAction({ type: 'technique', artId: availableTechniques[0]?.id })}>施展招式 <small>{availableTechniques[0]?.name ?? '尚未习得武学'}</small></button>
        <button type="button" onClick={() => onAction({ type: 'defend' })}>防御 <small>本回合伤害减半</small></button>
        <button type="button" onClick={() => onAction({ type: 'movement' })}>施展身法 <small>避开大半伤害</small></button>
        <button type="button" disabled={!items.medicine} onClick={() => onAction({ type: 'item' })}>使用道具 <small>金疮药 {items.medicine ?? 0}；恢复 20 气血</small></button>
        <button type="button" onClick={() => onAction({ type: 'retreat' })}>撤出战斗 <small>风声 +15</small></button>
      </div>
    </div>
  </main>;
}
