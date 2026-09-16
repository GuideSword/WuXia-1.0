import type { ArtDefinition, ItemDefinition, Location, NpcDefinition, PermanentState } from '../game/model';

interface Props {
  permanent: PermanentState;
  arts: ArtDefinition[];
  location: Location;
  nextLocations: Location[];
  npcs: NpcDefinition[];
  items: ItemDefinition[];
  onPrep: () => void;
  onRumors: () => void;
  onLearn: (artId: string) => void;
  onVisit: (locationId: string) => void;
  onBuy: (npcId: string, itemId: string) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  importPending: boolean;
  importError: string | null;
  onConfirmImport: () => void;
  onCancelImport: () => void;
}

export function TownScreen({ permanent, arts, location, nextLocations, npcs, items, onPrep, onRumors, onLearn, onVisit, onBuy, onExport, onImportFile, importPending, importError, onConfirmImport, onCancelImport }: Props) {
  const learnable = arts.filter((art) => art.manualItemId && !permanent.learnedArts.includes(art.id));
  const here = npcs.filter((npc) => npc.locationId === location.id);
  return (
    <main className="page town-page">
      <div className="town-illustration" aria-hidden="true"><span>青石镇</span></div>
      <div className="page-content">
        <p className="eyebrow">江湖始于此处</p>
        <h1>青石镇</h1>
        <p className="intro">{location.name} · {location.description}</p>
        <div className="status-card">
          <div><span>身份</span><strong>无名侠客</strong></div>
          <div><span>银两</span><strong>{permanent.coins.toLocaleString('zh-CN')}</strong></div>
          <div><span>入局</span><strong>{permanent.raids} 次</strong></div>
        </div>
        <section className="town-list" aria-label="镇内去处">
          <h2>镇中去处</h2>
          {nextLocations.map((place) => <button className="town-art" key={place.id} type="button" aria-label={`前往${place.name}`} onClick={() => onVisit(place.id)}>前往{place.name}<small>{place.description}</small></button>)}
        </section>
        {(location.id === 'town_square' || location.id === 'teahouse') && <button className="town-art" type="button" aria-label="查看可用情报" onClick={onRumors}>查看可用情报<small>茶馆说书人</small></button>}
        {here.map((npc) => <section className="town-list" key={npc.id} aria-label={npc.name}>
          <h2>{npc.name}</h2>
          {npc.description && <p className="hint">{npc.description}</p>}
          {npc.itemsSold?.map((id) => {
            const item = items.find((entry) => entry.id === id);
            return item && <button className="town-art" key={id} type="button" disabled={permanent.coins < (item.buyPrice ?? Infinity)} onClick={() => onBuy(npc.id, id)}>购买{item.name}<small>{item.buyPrice} 两 · 负重 {item.weight}</small></button>;
          })}
        </section>)}
        {location.id === 'training_yard' && <section className="town-list" aria-label="参悟武学">
          <h2>参悟武学</h2>
          <p className="hint">已掌握：{arts.filter((art) => permanent.learnedArts.includes(art.id)).map((art) => art.name).join('、')}</p>
          {learnable.map((art) => <button className="town-art" key={art.id} type="button" disabled={!permanent.stash[art.manualItemId!]} onClick={() => onLearn(art.id)}>参悟{art.name}<small>{permanent.stash[art.manualItemId!] ? '消耗秘笈 ×1' : '尚未带回秘籍'}</small></button>)}
        </section>}
        <details className="save-drawer"><summary>存档 · 导入与导出</summary>
          <p className="hint">无需账号，进度自动保存在此浏览器。清除网站数据会丢失进度，请定期导出备份。</p>
          <button type="button" onClick={onExport}>导出存档</button>
          <label htmlFor="save-import">选择 JSON 存档文件</label>
          <input id="save-import" type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.target.value = ''; }} />
          {importError && <p role="alert" className="field-error">{importError}</p>}
          {importPending && <div className="confirm-box"><p>存档校验通过。确认替换当前进度？当前存档仍可从“上一稳定档”恢复。</p><button type="button" onClick={onConfirmImport}>确认导入并替换</button><button type="button" onClick={onCancelImport}>取消导入</button></div>}
        </details>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" onClick={onPrep}>出发整备</button></div>
    </main>
  );
}
