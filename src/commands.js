const { getMainMenuKeyboard, getSettingsKeyboard } = require('./keyboards');

function handleCommand(bot, msg, command) {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'User';

  switch (command) {
    case 'start':
      bot.sendMessage(chatId,
        `Hello ${userName}! Welcome to the bot.\n\n` +
        `Use the menu below or type /help to see all commands.`,
        { reply_markup: getMainMenuKeyboard() }
      );
      break;

    case 'help':
      bot.sendMessage(chatId,
        `Available Commands:\n\n` +
        `/start - Start the bot\n` +
        `/help - Show this help message\n` +
        `/menu - Show main menu\n` +
        `/about - About this bot\n\n` +
        `You can also send me any text message and I'll echo it back!`
      );
      break;

    case 'menu':
      bot.sendMessage(chatId, 'Choose an option:', {
        reply_markup: getMainMenuKeyboard(),
      });
      break;

    case 'about':
      bot.sendMessage(chatId,
        `This bot is built with Node.js and node-telegram-bot-api.\n` +
        `Version: 1.0.0`
      );
      break;

    default:
      bot.sendMessage(chatId, 'Unknown command. Type /help for available commands.');
  }
}

module.exports = { handleCommand };
