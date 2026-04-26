const { getMainMenuKeyboard } = require('./keyboards');
const { isAdmin } = require('./admin/auth');

function handleCommand(bot, msg, command) {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'User';

  switch (command) {
    case 'start':
      bot.sendMessage(chatId,
        `🔐 *VPN Key Bot*\n\n` +
        `Welcome, ${userName}!\n\n` +
        `This bot helps you:\n` +
        `• Generate VPN keys (UUID, passwords, etc.)\n` +
        `• Store & retrieve your keys\n` +
        `• Browse VPN servers\n` +
        `• Generate VMess / VLESS / Shadowsocks configs\n\n` +
        `Choose an option below or type /help`,
        { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
      );
      break;

    case 'help':
      bot.sendMessage(chatId,
        `📖 *VPN Key Bot - Help*\n\n` +
        `*Commands:*\n` +
        `/start - Start & show main menu\n` +
        `/help - Show this help\n` +
        `/genkey - Generate VPN keys\n` +
        `/mykeys - View saved keys\n` +
        `/servers - View server list\n` +
        `/vmess - Generate VMess config\n` +
        `/vless - Generate VLESS config\n` +
        `/ss - Generate Shadowsocks config\n` +
        `/menu - Show main menu\n\n` +
        (isAdmin(msg.from.id) ?
          `*Admin Commands:*\n` +
          `/admin - Admin panel\n` +
          `/addserver - Add VPN server\n` +
          `/broadcast - Broadcast message\n` +
          `/ban - Ban user\n` +
          `/unban - Unban user\n` +
          `/stats - Bot statistics\n\n` : '') +
        `Use the inline buttons for easy navigation!`,
        { parse_mode: 'Markdown' }
      );
      break;

    case 'menu':
      bot.sendMessage(chatId, '🔐 *Main Menu*', {
        parse_mode: 'Markdown',
        reply_markup: getMainMenuKeyboard(),
      });
      break;

    default:
      bot.sendMessage(chatId, 'Unknown command. Type /help for available commands.');
  }
}

module.exports = { handleCommand };
