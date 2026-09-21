import { useState } from 'react';

interface Props {
  error: string;
  onExport: () => void;
  onRecover?: () => void;
  onReset?: () => void;
  onBack?: () => void;
}

export function ErrorScreen({ error, onExport, onRecover, onReset, onBack }: Props) {
  const [confirming, setConfirming] = useState(false);
  return <main className="page error-page"><div className="page-content">
    <p className="eyebrow">存档与内容保护</p>
    <h1>需要你处理</h1>
    <p role="alert" className="intro">{error}</p>
    <p className="hint">现有浏览器数据不会被静默清除。请先导出诊断备份，再决定下一步。</p>
    <div className="error-actions">
      <button type="button" onClick={onExport}>导出诊断备份</button>
      {onBack && <button type="button" onClick={onBack}>返回存档选择</button>}
      {onRecover && <button type="button" onClick={onRecover}>恢复上一存档</button>}
      {onReset && !confirming && <button type="button" onClick={() => setConfirming(true)}>重新开始</button>}
      {onReset && confirming && <div className="confirm-box"><p>重新开始会覆盖当前本地存档；系统会先下载原始备份。确认继续？</p><button type="button" onClick={onReset}>确认备份并重新开始</button><button type="button" onClick={() => setConfirming(false)}>取消</button></div>}
    </div>
  </div></main>;
}
