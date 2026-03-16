require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(botToken, { polling: true });

// ==================== EXPRESS SERVER ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bot: 'Crypto Tracker Bot v2',
    features: ['live-prices', 'trending', 'top-10', 'global-data', 'search', 'charts', 'categories'],
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    running: true,
    version: '2.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

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
      'https://api.coingecko.com/api/v3/coins/markets',
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
      id: coin.id,
    }));
  } catch (err) {
    console.error('Error fetching top coins:', err.message);
    throw new Error('Failed to fetch market data');
  }
}

// Search for a coin
async function searchCoin(query) {
  try {
    const { data } = await apiClient.get('https://api.coingecko.com/api/v3/search', {
      params: { query },
    });
    return data.coins.slice(0, 10).map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      thumb: c.thumb,
    }));
  } catch (err) {
    console.error('Error searching coins:', err.message);
    throw new Error('Failed to search coins');
  }
}

// Get trending coins
async function getTrendingCoins() {
  try {
    const { data } = await apiClient.get('https://api.coingecko.com/api/v3/search/trending');
    return data.coins.slice(0, 10).map((c) => ({
      name: c.item.name,
      symbol: c.item.symbol.toUpperCase(),
      id: c.item.id,
      price: c.item.data?.price || 'N/A',
      priceChange: c.item.data?.price_change_24h?.usd || 0,
    }));
  } catch (err) {
    console.error('Error fetching trending coins:', err.message);
    throw new Error('Failed to fetch trending coins');
  }
}

// Get global market data
async function getGlobalData() {
  try {
    const { data } = await apiClient.get('https://api.coingecko.com/api/v3/global');
    const marketData = data.data || data;
    return {
      marketCap: marketData.total_market_cap?.usd || 0,
      btcDominance: marketData.market_cap_percentage?.btc || 0,
      ethDominance: marketData.market_cap_percentage?.eth || 0,
      volume24h: marketData.total_volume?.usd || 0,
    };
  } catch (err) {
    console.error('Error fetching global data:', err.message);
    throw new Error('Failed to fetch global data');
  }
}

// Get 7-day price history
async function getPriceHistory(coinId, days = 7) {
  try {
    const { data } = await apiClient.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
      {
        params: {
          vs_currency: 'usd',
          days: days,
          interval: 'daily',
        },
      }
    );
    const prices = data.prices.map((p) => ({ date: new Date(p[0]).toLocaleDateString(), price: p[1] }));
    const high = Math.max(...data.prices.map((p) => p[1]));
    const low = Math.min(...data.prices.map((p) => p[1]));
    const current = data.prices[data.prices.length - 1][1];
    return { prices, high, low, current };
  } catch (err) {
    console.error('Error fetching price history:', err.message);
    throw new Error('Failed to fetch price history');
  }
}

// Get coin categories
async function getCoinCategories() {
  try {
    const { data } = await apiClient.get('https://api.coingecko.com/api/v3/coins/categories');
    return (data || []).slice(0, 20).map((c) => ({
      name: c.name,
      id: c.category_id,
      marketCap: c.market_cap || 0,
      volume24h: c.volume_24h || 0,
    }));
  } catch (err) {
    console.error('Error fetching categories:', err.message);
    throw new Error('Failed to fetch categories');
  }
}

// Get coins by category
async function getCoinsByCategory(categoryId, limit = 5) {
  try {
    const { data } = await apiClient.get(
      `https://api.coingecko.com/api/v3/coins/markets`,
      {
        params: {
          vs_currency: 'usd',
          category: categoryId,
          order: 'market_cap_desc',
          per_page: limit,
          sparkline: false,
        },
      }
    );
    return data.map((c) => ({
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      change24h: c.price_change_percentage_24h || 0,
    }));
  } catch (err) {
    console.error('Error fetching category coins:', err.message);
    throw new Error('Failed to fetch category coins');
  }
}

// ==================== TELEGRAM HANDLERS ====================

