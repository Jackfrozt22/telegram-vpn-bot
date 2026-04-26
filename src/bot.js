require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleCommand } = require('./commands');
const { handleCallback } = require('./callbacks');
const { generateVPNKey } = require('./vpn/keyGenerator');
const { storeKey } = require('./vpn/keyStore');
const { getOnlineServers, formatServerList } = require('./vpn/serverList');
const { getMainMenuKeyboard, getKeyTypeKeyboard, getProtocolKeyboard, getServerListKeyboard } = require('./keyboards');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('VPN Key Bot is running...');

// ─── Command Handlers ────────────────────────────────────────
bot.onText(/\/start/, (msg) => handleCommand(bot, msg, 'start'));
bot.onText(/\/help/, (msg) => handleCommand(bot, msg, 'help'));
bot.onText(/\/menu/, (msg) => handleCommand(bot, msg, 'menu'));

bot.onText(/\/genkey/, (msg) => {
  bot.sendMessage(msg.chat.id, '🔑 *Generate VPN Key*\n\nChoose key type:', {
    parse_mode: 'Markdown',
    reply_markup: getKeyTypeKeyboard(),
  });
});

bot.onText(/\/mykeys/, (msg) => {
  const { handleCallback } = require('./callbacks');
  handleCallback(bot, {
    id: 'cmd',
    from: msg.from,
    message: { chat: msg.chat, message_id: msg.message_id },
    data: 'menu_mykeys',
  });
});

bot.onText(/\/servers/, (msg) => {
  const servers = getOnlineServers();
  bot.sendMessage(msg.chat.id, formatServerList(servers), {
    parse_mode: 'Markdown',
    reply_markup: getServerListKeyboard(servers),
  });
});

bot.onText(/\/vmess/, (msg) => {
  bot.sendMessage(msg.chat.id, '⚙️ *Generate Config*\n\nChoose protocol:', {
    parse_mode: 'Markdown',
    reply_markup: getProtocolKeyboard(),
  });
});

bot.onText(/\/vless/, (msg) => {
  bot.sendMessage(msg.chat.id, '⚙️ *Generate Config*\n\nChoose protocol:', {
    parse_mode: 'Markdown',
    reply_markup: getProtocolKeyboard(),
  });
});

bot.onText(/\/ss/, (msg) => {
  bot.sendMessage(msg.chat.id, '⚙️ *Generate Config*\n\nChoose protocol:', {
    parse_mode: 'Markdown',
    reply_markup: getProtocolKeyboard(),
  });
});

// ─── Callback Query Handler ─────────────────────────────────
bot.on('callback_query', (query) => handleCallback(bot, query));

// ─── Message Handler ─────────────────────────────────────────
bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `Type /help to see available commands or use the menu below.`,
    { reply_markup: getMainMenuKeyboard() }
  );
});

// ─── Error Handling ──────────────────────────────────────────
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('Bot error:', error.code, error.message);
});
