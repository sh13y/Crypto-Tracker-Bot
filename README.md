## Crypto Tracker Telegram Bot (Node.js)

This is a simple Telegram button bot built with Node.js that shows:

- **Real-time prices** (Binance public API, e.g. BTC/ETH vs USDT)
- **Top coins by 24h volume** (USDT markets)
- **Latest crypto news** (optional, via CryptoCompare News API or similar)

### 1. Requirements

- Node.js 18+ installed
- A **Telegram bot token** from BotFather
- (Optional) A crypto news API key if you want the news feature

### 2. Setup

In the project folder:

```bash
npm install
```

Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Then edit `.env` and set:

- `TELEGRAM_BOT_TOKEN` = your Telegram bot token
- (Optional) `CRYPTO_NEWS_API_KEY` if you want the news feature

### 3. Run the bot

```bash
npm start
```

Then open Telegram, search for your bot, and send:

```text
/start
```

Use the on-screen buttons to get **BTC/ETH price**, **Top coins**, and **Crypto news**.

