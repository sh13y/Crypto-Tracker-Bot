require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(botToken, { polling: true });

// Axios instance with timeout
const apiClient = axios.create({ timeout: 10000 });

// ==================== PRICE FETCHERS ====================

// Fetch single coin price from Coinbase
async function getPrice(symbol = 'BTC-USD') {
  try {
    const { data } = await apiClient.get(
      `https://api.coinbase.com/v2/prices/${symbol}/spot`
    );
    return {
      symbol: symbol,
      price: parseFloat(data.data.amount),
    };
  } catch (err) {
    console.error(`Error fetching ${symbol}:`, err.message);
    throw new Error(`Failed to fetch ${symbol} price`);
  }
}

// Fetch top coins by market cap (CoinGecko)
async function getTopCoins(limit = 5) {
  try {
    const { data } = await apiClient.get(
      'https://api.coingecko.com/api/v3/markets',
      {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          sparkline: false,
        },
      }
    );
    return data.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: parseFloat(coin.current_price),
      change24h: coin.price_change_percentage_24h || 0,
      marketCap: coin.market_cap,
    }));
  } catch (err) {
    console.error('Error fetching top coins:', err.message);
    throw new Error('Failed to fetch market data');
  }
}

// ==================== TELEGRAM HANDLERS ====================

// Start command - shows main menu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = [
    ['📊 Live Prices', '🔥 Top 10 Coins'],
    ['💰 BTC Analysis', '💎 ETH Analysis'],
    ['📰 Market Overview', '❓ Help'],
    ['🚀 More Features (Coming)'],
  ];

  bot.sendMessage(
    chatId,
    '🤖 *Crypto Tracker Bot*\n\nChoose an option:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }
  );
});

// Handle all messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // Skip commands (handled by onText)
  if (!text || text.startsWith('/')) {
    return;
  }

  try {
    if (text === '📊 Live Prices') {
      await handleLivePrices(chatId);
    } else if (text === '🔥 Top 10 Coins') {
      await handleTopCoins(chatId);
    } else if (text === '💰 BTC Analysis') {
      await handleBTCAnalysis(chatId);
    } else if (text === '💎 ETH Analysis') {
      await handleETHAnalysis(chatId);
    } else if (text === '📰 Market Overview') {
      await handleMarketOverview(chatId);
    } else if (text === '❓ Help') {
      await handleHelp(chatId);
    } else if (text === '🚀 More Features (Coming)') {
      await bot.sendMessage(chatId, '🚀 Features coming soon:\n• Price Alerts\n• Portfolio Tracking\n• Market News');
    }
  } catch (err) {
    console.error('Handler error:', err);
    await bot.sendMessage(
      chatId,
      '❌ Error fetching data. Please try again.'
    );
  }
});

// ==================== HANDLER FUNCTIONS ====================

async function handleLivePrices(chatId) {
  const [btc, eth] = await Promise.all([
    getPrice('BTC-USD'),
    getPrice('ETH-USD'),
  ]);

  const message = [
    '📊 *Live Prices*',
    '',
    `🪙 *Bitcoin (BTC)*\n💵 $${btc.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    '',
    `🪙 *Ethereum (ETH)*\n💵 $${eth.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
  ].join('\n');

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleTopCoins(chatId) {
  const topCoins = await getTopCoins(10);

  const reply = topCoins
    .map(
      (c, i) =>
        `${i + 1}. *${c.name}* (${c.symbol})\n` +
        `💵 $${c.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} | ` +
        `24h: ${c.change24h > 0 ? '📈' : '📉'} ${Math.abs(c.change24h).toFixed(2)}%`
    )
    .join('\n\n');

  await bot.sendMessage(chatId, `🔥 *Top 10 by Market Cap*\n\n${reply}`, {
    parse_mode: 'Markdown',
  });
}

async function handleBTCAnalysis(chatId) {
  const btc = await getPrice('BTC-USD');

  await bot.sendMessage(
    chatId,
    `💰 *Bitcoin Analysis*\n\n` +
    `Current Price: *$${btc.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}*\n\n` +
    `_Real-time data from Coinbase_`,
    { parse_mode: 'Markdown' }
  );

  await bot.sendPhoto(
    chatId,
    'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    { caption: '🪙 Bitcoin Logo' }
  );
}

async function handleETHAnalysis(chatId) {
  const eth = await getPrice('ETH-USD');

  await bot.sendMessage(
    chatId,
    `💎 *Ethereum Analysis*\n\n` +
    `Current Price: *$${eth.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}*\n\n` +
    `_Real-time data from Coinbase_`,
    { parse_mode: 'Markdown' }
  );

  await bot.sendPhoto(
    chatId,
    'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    { caption: '💎 Ethereum Logo' }
  );
}

async function handleMarketOverview(chatId) {
  const topCoins = await getTopCoins(5);

  const reply = topCoins
    .map(
      (c) =>
        `*${c.symbol}* - ${c.name}\n` +
        `💵 $${c.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} | ` +
        `${c.change24h > 0 ? '📈' : '📉'} ${c.change24h.toFixed(2)}%`
    )
    .join('\n\n');

  await bot.sendMessage(
    chatId,
    `📰 *Market Overview (Top 5)*\n\n${reply}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleHelp(chatId) {
  const helpText = `
❓ *Help & Features*

📊 *Live Prices* - BTC & ETH current prices (Coinbase)
🔥 *Top 10 Coins* - Top 10 cryptocurrencies by market cap
💰 *BTC Analysis* - Detailed Bitcoin price data
💎 *ETH Analysis* - Detailed Ethereum price data
📰 *Market Overview* - Quick look at top 5 coins

*Data Sources:*
• Coinbase API (Real-time prices)
• CoinGecko API (Market data)

_No API keys needed - completely free!_
  `;

  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ==================== ERROR HANDLERS ====================

bot.on('polling_error', (err) => {
  console.error('Polling error:', err);
});

bot.on('error', (err) => {
  console.error('Bot error:', err);
});

// ==================== STARTUP ====================

console.log('🤖 Crypto Tracker Bot started!');
console.log('✅ Using Coinbase API (no geographic restrictions)');
console.log('✅ Using CoinGecko API for market data');
console.log('🚀 Ready to receive messages...\n');