// Start command - shows main menu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = [
    ['📊 Live Prices', '🔥 Trending'],
    ['💰 BTC', '💎 ETH'],
    ['📈 Top 10', '🌍 Global'],
    ['🔍 Search Coin', '📚 Categories'],
    ['📉 7-Day Chart', '❓ Help'],
  ];

  bot.sendMessage(
    chatId,
    '🤖 *Crypto Tracker Bot v2*\n\n💪 Enhanced with trending coins, historical data & more!',
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

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith('/')) {
    return;
  }

  try {
    if (text === '📊 Live Prices') {
      await handleLivePrices(chatId);
    } else if (text === '🔥 Trending') {
      await handleTrending(chatId);
    } else if (text === '💰 BTC') {
      await handleBTCAnalysis(chatId);
    } else if (text === '💎 ETH') {
      await handleETHAnalysis(chatId);
    } else if (text === '📈 Top 10') {
      await handleTopCoins(chatId);
    } else if (text === '🌍 Global') {
      await handleGlobalData(chatId);
    } else if (text === '🔍 Search Coin') {
      await bot.sendMessage(chatId, '🔍 Send me a coin name or symbol (e.g., Bitcoin, ETH, Ripple)');
      searchMode.add(chatId);
    } else if (text === '📚 Categories') {
      await handleCategories(chatId);
    } else if (text === '📉 7-Day Chart') {
      await bot.sendMessage(chatId, '📉 Which coin? (e.g., bitcoin, ethereum)');
      chartMode.add(chatId);
    } else if (text === '❓ Help') {
      await handleHelp(chatId);
    } else if (text === '🏠 Main Menu' || text === '🚀 Main Menu') {
      // Return to main menu
      categoryMode.delete(chatId);
      searchMode.delete(chatId);
      chartMode.delete(chatId);
      const keyboard = [
        ['📊 Live Prices', '🔥 Trending'],
        ['💰 BTC', '💎 ETH'],
        ['📈 Top 10', '🌍 Global'],
        ['🔍 Search Coin', '📚 Categories'],
        ['📉 7-Day Chart', '❓ Help'],
      ];
      await bot.sendMessage(
        chatId,
        '🤖 *Main Menu*\n\nChoose an option:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        }
      );
    } else if (text === '📚 Back to Categories') {
      await handleCategories(chatId);
    } else if (text === 'Back' && categoryMode.has(chatId)) {
      // Back button from category view
      await handleCategories(chatId);
    } else if (categoryMode.has(chatId)) {
      // User selected a category
      const categories = categoryMode.get(chatId);
      const selectedCategory = categories.find((c) => c.name.substring(0, 20) === text);
      if (selectedCategory) {
        await handleCategoryCoins(chatId, selectedCategory.id, selectedCategory.name);
      }
    } else if (searchMode.has(chatId)) {
      await handleSearchCoin(chatId, text);
      searchMode.delete(chatId);
    } else if (chartMode.has(chatId)) {
      await handlePriceChart(chatId, text);
      chartMode.delete(chatId);
    }
  } catch (err) {
    console.error('Handler error:', err);
    await bot.sendMessage(chatId, '❌ Error: ' + err.message);
  }
});

// Track search and chart modes
const searchMode = new Set();
const chartMode = new Set();
const categoryMode = new Map(); // Maps chatId to categories array

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
    '',
    `_📊 Real-time data from Coinbase_`,
  ].join('\n');

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleTrending(chatId) {
  const trending = await getTrendingCoins();

  const reply = trending
    .map(
      (c, i) =>
        `${i + 1}. *${c.name}* (${c.symbol})\n` +
        `💵 $${typeof c.price === 'number' ? c.price.toFixed(2) : c.price} | ` +
        `24h: ${c.priceChange > 0 ? '📈' : '📉'} ${c.priceChange.toFixed(2)}%`
    )
    .join('\n\n');

  await bot.sendMessage(chatId, `🔥 *Top 10 Trending Now 🚀*\n\n${reply}\n\n_📊 Data from CoinGecko_`, {
    parse_mode: 'Markdown',
  });
}

