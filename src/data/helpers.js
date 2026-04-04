import { BOTS } from './bots';

function getTimeframeFactor(timeframe) {
  if (timeframe === '24h') return 0.12;
  if (timeframe === '7d') return 0.4;
  if (timeframe === 'all') return 1.9;
  return 1;
}

function getTradeFactor(timeframe) {
  if (timeframe === '24h') return 0.09;
  if (timeframe === '7d') return 0.33;
  if (timeframe === 'all') return 2.6;
  return 1;
}

export function getBotSnapshot(bot, timeframe) {
  const factor = getTimeframeFactor(timeframe);
  const tradeFactor = getTradeFactor(timeframe);
  const winRateDrift = timeframe === '24h' ? -1.1 : timeframe === 'all' ? 1 : 0;

  return {
    ...bot,
    pnl: bot.basePnl * factor,
    roi: bot.baseRoi * factor,
    winRate: Math.max(35, Math.min(99, bot.baseWinRate + winRateDrift)),
    trades: Math.max(6, Math.round(bot.trades30d * tradeFactor)),
  };
}

export function sortBots(bots, sortKey) {
  return [...bots].sort((a, b) => b[sortKey] - a[sortKey]);
}

export function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSignedUsd(value) {
  return `${value >= 0 ? '+' : '-'}${formatUsd(Math.abs(value))}`;
}

export function formatSignedPct(value) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(1)}%`;
}

export function formatPct(value) {
  return `${value.toFixed(1)}%`;
}

export function shortHash(hash) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function toHexSeed(text) {
  const hex = Array.from(text)
    .map((char) => char.charCodeAt(0).toString(16))
    .join('');
  return hex.slice(0, 64).padEnd(64, 'a');
}

function makeFakeTxHash(botId, index) {
  return `0x${toHexSeed(`${botId}-${index}`)}`;
}

function formatDateTime(date) {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export function buildTransactions(bot) {
  const pairs = ['ETH/USDC', 'BTC/USDC', 'SOL/USDC', 'ARB/USDC'];
  const entries = [];

  for (let index = 0; index < 8; index += 1) {
    const side = index % 2 === 0 ? 'Buy' : 'Sell';
    const pair = pairs[index % pairs.length];
    const date = new Date(Date.UTC(2026, 3, 3, 9, 45 - index * 3));
    const size = 12000 + index * 1700;
    const entry = 1200 + index * 43;
    const direction = index % 3 === 0 ? -1 : 1;
    const movePct = (0.35 + index * 0.14) / 100;
    const exit = entry * (1 + movePct * direction);
    const pnl = (bot.basePnl / 52) * direction * (1 + index * 0.1);
    const hash = makeFakeTxHash(bot.id, index);

    entries.push({
      id: `${bot.id}-tx-${index}`,
      dateTime: formatDateTime(date),
      pair,
      side,
      size,
      entry,
      exit,
      pnl,
      txHash: hash,
      etherscanUrl: `https://etherscan.io/tx/${hash}`,
    });
  }

  return entries;
}

export function buildVaultActivity(bot) {
  return {
    deposits: [
      { id: `${bot.id}-dep-1`, date: '2026-04-02', from: '0x44Ae...112f', amount: bot.vaultValue * 0.06 },
      { id: `${bot.id}-dep-2`, date: '2026-03-30', from: '0x8A20...09bc', amount: bot.vaultValue * 0.035 },
      { id: `${bot.id}-dep-3`, date: '2026-03-25', from: '0xD1f7...32Ab', amount: bot.vaultValue * 0.022 },
    ],
    withdrawals: [
      { id: `${bot.id}-wd-1`, date: '2026-03-29', to: '0x2F90...22dd', amount: bot.vaultValue * 0.018 },
      { id: `${bot.id}-wd-2`, date: '2026-03-20', to: '0x5ab1...71f0', amount: bot.vaultValue * 0.014 },
    ],
    backers: ['0xA091...bA10', '0x7F00...19fE', '0x31c2...43A8', '0xE010...00Dd'],
  };
}

export function getCurrentRank(botId) {
  const ranked = sortBots(BOTS.map((bot) => getBotSnapshot(bot, 'all')), 'roi');
  return ranked.findIndex((bot) => bot.id === botId) + 1;
}