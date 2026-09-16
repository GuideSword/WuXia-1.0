import type { ArtDefinition, PermanentState } from '../game/model';

interface Props {
  permanent: PermanentState;
  arts: ArtDefinition[];
  onPrep: () => void;
  onRumors: () => void;
  onLearn: (artId: string) => void;
}

export function TownScreen({ permanent, arts, onPrep, onRumors, onLearn }: Props) {
  const learnable = arts.filter((art) => art.manualItemId && !permanent.learnedArts.includes(art.id));
  return (
    <main className="page town-page">
      <div className="town-illustration" aria-hidden="true"><span>青石镇</span></div>
      <div className="page-content">
        <p className="eyebrow">江湖始于此处</p>
        <h1>青石镇</h1>
        <p className="intro">山雨欲来，客栈里仍有人低声谈论黑风寨。你的行囊还轻，前路却未必。</p>
        <div className="status-card">
          <div><span>身份</span><strong>无名侠客</strong></div>
          <div><span>银两</span><strong>{permanent.coins.toLocaleString('zh-CN')}</strong></div>
          <div><span>入局</span><strong>{permanent.raids} 次</strong></div>
        </div>
        <section className="town-list" aria-label="镇内去处">
          <h2>镇中去处</h2>
          <div className="town-row"><span>茶馆</span><small>江湖传闻在杯盏间流转</small></div>
          <div className="town-row"><span>药铺</span><small>备药，疗伤，为下一程留余地</small></div>
          <div className="town-row"><span>练功处</span><small>带回秘籍后，方可参悟</small></div>
        </section>
        <button className="town-art" type="button" aria-label="查看可用情报" onClick={onRumors}>查看可用情报<small>茶馆探听传闻</small></button>
        <section className="town-list" aria-label="参悟武学">
          <h2>参悟武学</h2>
          <p className="hint">已掌握：{arts.filter((art) => permanent.learnedArts.includes(art.id)).map((art) => art.name).join('、')}</p>
          {learnable.map((art) => <button className="town-art" key={art.id} type="button" disabled={!permanent.stash[art.manualItemId!]} onClick={() => onLearn(art.id)}>参悟{art.name}<small>{permanent.stash[art.manualItemId!] ? '消耗秘笈 ×1' : '尚未带回秘籍'}</small></button>)}
        </section>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" onClick={onPrep}>出发整备</button></div>
    </main>
  );
}
