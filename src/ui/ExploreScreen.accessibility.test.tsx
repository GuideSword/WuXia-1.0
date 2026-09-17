import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ExploreScreen } from './ExploreScreen';
import { createGame, startRun } from '../game/engine/lifecycle';

test('场景正文、风险和行动是可读取的 DOM 内容', () => {
  const run = startRun(createGame(), {}, 0, 7).run!;
  const { container } = render(<ExploreScreen title="黑风寨西仓" description="寨主已经回山。" run={run} weight={0} choices={[{ id: 'leave', label: '携残页撤离', riskHint: '风声 +10', conditions: [], effects: [] }]} exits={[]} onChoose={vi.fn()} />);
  expect(screen.getByText('寨主已经回山。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '携残页撤离' })).toBeInTheDocument();
  expect(screen.getByText('风声 +10')).toBeInTheDocument();
  expect(container.querySelector('.explore-illustration')).toHaveAttribute('aria-hidden', 'true');
});

test('地图与行动日志可在探索页展开', () => {
  const run = { ...startRun(createGame(), {}, 0, 7).run!, log: ['静默通过巡逻'] };
  render(<ExploreScreen title="山脚" description="松林深处" run={run} weight={0} choices={[]} exits={[]} mapNext={['山门']} onChoose={vi.fn()} />);
  fireEvent.click(screen.getByText('地图'));
  expect(screen.getByText(/下一步可到：山门/)).toBeVisible();
  fireEvent.click(screen.getByText('行动日志'));
  expect(screen.getByText('静默通过巡逻')).toBeVisible();
});
