require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleCommand } = require('./commands');
const { handleCallback } = require('./callbacks');
const { getOnlineServers, formatServerList } = require('./vpn/serverList');
const { getMainMenuKeyboard, getKeyTypeKeyboard, getProtocolKeyboard, getServerListKeyboard } = require('./keyboards');
const { isAdmin, requireAdmin } = require('./admin/auth');
const { registerUser, isBanned, getAllUsers, incrementStat } = require('./admin/userManager');
const { handleAdminCallback, isBroadcasting, clearBroadcast } = require('./admin/adminCallbacks');
const { getAdminMenuKeyboard } = require('./admin/adminKeyboards');

const fs = require('fs');
const path = require('path');
const SERVERS_FILE = path.join(__dirname, '../data/servers.json');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('VPN Key Bot is running...');

// ─── Middleware: Register user & check ban ───────────────────
bot.on('message', (msg) => {
  if (!msg.from) return;
  registerUser(msg.from);

  if (isBanned(msg.from.id)) {
    if (msg.text && !msg.text.startsWith('/start')) return;
    bot.sendMessage(msg.chat.id, '⛔ You have been banned from using this bot.');
    return;
  }
});

// ─── Admin Commands ──────────────────────────────────────────
bot.onText(/\/admin/, (msg) => {
  if (!requireAdmin(bot, msg)) return;
  bot.sendMessage(msg.chat.id, '🔧 *Admin Panel*', {
    parse_mode: 'Markdown',
    reply_markup: getAdminMenuKeyboard(),
  });
});

