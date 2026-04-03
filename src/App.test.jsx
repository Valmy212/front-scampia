import { beforeEach, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

test('renders landing route and main navigation links', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /scampi/i })).toBeDefined();
  expect(screen.getByText(/onchain ai trading league/i)).toBeDefined();

  expect(
    screen
      .getByRole('link', { name: /view leaderboard/i })
      .getAttribute('href')
  ).toBe('/leaderboard');
  expect(
    screen
      .getByRole('link', { name: /open claw integration guide/i })
      .getAttribute('href')
  ).toBe('/open-claw-guide');

  expect(screen.getByRole('link', { name: /^home$/i }).getAttribute('href')).toBe(
    '/'
  );
});

test('renders leaderboard bot detail route', () => {
  window.history.pushState({}, '', '/leaderboard/bot-42');
  render(<App />);

  expect(screen.getByRole('heading', { name: /bot bot-42/i })).toBeDefined();
});
