import { useState } from 'react';
import type { ItemDefinition, RunState } from '../game/model';
import { BAG_CAPACITY, itemSlots } from '../game/engine/inventory';
import type { ItemPlace } from '../game/engine/bag';

export interface BagCopyView {
  id: string;
  title: string;
  weight: number;
  slots: number;
}

interface Props {
  run: RunState;
  items: ItemDefinition[];
  weight: number;
  slotsUsed: number;
  pocketWeight: number;
  bagCopies: BagCopyView[];
  pocketCopies: BagCopyView[];
  feedback?: string | null;
  error?: string | null;
  onStowCopy?: (copyId: string) => void;
  onStowItem?: (itemId: string) => void;
  onDropItem?: (itemId: string, place: ItemPlace) => void;
  onDropCopy?: (copyId: string) => void;
  onRecoverItem?: (itemId: string) => void;
  onAbandon?: () => void;
}

export function BagPanel({ run, items, weight, slotsUsed, pocketWeight, bagCopies, pocketCopies, feedback, error, onStowCopy, onStowItem, onDropItem, onDropCopy, onRecoverItem, onAbandon }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const itemName = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  const bagItems = items.map((item) => ({ item, count: (run.inventory[item.id] ?? 0) + (run.loot[item.id] ?? 0) - (run.pocketItems?.[item.id] ?? 0) - Number(run.wornItemIds?.includes(item.id) ?? false) })).filter(({ count }) => count > 0);
  const entries = [
    ...bagItems.map(({ item, count }) => ({ key: `item:${item.id}`, id: item.id, name: item.name, weight: item.weight, slots: itemSlots(item), count, item, copy: false as const })),
    ...bagCopies.map((copy) => ({ key: `copy:${copy.id}`, id: copy.id, name: copy.title, weight: copy.weight, slots: copy.slots, count: 1, item: null, copy: true as const })),
  ];
  const selected = entries.find((entry) => entry.key === selectedKey) ?? entries[0];
  const gridEntries = entries.flatMap((entry) => Array.from({ length: entry.count }, (_, index) => ({ ...entry, instance: index }))).sort((a, b) => b.slots - a.slots);
  const ground = Object.entries(run.groundItems?.[run.locationId] ?? {}).filter(([, count]) => count > 0);
  const pocketItems = Object.entries(run.pocketItems ?? {}).filter(([, count]) => count > 0);
  const stowableItems = items.filter((item) => item.weight <= 1 && ((run.inventory[item.id] ?? 0) + (run.loot[item.id] ?? 0)) > ((run.pocketItems ?? {})[item.id] ?? 0) + Number(run.wornItemIds?.includes(item.id) ?? false));

  return <div className="bag-panel">
    <div className="bag-heading"><h2>行囊</h2><span>选中物品可丢下，地上物品可拾回</span></div>
    {error ? <p className="bag-feedback bag-feedback-error" role="alert">{error}</p> : feedback && <p className="bag-feedback">最新结果：{feedback.replace('\n', ' · ')}</p>}
    <p className="bag-context">气血 {run.hp} · 风声 {run.heat} · 携银 {run.coins}</p>
    <div className="bag-capacity"><div><small>背包</small><strong>{slotsUsed} / {BAG_CAPACITY} 格</strong></div><div><small>负重</small><strong>{weight} / 30</strong></div><div><small>贴身</small><strong>{pocketWeight} / 2</strong></div></div>
    <div className="bag-section-heading"><strong>背包物品</strong><small>每件显示占格和负重</small></div>
    <div className="bag-grid" role="group" aria-label={`背包格子，已用 ${slotsUsed} 格，共 ${BAG_CAPACITY} 格`}>
      {gridEntries.map((entry) => <button className={`bag-grid-item${selected?.key === entry.key ? ' selected' : ''}`} key={`${entry.key}:${entry.instance}`} type="button" style={{ gridColumn: `span ${entry.slots}` }} aria-label={`${entry.name}，占 ${entry.slots} 格，负重 ${entry.weight}`} aria-pressed={selected?.key === entry.key} onClick={() => setSelectedKey(entry.key)}><strong>{entry.name}</strong><small>{entry.slots} 格 · 负重 {entry.weight}</small></button>)}
      {Array.from({ length: Math.max(0, BAG_CAPACITY - slotsUsed) }, (_, index) => <span className="bag-empty-slot" aria-hidden="true" key={`empty:${index}`} />)}
    </div>
    {selected ? <div className="bag-selected"><div className="bag-selected-title"><h3>{selected.name}</h3><span>{selected.copy ? '独本' : selected.item?.kind === 'loot' ? '战利品' : '随身物品'}</span></div><p>{selected.item?.description ?? (selected.copy ? '独本原件；可贴身收好，也可以留在当前地点。' : '可在探索中携带或丢下。')}</p><div className="bag-selected-footer"><small>数量 {selected.count} · 占 {selected.slots} 格/件 · 负重 {selected.weight}/件{selected.item?.coinValue ? ` · 价值 ${selected.item.coinValue} 两` : ''}</small><button type="button" onClick={() => selected.copy ? onDropCopy?.(selected.id) : onDropItem?.(selected.id, 'bag')}>丢下 1 件</button></div></div> : <p className="hint">背包里还没有物品。</p>}

    {ground.length > 0 && <section className="bag-subsection" aria-label="此处地上物品"><div className="bag-section-heading"><strong>此处地上物品</strong><small>离开前可拾回</small></div>{ground.map(([id, count]) => <div className="bag-manage-row" key={id}><span>{itemName(id)} ×{count}</span><button type="button" onClick={() => onRecoverItem?.(id)}>拾回 1 件</button></div>)}</section>}
    <section className="bag-subsection" aria-label="贴身物品"><div className="bag-section-heading"><strong>贴身位置</strong><small>{pocketWeight} / 2 · 失手时可保留</small></div>{pocketItems.length === 0 && pocketCopies.length === 0 ? <p className="hint">当前为空。轻小物品可花一次行动贴身收好。</p> : <>{pocketItems.map(([id, count]) => <div className="bag-manage-row" key={id}><span>{itemName(id)} ×{count}</span><button type="button" onClick={() => onDropItem?.(id, 'pocket')}>丢下 1 件</button></div>)}{pocketCopies.map((copy) => <div className="bag-manage-row" key={copy.id}><span>{copy.title}</span><button type="button" onClick={() => onDropCopy?.(copy.id)}>丢下</button></div>)}</>}</section>
    {(run.wornItemIds?.length ?? 0) > 0 && <section className="bag-subsection" aria-label="穿戴物品"><div className="bag-section-heading"><strong>穿戴</strong><small>不占背包格，仍计入负重</small></div>{run.wornItemIds?.map((id) => <div className="bag-manage-row" key={id}><span>{itemName(id)}</span><button type="button" onClick={() => onDropItem?.(id, 'worn')}>丢下</button></div>)}</section>}
    {(bagCopies.length > 0 || stowableItems.length > 0) && <section className="bag-subsection" aria-label="贴身收纳"><div className="bag-section-heading"><strong>贴身收纳</strong><small>花一次行动，容量上限 2</small></div>{bagCopies.map((copy) => <button className="choice-button option-pack" type="button" key={copy.id} disabled={pocketWeight + copy.weight > 2} onClick={() => onStowCopy?.(copy.id)}><span className="option-icon" aria-hidden="true">物</span><span className="option-label">贴身收好{copy.title}</span></button>)}{stowableItems.map((item) => <button className="choice-button option-pack" type="button" key={item.id} disabled={pocketWeight + item.weight > 2} onClick={() => onStowItem?.(item.id)}><span className="option-icon" aria-hidden="true">物</span><span className="option-label">贴身收好{item.name}</span></button>)}</section>}
    {onAbandon && (!confirmAbandon ? <button className="abandon-button" type="button" onClick={() => setConfirmAbandon(true)}>放弃本局</button> : <div className="confirm-box"><p>神秘人会救你回镇；行囊和携银可能遗落在此。确定吗？</p><button type="button" onClick={onAbandon}>确认放弃本局</button><button type="button" onClick={() => setConfirmAbandon(false)}>取消</button></div>)}
  </div>;
}
