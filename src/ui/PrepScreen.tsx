import { useState } from 'react';
import type { PermanentState } from '../game/model';

interface Props {
  permanent: PermanentState;
  onBack: () => void;
  onStart: (coins: number) => void;
}

export function PrepScreen({ permanent, onBack, onStart }: Props) {
  const [coins, setCoins] = useState(0);
  const valid = Number.isSafeInteger(coins) && coins >= 0 && coins <= permanent.coins;
  return (
    <main className="page">
      <div className="page-content">
        <button className="text-button" type="button" onClick={onBack}>← 返回青石镇</button>
        <p className="eyebrow">出发整备</p>
        <h1>此去带什么</h1>
        <p className="intro">带得越多，退得越难。暂时没有可选装备，先摸清山门与撤离路线。</p>
        <div className="status-card prep-status"><div><span>可用银两</span><strong>{permanent.coins}</strong></div><div><span>负重</span><strong>0 / 30</strong></div></div>
        <label className="field-label" htmlFor="carried-coins">携带银两</label>
        <input id="carried-coins" className="number-input" type="number" min="0" max={permanent.coins} step="1" value={coins} onChange={(event) => setCoins(Number(event.target.value))} />
        {!valid && <p className="field-error">携带银两必须是 0 到 {permanent.coins} 之间的整数。</p>}
        <p className="hint">未成功撤离时，带入危险区的银两也会遗失。</p>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" disabled={!valid} onClick={() => onStart(coins)}>前往黑风寨</button></div>
    </main>
  );
}
