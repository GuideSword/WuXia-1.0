import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CombatScreen } from './CombatScreen';

test('重击意图可读，缺药时道具不可用', () => {
  render(<CombatScreen battle={{ npcId: 'second_chief', enemyHp: 36, round: 1, intent: 'heavy', defending: false }} hp={72} items={{}} availableTechniques={[]} onAction={vi.fn()} />);
  expect(screen.getByText(/蓄势重击/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /使用道具/ })).toBeDisabled();
  expect(screen.getAllByRole('button')).toHaveLength(6);
});
