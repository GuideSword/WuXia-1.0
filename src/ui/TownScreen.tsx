import type { ArtDefinition, CopyDefinition, ItemDefinition, Location, NpcDefinition, PermanentState } from '../game/model';
import type { TutorialStep } from '../game/onboarding';
import { TutorialCard } from './TutorialCard';

interface Props {
  permanent: PermanentState;
  arts: ArtDefinition[];
  copies?: CopyDefinition[];
  location: Location;
  nextLocations: Location[];
  npcs: NpcDefinition[];
  items: ItemDefinition[];
  onPrep: () => void;
  onRumors: () => void;
  onLearn: (artId: string) => void;
  onStudy?: (copyId: string) => void;
  onVisit: (locationId: string) => void;
  onBuy: (npcId: string, itemId: string) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  importPending: boolean;
  importError: string | null;
  onConfirmImport: () => void;
  onCancelImport: () => void;
  onMenu?: () => void;
  tutorial?: TutorialStep | null;
  onSkipTutorial?: () => void;
}

export function TownScreen({ permanent, arts, copies = [], location, nextLocations, npcs, items, onPrep, onRumors, onLearn, onStudy, onVisit, onBuy, onExport, onImportFile, importPending, importError, onConfirmImport, onCancelImport, onMenu, tutorial, onSkipTutorial }: Props) {
  const learnable = arts.filter((art) => art.manualItemId && !permanent.learnedArts.includes(art.id));
  const here = npcs.filter((npc) => npc.locationId === location.id && (npc.id !== 'rescued_prisoner' || (permanent.relations.prisoner ?? 0) >= 1) && (npc.id !== 'tea_visitor' || permanent.heardRumors.includes('taiji_visitor')));
  return (
    <main className="page town-page">
      <div className="town-illustration">
        <div className="town-scene-status" aria-label="侠客状态"><span>银两 <strong>{permanent.coins.toLocaleString('zh-CN')}</strong></span><span>入局 <strong>{permanent.raids} 次</strong></span></div>
        <span className="town-scene-title">青石镇</span>
      </div>
      <div className="page-content">
        <p className="eyebrow">江湖始于此处</p>
        <h1>青石镇</h1>
        <p className="intro">{location.name} · {location.description}</p>
        <TutorialCard step={tutorial ?? null} onSkip={onSkipTutorial ?? (() => {})} onAction={tutorial?.actionId === 'rumors' ? onRumors : tutorial?.actionId === 'prep' ? onPrep : undefined} />
        {(location.id === 'town_square' || location.id === 'teahouse') && <button className="town-art town-featured-action town-option town-option--rumor" type="button" aria-label="查看可用情报" aria-describedby="town-rumor-detail" onClick={onRumors}><span className="option-icon" aria-hidden="true">闻</span><span className="option-label">查看可用情报</span><small className="option-detail" id="town-rumor-detail">茶馆说书人</small></button>}
        <section className="town-list" aria-label="镇内去处">
          <h2>镇中去处</h2>
          {nextLocations.map((place) => <button className="town-art town-option town-option--travel" key={place.id} type="button" aria-label={`前往${place.name}`} aria-describedby={`town-travel-${place.id}`} onClick={() => onVisit(place.id)}><span className="option-icon" aria-hidden="true">行</span><span className="option-label">前往{place.name}</span><small className="option-detail" id={`town-travel-${place.id}`}>{place.description}</small></button>)}
        </section>
        {here.map((npc) => <section className="town-list" key={npc.id} aria-label={npc.name}>
          <h2>{npc.name}</h2>
          {npc.description && <p className="hint">{npc.description}</p>}
          {npc.itemsSold?.map((id) => {
            const item = items.find((entry) => entry.id === id);
            const copy = copies.find((entry) => entry.itemId === id);
            const unavailable = permanent.coins < (item?.buyPrice ?? Infinity) || (!!copy && permanent.copyPositions[copy.id]?.kind !== 'source');
            return item && <button className="town-art town-option town-option--trade" key={id} type="button" disabled={unavailable} onClick={() => onBuy(npc.id, id)}><span className="option-icon" aria-hidden="true">{unavailable ? '锁' : '物'}</span><span className="option-label">{copy && permanent.copyPositions[copy.id]?.kind !== 'source' ? '已易主：' : item.buyPrice === 0 ? '领受' : '购买'}{item.name}</span><small className="option-detail">{item.buyPrice === 0 ? '赠予' : `${item.buyPrice} 两`} · 负重 {item.weight}</small></button>;
          })}
        </section>)}
        {location.id === 'training_yard' && <section className="town-list" aria-label="参悟武学">
          <h2>参悟武学</h2>
          <p className="hint">已掌握：{arts.filter((art) => permanent.learnedArts.includes(art.id)).map((art) => art.name).join('、')}</p>
          {copies.filter((copy) => permanent.copyPositions[copy.id]?.kind === 'home').map((copy) => {
            const read = !copy.insightId || permanent.learnedInsights.includes(copy.insightId);
            return <button className="town-art town-option town-option--study" key={copy.id} type="button" disabled={read || !onStudy} onClick={() => onStudy?.(copy.id)}><span className="option-icon" aria-hidden="true">{read || !onStudy ? '锁' : '悟'}</span><span className="option-label">研读{copy.title}</span><small className="option-detail">{copy.author} · {read ? '已读，原本收藏在家' : '可获得一份见解，书不会消失'}</small></button>;
          })}
          {learnable.map((art) => <button className="town-art town-option town-option--study" key={art.id} type="button" disabled={!permanent.stash[art.manualItemId!]} onClick={() => onLearn(art.id)}><span className="option-icon" aria-hidden="true">{permanent.stash[art.manualItemId!] ? '悟' : '锁'}</span><span className="option-label">参悟{art.name}</span><small className="option-detail">{permanent.stash[art.manualItemId!] ? '研读旧版秘笈，书仍留在家中' : '尚未带回秘籍'}</small></button>)}
        </section>}
        <details className="save-drawer"><summary>存档 · 导入与导出</summary>
          <p className="hint">无需账号，进度自动保存在此浏览器。清除网站数据会丢失进度，请定期导出备份。</p>
          <button type="button" onClick={onExport}>导出存档</button>
          <label htmlFor="save-import">选择 JSON 存档文件</label>
          <input id="save-import" type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportFile(file); event.target.value = ''; }} />
          {importError && <p role="alert" className="field-error">{importError}</p>}
          {importPending && <div className="confirm-box"><p>存档校验通过。确认替换当前进度？当前存档仍可从“上一稳定档”恢复。</p><button type="button" onClick={onConfirmImport}>确认导入并替换</button><button type="button" onClick={onCancelImport}>取消导入</button></div>}
        </details>
        {onMenu && <button className="text-button town-menu-link" type="button" onClick={onMenu}>返回标题</button>}
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" onClick={onPrep}>出发整备</button></div>
    </main>
  );
}
