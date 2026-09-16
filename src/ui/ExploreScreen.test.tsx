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

test('刷新后恢复山门与已完成的结算', () => {
  const first = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '出发整备' }));
  fireEvent.click(screen.getByRole('button', { name: '前往黑风寨' }));
  fireEvent.click(screen.getByRole('button', { name: '前往山门' }));
  first.unmount();

  const second = render(<App />);
  expect(screen.getByRole('heading', { name: '黑风寨山门' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '从山门撤离' }));
  second.unmount();

  render(<App />);
  expect(screen.getByRole('heading', { name: '撤离成功' })).toBeInTheDocument();
});

test('从探索进入二当家战斗，再撤出回到探索', () => {
  render(<App />);
  for (const label of ['出发整备', '前往黑风寨', '前往山门', '前往西仓', '前往二当家偏房', '迎战二当家']) {
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
  expect(screen.getByRole('heading', { name: '刀光相向' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /撤出战斗/ }));
  expect(screen.getByRole('heading', { name: '二当家偏房' })).toBeInTheDocument();
  expect(screen.getByText('15', { selector: 'strong' })).toBeInTheDocument();
});

test('带回燕回身秘笈后可在镇上参悟并重返黑风寨', () => {
  render(<App />);
  for (const label of ['出发整备', '前往黑风寨', '前往山门', '前往西仓', '翻取燕回身秘笈', '前往山门', '从山门撤离', '返回青石镇']) {
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
  fireEvent.click(screen.getByRole('button', { name: /参悟燕回身/ }));
  expect(screen.getByText(/已掌握：基础剑法、燕回身/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '出发整备' }));
  fireEvent.click(screen.getByRole('button', { name: '前往黑风寨' }));
  expect(screen.getByRole('heading', { name: '黑风寨山脚' })).toBeInTheDocument();
});
