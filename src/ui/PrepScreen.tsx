import { useState } from 'react';
import type { CopyDefinition, Counts, ItemDefinition, PermanentState, RegionId } from '../game/model';
import { BAG_CAPACITY, itemSlots, totalWeight } from '../game/engine/inventory';
import type { TutorialStep } from '../game/onboarding';
import { TutorialCard } from './TutorialCard';

interface Props {
  permanent: PermanentState;
  items: ItemDefinition[];
  copies?: CopyDefinition[];
  onBack: () => void;
  onStart: (coins: number, loadout: Counts, regionId: RegionId, carriedCopyIds: string[]) => void;
  tutorial?: TutorialStep | null;
  onSkipTutorial?: () => void;
}

export function PrepScreen({ permanent, items, copies = [], onBack, onStart, tutorial, onSkipTutorial }: Props) {
  const [coins, setCoins] = useState(0);
  const [loadout, setLoadout] = useState<Counts>({});
  const [regionId, setRegionId] = useState<RegionId>('blackwind');
  const [carriedCopyIds, setCarriedCopyIds] = useState<string[]>([]);
  const homeCopies = copies.filter((copy) => permanent.copyPositions[copy.id]?.kind === 'home');
  const weight = totalWeight(loadout, items) + carriedCopyIds.reduce((sum, id) => sum + (items.find((item) => item.id === copies.find((copy) => copy.id === id)?.itemId)?.weight ?? 0), 0);
  const slots = items.reduce((sum, item) => sum + Math.max(0, (loadout[item.id] ?? 0) - Number(['sword', 'mask'].includes(item.id) && (loadout[item.id] ?? 0) > 0)) * itemSlots(item), 0)
    + carriedCopyIds.reduce((sum, id) => {
      const item = items.find((entry) => entry.id === copies.find((copy) => copy.id === id)?.itemId);
      return sum + (item ? itemSlots(item) : 0);
    }, 0);
  const coinsValid = Number.isSafeInteger(coins) && coins >= 0 && coins <= permanent.coins;
  const valid = coinsValid && weight <= 30 && slots <= BAG_CAPACITY;
  return (
    <main className="page prep-page">
      <div className="page-content">
        <button className="text-button" type="button" onClick={onBack}>← 返回青石镇</button>
        <p className="eyebrow">出发整备</p>
        <h1>此去带什么</h1>
        <p className="intro">带得越多，退得越难。贴身与穿戴物品在失手时也能带回。</p>
        {permanent.raids > 0 && permanent.heardRumors.includes('qingyan_ruins') && <div className="loadout-row region-picker"><span>探索地点</span><button type="button" aria-pressed={regionId === 'blackwind'} onClick={() => setRegionId('blackwind')}>黑风寨</button><button type="button" aria-pressed={regionId === 'qingyan'} onClick={() => setRegionId('qingyan')}>青燕门旧址</button></div>}
        <TutorialCard step={regionId === 'qingyan' ? null : tutorial ?? null} onSkip={onSkipTutorial ?? (() => {})} />
        <div className="status-card prep-status"><div><span>可用银两</span><strong>{permanent.coins}</strong></div><div><span>负重</span><strong>{weight} / 30</strong></div><div><span>行囊</span><strong>{slots} / {BAG_CAPACITY} 格</strong></div></div>
        {items.filter((item) => permanent.stash[item.id]).map((item) => <label className="loadout-row" key={item.id}>{item.name} · {item.weight} 负重 · 占 {itemSlots(item)} 格<input type="number" min="0" max={permanent.stash[item.id]} value={loadout[item.id] ?? 0} onChange={(event) => setLoadout({ ...loadout, [item.id]: Math.max(0, Math.min(permanent.stash[item.id], Number(event.target.value) || 0)) })} /></label>)}
        {homeCopies.length > 0 && <section className="town-list" aria-label="家藏独本"><h2>家藏独本</h2><p className="hint">留在家中的书不会因本次失手而遗落。选带的书默认放入行囊。</p>{homeCopies.map((copy) => <label className="loadout-row" key={copy.id}>{copy.title}<input type="checkbox" checked={carriedCopyIds.includes(copy.id)} onChange={(event) => setCarriedCopyIds(event.target.checked ? [...carriedCopyIds, copy.id] : carriedCopyIds.filter((id) => id !== copy.id))} /></label>)}</section>}
        {weight > 30 && <p className="field-error">超过 30 负重上限。</p>}
        {slots > BAG_CAPACITY && <p className="field-error">超过 {BAG_CAPACITY} 格行囊容量。</p>}
        <label className="field-label" htmlFor="carried-coins">携带银两</label>
        <input id="carried-coins" className="number-input" type="number" min="0" max={permanent.coins} step="1" value={coins} onChange={(event) => setCoins(Number(event.target.value))} />
        {!coinsValid && <p className="field-error">携带银两必须是 0 到 {permanent.coins} 之间的整数。</p>}
        <p className="hint">未成功撤离时，带入危险区的银两也会遗失。</p>
      </div>
      <div className="bottom-action"><button className={`primary-button${tutorial?.actionId === 'start' && regionId === 'blackwind' ? ' tutorial-target' : ''}`} type="button" disabled={!valid} onClick={() => onStart(coins, Object.fromEntries(Object.entries(loadout).filter(([, count]) => count > 0)), regionId, carriedCopyIds)}>前往{regionId === 'qingyan' ? '青燕门旧址' : '黑风寨'}</button></div>
    </main>
  );
}
