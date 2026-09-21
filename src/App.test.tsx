import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { createGame } from './game/engine/lifecycle';
import { saveGame } from './game/save';
import App from './App';

beforeEach(() => localStorage.clear());

test('先进入标题和存档选择，再从空档进入青石镇', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '江湖撤离录' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '青石镇' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
  expect(screen.getByRole('heading', { name: '选择存档' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '第1档 新游戏' }));
  expect(screen.getByRole('heading', { name: '青石镇' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '出发整备' })).toBeInTheDocument();
  expect(localStorage.getItem('wuxia.current')).not.toBeNull();
});

test('原有存档显示在第一档，新档位独立开始', () => {
  const oldGame = createGame();
  saveGame(localStorage, { ...oldGame, permanent: { ...oldGame.permanent, coins: 777 } });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
  expect(screen.getByRole('button', { name: '第1档 继续游戏' })).toHaveTextContent('777');
  fireEvent.click(screen.getByRole('button', { name: '第2档 新游戏' }));
  expect(screen.getByText('500', { exact: true })).toBeInTheDocument();
  expect(localStorage.getItem('wuxia.slot2.current')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回标题' }));
  fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
  fireEvent.click(screen.getByRole('button', { name: '第1档 继续游戏' }));
  expect(screen.getByText('777', { exact: true })).toBeInTheDocument();
});
