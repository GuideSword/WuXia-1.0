import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CombatScreen } from './CombatScreen';

test('重击意图可读，缺药时道具不可用', () => {
  render(<CombatScreen battle={{ npcId: 'second_chief', enemyHp: 36, round: 1, intent: 'heavy', defending: false }} hp={72} items={{}} availableTechniques={[]} onAction={vi.fn()} />);
  expect(screen.getByText(/蓄势重击/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /使用道具/ })).toBeDisabled();
  expect(screen.getAllByRole('button')).toHaveLength(6);
});

test('可主动选择后学的武学招式', () => {
  const onAction = vi.fn();
  render(<CombatScreen battle={{ npcId: 'second_chief', enemyHp: 36, round: 1, intent: 'heavy', defending: false }} hp={72} items={{}} availableTechniques={[{ id: 'basic_sword', name: '基础剑法' }, { id: 'wild_blade', name: '狂风刀' }]} onAction={onAction} />);
  fireEvent.change(screen.getByRole('combobox', { name: '选择武学招式' }), { target: { value: 'wild_blade' } });
  fireEvent.click(screen.getByRole('button', { name: /施展招式/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'technique', artId: 'wild_blade' });
});
