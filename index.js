require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(botToken, { polling: true });
const BINANCE_BASE_URL = process.env.BINANCE_BASE_URL || 'https://api.binance.com';

// Helper: fetch price from Binance
async function getPrice(symbol = 'BTCUSDT') {
  const { data } = await axios.get(`${BINANCE_BASE_URL}/api/v3/ticker/price`, {
    params: { symbol },
  });
  return data;
}

// Helper: fetch top coins by 24h volume (simple example)
async function getTopCoins(limit = 5) {
  const { data } = await axios.get(`${BINANCE_BASE_URL}/api/v3/ticker/24hr`);
  const usdtMarkets = data.filter((t) => t.symbol.endsWith('USDT'));
  usdtMarkets.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
  return usdtMarkets.slice(0, limit);
}

// (Optional) simple crypto news using CryptoCompare News API as an example
async function getCryptoNews(limit = 5) {
  const apiKey = process.env.CRYPTO_NEWS_API_KEY;
  if (!apiKey) return null;

  const { data } = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
    params: { lang: 'EN' },
    headers: { authorization: `Apikey ${apiKey}` },
  });

  return data.Data.slice(0, limit).map((n) => ({
    title: n.title,
    url: n.url,
    source: n.source_info?.name,
  }));
}

// Start command with main menu using reply keyboard
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      keyboard: [
        ['📊 Live Prices', '🔥 Top 10 Coins'],
        ['📈 BTC Analysis', '📄 ETH Analysis'],
        ['🔔 Set Alert', '⚠️ My Alerts'],
        ['📰 Market Overview', '❓ Help'],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };

  bot.sendMessage(
    chatId,
    'Welcome to Crypto Tracker Bot!\nChoose an option below:',
    options
  );
});

// Handle reply keyboard button presses by message text
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore pure commands here; /start is handled above
  if (!text || text.startsWith('/')) {
    return;
  }

  try {
    if (text === '📊 Live Prices') {
      const [btc, eth] = await Promise.all([getPrice('BTCUSDT'), getPrice('ETHUSDT')]);
      await bot.sendMessage(
        chatId,
        [
          '📊 *Live Prices*',
          `BTC/USDT: *${parseFloat(btc.price).toFixed(2)}*`,
          `ETH/USDT: *${parseFloat(eth.price).toFixed(2)}*`,
        ].join('\n'),
        { parse_mode: 'Markdown' }
      );
    } else if (text === '🔥 Top 10 Coins') {
      const topCoins = await getTopCoins(10);
      const reply = topCoins
        .map((c, i) =>
          `${i + 1}. *${c.symbol}*\nPrice: ${parseFloat(c.lastPrice).toFixed(
            4
          )} | 24h: ${parseFloat(c.priceChangePercent).toFixed(2)}%`
        )
        .join('\n\n');

      await bot.sendMessage(chatId, `🔥 *Top 10 USDT Pairs by Volume*\n\n${reply}`, {
        parse_mode: 'Markdown',
      });
    } else if (text === '📈 BTC Analysis') {
      const btc = await getPrice('BTCUSDT');
      await bot.sendMessage(
        chatId,
        `📈 *BTC Analysis*\nBTC/USDT: *${parseFloat(btc.price).toFixed(2)}*`,
        { parse_mode: 'Markdown' }
      );
      // Send a BTC image from a public crypto logo CDN
      await bot.sendPhoto(chatId, 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', {
        caption: '🖼 BTC logo from CoinGecko',
      });
    } else if (text === '📄 ETH Analysis') {
      const eth = await getPrice('ETHUSDT');
      await bot.sendMessage(
        chatId,
        `📄 *ETH Analysis*\nETH/USDT: *${parseFloat(eth.price).toFixed(2)}*`,
        { parse_mode: 'Markdown' }
      );
      // Send an ETH image from a public crypto logo CDN
      await bot.sendPhoto(chatId, 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', {
        caption: '🖼 ETH logo from CoinGecko',
      });
    } else if (text === '🔔 Set Alert') {
      await bot.sendMessage(
        chatId,
        '🔔 Alert setup will be added soon (placeholder).'
      );
    } else if (text === '⚠️ My Alerts') {
      await bot.sendMessage(
        chatId,
        '⚠️ No alerts stored yet (placeholder).'
      );
    } else if (text === '📰 Market Overview') {
      const topCoins = await getTopCoins(5);
      const reply = topCoins
        .map(
          (c) =>
            `*${c.symbol}*  Price: ${parseFloat(c.lastPrice).toFixed(
              4
            )}  | 24h: ${parseFloat(c.priceChangePercent).toFixed(2)}%`
        )
        .join('\n');

      await bot.sendMessage(chatId, `📰 *Market Overview (Top 5)*\n\n${reply}`, {
        parse_mode: 'Markdown',
      });
      // Example generic market image (can be replaced with a Binance/other chart URL you like)
      await bot.sendPhoto(
        chatId,
        'https://static.coingecko.com/s/featured_coins/featured_coins_background-14a2fdbef674e7dc86d51a0d65704fbf9f6b2d98b5eb2d6468d4bcee66216c0e.png',
        {
          caption: '🖼 Market overview image',
        }
      );
    } else if (text === '❓ Help') {
      await bot.sendMessage(
        chatId,
        [
          '❓ *Help*',
          '',
          '• 📊 *Live Prices*: Quick BTC & ETH prices.',
          '• 🔥 *Top 10 Coins*: Top 10 USDT pairs by volume.',
          '• 📈 *BTC Analysis* / 📄 *ETH Analysis*: Basic price snapshot.',
          '• 🔔 *Set Alert* / ⚠️ *My Alerts*: Alerts (coming soon).',
          '• 📰 *Market Overview*: Short overview of top coins.',
        ].join('\n'),
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, '⚠️ Something went wrong while fetching data.');
  }
});

console.log('Crypto Tracker Bot is running…');
