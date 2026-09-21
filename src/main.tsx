import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadBundledContent } from './game/content/load';
import { ErrorScreen } from './ui/ErrorScreen';
import { downloadText } from './ui/download';
import './styles.css';
import './theme.css';

let initialError: string | null = null;
try { loadBundledContent(); } catch (error) { initialError = error instanceof Error ? error.message : '游戏内容无法载入'; }
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{initialError ? <ErrorScreen error={`内容校验失败：${initialError}`} onExport={() => downloadText('wuxia-content-diagnostic.json', JSON.stringify({ error: initialError, save: localStorage.getItem('wuxia.current') }, null, 2))} /> : <App />}</React.StrictMode>);
