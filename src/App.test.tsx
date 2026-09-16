import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App from './App';

test('起始页能看见青石镇和出发入口', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '青石镇' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '出发整备' })).toBeInTheDocument();
});
