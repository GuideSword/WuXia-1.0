import type { ItemDefinition, ResultState } from '../game/model';

interface Props {
  result: ResultState;
  items?: ItemDefinition[];
  onReturn: () => void;
}

export function ResultScreen({ result, items = [], onReturn }: Props) {
  const itemName = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  const retainedCount = Object.entries(result.loot).reduce((sum, [id, count]) => sum + (items.find((item) => item.id === id)?.coinValue ? 0 : count), 0);
  return (
    <main className="page result-page">
      <div className="result-mark" aria-hidden="true">{result.success ? '归' : '失'}</div>
      <div className="page-content">
        <p className="eyebrow">一局已终</p>
        <h1>{result.success ? '撤离成功' : '此行失手'}</h1>
        <p className="intro">{result.message}</p>
        <div className="status-card"><div><span>带回银两</span><strong>{result.coins}</strong></div><div><span>带回物资</span><strong>{result.success ? retainedCount : 0} 件</strong></div></div>
        {result.success && Object.keys(result.loot).length > 0 && <p className="intro">此行所得：{Object.entries(result.loot).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}${items.find((item) => item.id === id)?.coinValue ? '（已折银）' : ''}`).join('、')}</p>}
        {Object.keys(result.lost).length > 0 && <p className="intro">{result.success ? '撤离代价' : '失去物资'}：{Object.entries(result.lost).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}`).join('、')}</p>}
        <p className="hint">江湖路长，每一次归来都是下一次入局的本钱。</p>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" onClick={onReturn}>返回青石镇</button></div>
    </main>
  );
}
