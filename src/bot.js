require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleCommand } = require('./commands');
const { handleCallback } = require('./callbacks');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('Bot is running...');

// --- Command Handlers ---
bot.onText(/\/start/, (msg) => handleCommand(bot, msg, 'start'));
bot.onText(/\/help/, (msg) => handleCommand(bot, msg, 'help'));
bot.onText(/\/menu/, (msg) => handleCommand(bot, msg, 'menu'));
bot.onText(/\/about/, (msg) => handleCommand(bot, msg, 'about'));

// --- Callback Query Handler (Inline Keyboard Buttons) ---
bot.on('callback_query', (query) => handleCallback(bot, query));

// --- Message Handler (non-command messages) ---
bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // skip commands

  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'User';

  bot.sendMessage(chatId, `${userName}, you said: "${msg.text}"\n\nType /help to see available commands.`);
});

// --- Error Handling ---
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('Bot error:', error.code, error.message);
});
