import type { ResultState } from '../game/model';

interface Props {
  result: ResultState;
  onReturn: () => void;
}

export function ResultScreen({ result, onReturn }: Props) {
  return (
    <main className="page result-page">
      <div className="result-mark" aria-hidden="true">{result.success ? '归' : '失'}</div>
      <div className="page-content">
        <p className="eyebrow">一局已终</p>
        <h1>{result.success ? '撤离成功' : '此行失手'}</h1>
        <p className="intro">{result.message}</p>
        <div className="status-card"><div><span>带回银两</span><strong>{result.coins}</strong></div><div><span>带回物资</span><strong>{Object.values(result.loot).reduce((sum, count) => sum + count, 0)} 件</strong></div></div>
        {!result.success && <p className="intro">失去物资：{Object.entries(result.lost).filter(([, count]) => count > 0).map(([id, count]) => `${id} ×${count}`).join('、') || '无'}</p>}
        <p className="hint">江湖路长，每一次归来都是下一次入局的本钱。</p>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" onClick={onReturn}>返回青石镇</button></div>
    </main>
  );
}
