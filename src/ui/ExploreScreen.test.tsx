import { beforeEach, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

beforeEach(() => localStorage.clear());

test('安全区到山门撤离形成第一条完整路径', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '出发整备' }));
  fireEvent.click(screen.getByRole('button', { name: '前往黑风寨' }));
  fireEvent.click(screen.getByRole('button', { name: '前往山门' }));
  fireEvent.click(screen.getByRole('button', { name: '从山门撤离' }));
  expect(screen.getByRole('heading', { name: '撤离成功' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回青石镇' }));
  expect(screen.getByRole('heading', { name: '青石镇' })).toBeInTheDocument();
});
