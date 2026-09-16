import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { RumorScreen } from './RumorScreen';

test('低可信度传闻不会被说成已证实', () => {
  const onHear = vi.fn();
  render(<RumorScreen rumors={[{ id: 'false_scroll', title: '伪卷之谜', source: '游商', credibility: .2, targetLocation: 'warehouse', valueHint: '卷轴', dangerHint: '可能误导', cost: 10 }]} heard={[]} confirmed={[]} selected={null} coins={100} onHear={onHear} onTrack={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByText(/可信度 20%/)).toBeInTheDocument();
  expect(screen.queryByText('已证实')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '探听伪卷之谜' }));
  expect(onHear).toHaveBeenCalledWith('false_scroll');
});
