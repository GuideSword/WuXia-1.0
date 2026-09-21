import { useState } from 'react';
import type { SlotSummary } from '../game/save';
import type { SaveSlot } from '../game/save';
import type { GameState } from '../game/model';

const phaseNames: Record<GameState['phase'], string> = {
  town: '青石镇', rumors: '茶馆探听', prep: '出发整备', explore: '黑风寨探索',
  combat: '交战中', result: '本局结算', error: '待处理',
};

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return <main className="page menu-page">
    <div className="menu-art" aria-hidden="true" />
    <div className="menu-content">
      <p className="eyebrow">一入江湖 · 生死由己</p>
      <h1>江湖撤离录</h1>
      <p className="menu-tagline">探风声，取秘笈。<br />活着走出黑风寨。</p>
      <button className="primary-button" type="button" onClick={onStart}>开始游戏</button>
    </div>
  </main>;
}

export function SaveSelectScreen({ slots, onSelect, onRestart, onBack }: { slots: SlotSummary[]; onSelect: (slot: SlotSummary) => void; onRestart: (slot: SaveSlot) => void; onBack: () => void }) {
  const [restartSlot, setRestartSlot] = useState<SaveSlot | null>(null);
  return <main className="page menu-page slot-page">
    <div className="menu-art" aria-hidden="true" />
    <div className="page-content slot-content">
      <button className="text-button" type="button" onClick={onBack}>← 返回标题</button>
      <p className="eyebrow">择一卷江湖旧事</p>
      <h1>选择存档</h1>
      <p className="intro">选择已有进度继续，或从空档开启新的旅程。每个存档独立自动保存。</p>
      <div className="slot-list">
        {slots.map((entry) => <div className="slot-card" key={entry.slot}>
          <button className="slot-select" type="button" onClick={() => onSelect(entry)} aria-label={`第${entry.slot}档 ${entry.status === 'ready' ? '继续游戏' : entry.status === 'empty' ? '新游戏' : '处理存档'}`}>
          <span className="slot-number">第 {entry.slot} 档</span>
          {entry.status === 'ready' ? <>
            <strong>{phaseNames[entry.game.phase]}</strong>
            <small>入局 {entry.game.permanent.raids} 次 · 银两 {entry.game.permanent.coins}</small>
            <span className="slot-action">继续游戏 →</span>
          </> : entry.status === 'empty' ? <>
            <strong>空白存档</strong>
            <small>从青石镇开启新的旅程</small>
            <span className="slot-action">新游戏 →</span>
          </> : <>
            <strong>存档需要处理</strong>
            <small>可导出原始备份，再决定是否重新开始</small>
            <span className="slot-action">处理存档 →</span>
          </>}
          </button>
          {entry.status === 'ready' && <button className="slot-restart" type="button" onClick={() => setRestartSlot(entry.slot)}>第{entry.slot}档重新开局</button>}
        </div>)}
      </div>
      {restartSlot && <div className="confirm-box slot-confirm" role="dialog" aria-label="确认重新开局">
        <p>第 {restartSlot} 档将从头开始。确认后会先下载该档备份，再覆盖进度。</p>
        <button type="button" onClick={() => onRestart(restartSlot)}>备份并重新开局</button>
        <button type="button" onClick={() => setRestartSlot(null)}>取消</button>
      </div>}
    </div>
  </main>;
}