bot.onText(/\/addserver (.+)/, (msg, match) => {
  if (!requireAdmin(bot, msg)) return;
  const parts = match[1].split('|');

  if (parts.length < 5) {
    bot.sendMessage(msg.chat.id,
      '❌ Invalid format.\n\nUse: `/addserver name|host|port|country|protocols`\n\n' +
      'Example: `/addserver Singapore 2|sg2.example.com|443|SG|vmess,vless,shadowsocks`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const [name, host, port, country, protocols] = parts;

  let serversData;
  if (fs.existsSync(SERVERS_FILE)) {
    serversData = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
  } else {
    serversData = { servers: [] };
  }

  const maxId = serversData.servers.reduce((max, s) => Math.max(max, s.id), 0);

  const newServer = {
    id: maxId + 1,
    name: name.trim(),
    host: host.trim(),
    port: parseInt(port.trim()),
    country: country.trim().toUpperCase(),
    status: 'online',
    protocols: protocols.split(',').map((p) => p.trim()),
  };

  serversData.servers.push(newServer);
  fs.writeFileSync(SERVERS_FILE, JSON.stringify(serversData, null, 2));

  bot.sendMessage(msg.chat.id,
    `✅ Server added!\n\n` +
    `*Name:* ${newServer.name}\n` +
    `*Host:* \`${newServer.host}\`\n` +
    `*Port:* ${newServer.port}\n` +
    `*Country:* ${newServer.country}\n` +
    `*Protocols:* ${newServer.protocols.join(', ')}`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!requireAdmin(bot, msg)) return;
  const text = match[1];
  const users = getAllUsers();
  const userIds = Object.keys(users);

  let sent = 0;
  let failed = 0;

  bot.sendMessage(msg.chat.id, `📢 Broadcasting to ${userIds.length} users...`);

  for (const uid of userIds) {
    try {
      await bot.sendMessage(uid, `📢 *Broadcast*\n\n${text}`, { parse_mode: 'Markdown' });
      sent++;
    } catch {
      failed++;
    }
  }

  bot.sendMessage(msg.chat.id, `📢 Broadcast complete!\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
});

bot.onText(/\/ban (\d+)/, (msg, match) => {
  if (!requireAdmin(bot, msg)) return;
  const { banUser } = require('./admin/userManager');
  banUser(match[1]);
  bot.sendMessage(msg.chat.id, `🚫 User \`${match[1]}\` banned.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/unban (\d+)/, (msg, match) => {
  if (!requireAdmin(bot, msg)) return;
  const { unbanUser } = require('./admin/userManager');
  unbanUser(match[1]);
  bot.sendMessage(msg.chat.id, `✅ User \`${match[1]}\` unbanned.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/stats/, (msg) => {
  if (!requireAdmin(bot, msg)) return;
  const { getStats } = require('./admin/userManager');
  const stats = getStats();
  bot.sendMessage(msg.chat.id,
    `📊 *Bot Statistics*\n\n` +
    `👥 Total Users: *${stats.totalUsers}*\n` +
    `🟢 Active Today: *${stats.activeToday}*\n` +
    `🚫 Banned: *${stats.bannedCount}*\n` +
    `🔑 Total Keys: *${stats.totalKeys}*\n` +
    `⚙️ Total Configs: *${stats.totalConfigs}*`,
    { parse_mode: 'Markdown' }
  );
});

// ─── User Commands ───────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  if (isBanned(msg.from.id)) return;
  handleCommand(bot, msg, 'start');
});

bot.onText(/\/help/, (msg) => {
  if (isBanned(msg.from.id)) return;
  handleCommand(bot, msg, 'help');
});

bot.onText(/\/menu/, (msg) => {
  if (isBanned(msg.from.id)) return;
  handleCommand(bot, msg, 'menu');
});

bot.onText(/\/genkey/, (msg) => {
  if (isBanned(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '🔑 *Generate VPN Key*\n\nChoose key type:', {
    parse_mode: 'Markdown',
    reply_markup: getKeyTypeKeyboard(),
  });
});

bot.onText(/\/mykeys/, (msg) => {
  if (isBanned(msg.from.id)) return;
  handleCallback(bot, {
    id: 'cmd',
    from: msg.from,
    message: { chat: msg.chat, message_id: msg.message_id },
    data: 'menu_mykeys',
  });
});

bot.onText(/\/servers/, (msg) => {
  if (isBanned(msg.from.id)) return;
  const servers = getOnlineServers();
  bot.sendMessage(msg.chat.id, formatServerList(servers), {
    parse_mode: 'Markdown',
    reply_markup: getServerListKeyboard(servers),
  });
});

bot.onText(/\/vmess/, (msg) => {
  if (isBanned(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '⚙️ *Generate Config*\n\nChoose protocol:', {
    parse_mode: 'Markdown',
    reply_markup: getProtocolKeyboard(),
  });
});

bot.onText(/\/vless/, (msg) => {
  if (isBanned(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '⚙️ *Generate Config*\n\nChoose protocol:', {
    parse_mode: 'Markdown',
    reply_markup: getProtocolKeyboard(),
  });
});

bot.onText(/\/ss/, (msg) => {
  if (isBanned(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '⚙️ *Generate Config*\n\nChoose protocol:', {
    parse_mode: 'Markdown',
    reply_markup: getProtocolKeyboard(),
  });
});

bot.onText(/\/cancel/, (msg) => {
  clearBroadcast(msg.from.id);
  bot.sendMessage(msg.chat.id, 'Cancelled.', { reply_markup: getMainMenuKeyboard() });
});

// ─── Callback Query Handler ─────────────────────────────────
bot.on('callback_query', (query) => {
  if (isBanned(query.from.id)) {
    bot.answerCallbackQuery(query.id, { text: '⛔ You are banned' });
    return;
  }

  registerUser(query.from);

  // Check if it's an admin callback
  if (query.data.startsWith('admin_') || query.data.startsWith('admsrv')) {
    return handleAdminCallback(bot, query);
  }

  return handleCallback(bot, query);
});

// ─── Broadcast message handler ───────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  if (!isAdmin(msg.from.id)) return;
  if (!isBroadcasting(msg.from.id)) return;

  clearBroadcast(msg.from.id);

  const users = getAllUsers();
  const userIds = Object.keys(users);
  let sent = 0;
  let failed = 0;

  bot.sendMessage(msg.chat.id, `📢 Broadcasting to ${userIds.length} users...`);

  for (const uid of userIds) {
    try {
      await bot.sendMessage(uid, `📢 *Broadcast*\n\n${msg.text}`, { parse_mode: 'Markdown' });
      sent++;
    } catch {
      failed++;
    }
  }

  bot.sendMessage(msg.chat.id, `📢 Broadcast complete!\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
});

// ─── General Message Handler ─────────────────────────────────
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  if (isBanned(msg.from.id)) return;
  if (isAdmin(msg.from.id) && isBroadcasting(msg.from.id)) return;

  bot.sendMessage(msg.chat.id,
    'Type /help to see available commands or use the menu below.',
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
