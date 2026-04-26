const { getMainMenuKeyboard, getSettingsKeyboard, getBackKeyboard } = require('./keyboards');

function handleCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  // Acknowledge the callback to remove loading state
  bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'info':
      bot.editMessageText(
        'This is a custom Telegram bot built with JavaScript.\n\n' +
        'Features:\n' +
        '- Command handling\n' +
        '- Inline keyboards\n' +
        '- Message echo\n' +
        '- Callback queries',
        { chat_id: chatId, message_id: messageId, reply_markup: getBackKeyboard() }
      );
      break;

    case 'settings':
      bot.editMessageText('Settings:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: getSettingsKeyboard(),
      });
      break;

    case 'settings_language':
      bot.editMessageText('Language settings coming soon!', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
      break;

    case 'settings_notifications':
      bot.editMessageText('Notification settings coming soon!', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
      break;

    case 'help':
      bot.editMessageText(
        'Available Commands:\n\n' +
        '/start - Start the bot\n' +
        '/help - Show help message\n' +
        '/menu - Show main menu\n' +
        '/about - About this bot',
        { chat_id: chatId, message_id: messageId, reply_markup: getBackKeyboard() }
      );
      break;

    case 'back_to_menu':
      bot.editMessageText('Choose an option:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: getMainMenuKeyboard(),
      });
      break;

    default:
      bot.answerCallbackQuery(query.id, { text: 'Unknown action' });
  }
}

module.exports = { handleCallback };