async function handleBTCAnalysis(chatId) {
  const btc = await getPrice('BTC-USD');

  await bot.sendMessage(
    chatId,
    `💰 *Bitcoin Analysis*\n\n` +
    `Current Price: *$${btc.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}*\n\n` +
    `_The leading cryptocurrency by market cap._\n` +
    `📊 _Data from Coinbase_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleETHAnalysis(chatId) {
  const eth = await getPrice('ETH-USD');

  await bot.sendMessage(
    chatId,
    `💎 *Ethereum Analysis*\n\n` +
    `Current Price: *$${eth.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}*\n\n` +
    `_The leading smart contract platform._\n` +
    `📊 _Data from Coinbase_`,
    { parse_mode: 'Markdown' }
  );
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

  await bot.sendMessage(chatId, `📈 *Top 10 by Market Cap*\n\n${reply}\n\n_📊 Data from CoinGecko_`, {
    parse_mode: 'Markdown',
  });
}

async function handleGlobalData(chatId) {
  const global = await getGlobalData();

  const message = [
    '🌍 *Global Market Data*',
    '',
    `Total Market Cap: *$${(global.marketCap / 1e12).toFixed(2)}T*`,
    `24h Volume: *$${(global.volume24h / 1e9).toFixed(2)}B*`,
    '',
    `Bitcoin Dominance: *${global.btcDominance.toFixed(2)}%*`,
    `Ethereum Dominance: *${global.ethDominance.toFixed(2)}%*`,
    '',
    `_📊 Data from CoinGecko_`,
  ].join('\n');

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleSearchCoin(chatId, query) {
  const results = await searchCoin(query);

  if (results.length === 0) {
    await bot.sendMessage(chatId, '❌ No coins found. Try another search.');
    return;
  }

  const reply = results
    .map((c) => `*${c.name}* (${c.symbol})`)
    .join('\n');

  await bot.sendMessage(chatId, `🔍 *Search Results for "${query}"*\n\n${reply}`, {
    parse_mode: 'Markdown',
  });
}

async function handlePriceChart(chatId, coinName) {
  const results = await searchCoin(coinName);

  if (results.length === 0) {
    await bot.sendMessage(chatId, '❌ Coin not found.');
    return;
  }

  const coin = results[0];
  const history = await getPriceHistory(coin.id, 7);

  const chartText = history.prices
    .map((p) => `${p.date}: $${p.price.toFixed(2)}`)
    .join('\n');

  const message = [
    `📉 *${coin.name} (${coin.symbol}) - 7 Day Chart*`,
    '',
    chartText,
    '',
    `📊 High: *$${history.high.toFixed(2)}*`,
    `📊 Low: *$${history.low.toFixed(2)}*`,
    `📊 Current: *$${history.current.toFixed(2)}*`,
    '',
    `_📊 Data from CoinGecko_`,
  ].join('\n');

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleCategories(chatId) {
  const categories = await getCoinCategories();

  const keyboard = categories
    .slice(0, 8)
    .map((c) => [c.name.substring(0, 20)]);
  
  // Add back button
  keyboard.push(['Back']);

  const message = categories
    .slice(0, 8)
    .map((c) => `*${c.name}*\n💰 Market Cap: $${(c.marketCap / 1e9).toFixed(2)}B`)
    .join('\n\n');

  // Store categories for this chat
  categoryMode.set(chatId, categories.slice(0, 8));

  await bot.sendMessage(
    chatId,
    `📚 *Top Coin Categories*\n\n${message}\n\n👇 Choose a category:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard,
        resize_keyboard: true,
      },
    }
  );
}

async function handleCategoryCoins(chatId, categoryId, categoryName) {
  try {
    const coins = await getCoinsByCategory(categoryId, 10);

    if (coins.length === 0) {
      await bot.sendMessage(chatId, `❌ No coins found in ${categoryName} category.`);
      return;
    }

    const reply = coins
      .map(
        (c, i) =>
          `${i + 1}. *${c.name}* (${c.symbol})\n` +
          `💵 $${c.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} | ` +
          `24h: ${c.change24h > 0 ? '📈' : '📉'} ${Math.abs(c.change24h).toFixed(2)}%`
      )
      .join('\n\n');

    await bot.sendMessage(
      chatId,
      `📚 *${categoryName}*\n\n${reply}`,
      { parse_mode: 'Markdown' }
    );

    // Return to categories menu
    const keyboard = [['📚 Back to Categories'], ['🏠 Main Menu']];
    await bot.sendMessage(
      chatId,
      'What next?',
      {
        reply_markup: {
          keyboard,
          resize_keyboard: true,
        },
      }
    );
  } catch (err) {
    console.error('Error in handleCategoryCoins:', err);
    await bot.sendMessage(chatId, '❌ Failed to fetch coins for this category.');
  }
}

async function handleHelp(chatId) {
  const helpText = `
❓ *Features*

📊 *Live Prices* - BTC & ETH real-time
🔥 *Trending* - Hot coins right now 🚀
💰 *BTC* / 💎 *ETH* - Deep analysis
📈 *Top 10* - By market cap
🌍 *Global* - Total market data
🔍 *Search* - Find any coin
📚 *Categories* - Browse by sector
📉 *7-Day Chart* - Price history

*Data from:*
• Coinbase (Real-time prices)
• CoinGecko (Comprehensive data)

_All free • No API keys needed_
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

console.log('🤖 Crypto Tracker Bot v2 started!');
console.log('✅ Features: Live prices, trending, search, charts, global data');
console.log('✅ Data sources: Coinbase + CoinGecko (No API keys needed)');
console.log('✅ Web endpoints: /health, /status');
console.log('🚀 Ready!\n');
