import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ErrorScreen } from './ErrorScreen';

test('重新开始需要二次确认，故障原因可读', () => {
  const reset = vi.fn();
  render(<ErrorScreen error="存档损坏" onExport={vi.fn()} onReset={reset} />);
  expect(screen.getByRole('alert')).toHaveTextContent('存档损坏');
  fireEvent.click(screen.getByRole('button', { name: '重新开始' }));
  expect(reset).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认备份并重新开始' }));
  expect(reset).toHaveBeenCalledOnce();
});
