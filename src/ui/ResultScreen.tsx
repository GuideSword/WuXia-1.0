import type { CopyDefinition, ItemDefinition, Location, ResultState } from '../game/model';
import type { TutorialStep } from '../game/onboarding';
import { TutorialCard } from './TutorialCard';

interface Props {
  result: ResultState;
  items?: ItemDefinition[];
  locations?: Location[];
  copies?: CopyDefinition[];
  onReturn: () => void;
  tutorial?: TutorialStep | null;
  onSkipTutorial?: () => void;
}

export function ResultScreen({ result, items = [], locations = [], copies = [], onReturn, tutorial, onSkipTutorial }: Props) {
  const itemName = (id: string) => items.find((item) => item.id === id)?.name ?? id;
  const retainedCount = Object.entries(result.loot).reduce((sum, [id, count]) => sum + (items.find((item) => item.id === id)?.coinValue ? 0 : count), 0);
  return (
    <main className="page result-page">
      <div className="result-mark" aria-hidden="true">{result.success ? '归' : '失'}</div>
      <div className="page-content">
        <p className="eyebrow">一局已终</p>
        <h1>{result.success ? '撤离成功' : '此行失手'}</h1>
        <p className="intro">{result.message}</p>
        <TutorialCard step={tutorial ?? null} onSkip={onSkipTutorial ?? (() => {})} />
        <div className="status-card"><div><span>带回银两</span><strong>{result.coins}</strong></div><div><span>带回物资</span><strong>{result.success ? retainedCount : Object.values(result.kept ?? {}).reduce((sum, count) => sum + count, 0)} 件</strong></div></div>
        {result.success && Object.keys(result.loot).length > 0 && <p className="intro">此行所得：{Object.entries(result.loot).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}${items.find((item) => item.id === id)?.coinValue ? '（已折银）' : ''}`).join('、')}</p>}
        {Object.keys(result.lost).length > 0 && <p className="intro">{result.success ? '撤离代价' : '失去物资'}：{Object.entries(result.lost).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}`).join('、')}</p>}
        {!result.success && Object.keys(result.kept ?? {}).length > 0 && <p className="intro">贴身带回：{Object.entries(result.kept ?? {}).filter(([, count]) => count > 0).map(([id, count]) => `${itemName(id)} ×${count}`).join('、')}</p>}
        {!result.success && result.lostAt && <p className="hint">遗落地点：{locations.find((location) => location.id === result.lostAt)?.name ?? result.lostAt}。{copies.some((copy) => (result.lost[copy.itemId] ?? 0) > 0) ? '遗落的独本可在此找回。' : Object.keys(result.lost).length > 0 ? '普通行囊未能带回。' : '携银未能带回。'}</p>}
        <p className="hint">江湖路长，每一次归来都是下一次入局的本钱。</p>
      </div>
      <div className="bottom-action"><button className="primary-button" type="button" onClick={onReturn}>返回青石镇</button></div>
    </main>
  );
}
