import { useState } from 'react';
import type { Counts, ItemDefinition, PermanentState } from '../game/model';
import { totalWeight } from '../game/engine/inventory';

interface Props {
  permanent: PermanentState;
  items: ItemDefinition[];
  onBack: () => void;
  onStart: (coins: number, loadout: Counts) => void;
}

export function PrepScreen({ permanent, items, onBack, onStart }: Props) {
  const [coins, setCoins] = useState(0);
  const [loadout, setLoadout] = useState<Counts>({});
  const weight = totalWeight(loadout, items);
  const valid = Number.isSafeInteger(coins) && coins >= 0 && coins <= permanent.coins && weight <= 30;
  return (
    <main className="page">
      <div className="page-content">
        <button className="text-button" type="button" onClick={onBack}>← 返回青石镇</button>
        <p className="eyebrow">出发整备</p>
        <h1>此去带什么</h1>
        <p className="intro">带得越多，退得越难。选择带入寨中的物资，未撤离则会遗失。</p>
        <div className="status-card prep-status"><div><span>可用银两</span><strong>{permanent.coins}</strong></div><div><span>负重</span><strong>{weight} / 30</strong></div></div>
        {items.filter((item) => permanent.stash[item.id]).map((item) => <label className="loadout-row" key={item.id}>{item.name} · {item.weight} 负重 <input type="number" min="0" max={permanent.stash[item.id]} value={loadout[item.id] ?? 0} onChange={(event) => setLoadout({ ...loadout, [item.id]: Math.max(0, Math.min(permanent.stash[item.id], Number(event.target.value) || 0)) })} /></label>)}
        {weight > 30 && <p className="field-error">超过 30 负重上限。</p>}
        <label className="field-label" htmlFor="carried-coins">携带银两</label>
        <input id="carried-coins" className="number-input" type="number" min="0" max={permanent.coins} step="1" value={coins} onChange={(event) => setCoins(Number(event.target.value))} />
        {!valid && <p className="field-error">携带银两必须是 0 到 {permanent.coins} 之间的整数。</p>}
        <p className="hint">未成功撤离时，带入危险区的银两也会遗失。</p>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" disabled={!valid} onClick={() => onStart(coins, Object.fromEntries(Object.entries(loadout).filter(([, count]) => count > 0)))}>前往黑风寨</button></div>
    </main>
  );
}
