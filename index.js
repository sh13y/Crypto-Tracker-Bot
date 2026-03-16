require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(botToken, { polling: true });
const COINBASE_BASE_URL = 'https://api.coinbase.com/v2';

// Helper: fetch price from Coinbase
async function getPrice(symbol = 'BTC-USD') {
  try {
    const { data } = await axios.get(`${COINBASE_BASE_URL}/prices/${symbol}/spot`);
    return {
      symbol: symbol,
      price: data.data.amount,
    };
  } catch (err) {
    console.error(`Error fetching price for ${symbol}:`, err.message);
    throw err;
  }
}

// Helper: fetch top coins by market cap (using CoinGecko free API)
async function getTopCoins(limit = 5) {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        sparkline: false,
      },
    });
    return data.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      lastPrice: coin.current_price,
      priceChangePercent: coin.price_change_percentage_24h || 0,
      marketCap: coin.market_cap,
    }));
  } catch (err) {
    console.error('Error fetching top coins:', err.message);
    throw err;
  }
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
      const [btc, eth] = await Promise.all([getPrice('BTC-USD'), getPrice('ETH-USD')]);
      await bot.sendMessage(
        chatId,
        [
          '📊 *Live Prices*',
          `BTC/USD: *$${parseFloat(btc.price).toFixed(2)}*`,
          `ETH/USD: *$${parseFloat(eth.price).toFixed(2)}*`,
        ].join('\n'),
        { parse_mode: 'Markdown' }
      );
    } else if (text === '🔥 Top 10 Coins') {
      const topCoins = await getTopCoins(10);
      const reply = topCoins
        .map((c, i) =>
          `${i + 1}. *${c.symbol}* (${c.name})\nPrice: $${parseFloat(c.lastPrice).toFixed(
            2
          )} | 24h: ${parseFloat(c.priceChangePercent).toFixed(2)}%`
        )
        .join('\n\n');

      await bot.sendMessage(chatId, `🔥 *Top 10 Coins by Market Cap*\n\n${reply}`, {
        parse_mode: 'Markdown',
      });
    } else if (text === '📈 BTC Analysis') {
      const btc = await getPrice('BTC-USD');
      await bot.sendMessage(
        chatId,
        `📈 *BTC Analysis*\nBTC/USD: *$${parseFloat(btc.price).toFixed(2)}*`,
        { parse_mode: 'Markdown' }
      );
      // Send a BTC image from a public crypto logo CDN
      await bot.sendPhoto(chatId, 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', {
        caption: '🖼 BTC logo from CoinGecko',
      });
    } else if (text === '📄 ETH Analysis') {
      const eth = await getPrice('ETH-USD');
      await bot.sendMessage(
        chatId,
        `📄 *ETH Analysis*\nETH/USD: *$${parseFloat(eth.price).toFixed(2)}*`,
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
            `*${c.symbol}* (${c.name})  Price: $${parseFloat(c.lastPrice).toFixed(
              2
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
