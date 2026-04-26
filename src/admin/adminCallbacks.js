const { isAdmin } = require('./auth');
const { getAllUsers, getUser, banUser, unbanUser, getBannedUsers, getStats } = require('./userManager');
const { getServerList, getServerById } = require('../vpn/serverList');
const {
  getAdminMenuKeyboard,
  getAdminServerKeyboard,
  getAdminServerActionsKeyboard,
  getUserActionsKeyboard,
  getAdminBackKeyboard,
} = require('./adminKeyboards');

const fs = require('fs');
const path = require('path');
const SERVERS_FILE = path.join(__dirname, '../../data/servers.json');

// Track broadcast state per admin
const broadcastState = {};

function handleAdminCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = String(query.from.id);
  const data = query.data;

  if (!isAdmin(query.from.id)) {
    bot.answerCallbackQuery(query.id, { text: '⛔ Not authorized' });
    return false;
  }

  bot.answerCallbackQuery(query.id);

  // ─── Admin Menu ────────────────────────────────────────────
  if (data === 'admin_menu') {
    return bot.editMessageText('🔧 *Admin Panel*', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getAdminMenuKeyboard(),
    });
  }

  // ─── Statistics ────────────────────────────────────────────
  if (data === 'admin_stats') {
    const stats = getStats();
    const text =
      `📊 *Bot Statistics*\n\n` +
      `👥 Total Users: *${stats.totalUsers}*\n` +
      `🟢 Active Today: *${stats.activeToday}*\n` +
      `🚫 Banned: *${stats.bannedCount}*\n` +
      `🔑 Total Keys Generated: *${stats.totalKeys}*\n` +
      `⚙️ Total Configs Generated: *${stats.totalConfigs}*\n`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getAdminBackKeyboard(),
    });
  }

  // ─── Users List ────────────────────────────────────────────
  if (data === 'admin_users') {
    const users = getAllUsers();
    const userList = Object.values(users);

    if (userList.length === 0) {
      return bot.editMessageText('👥 *Users*\n\nNo users yet.', {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      });
    }

    let text = `👥 *Users* (${userList.length})\n\n`;
    const buttons = [];

    userList.slice(0, 15).forEach((u) => {
      const username = u.username ? `@${u.username}` : u.firstName;
      text += `• ${username} (ID: \`${u.id}\`)\n`;
      buttons.push([
        { text: `${username} - ${u.id}`, callback_data: `admin_userinfo_${u.id}` },
      ]);
    });

    if (userList.length > 15) {
      text += `\n_...and ${userList.length - 15} more_`;
    }

    buttons.push([{ text: '« Admin Menu', callback_data: 'admin_menu' }]);

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // ─── User Info ─────────────────────────────────────────────
  if (data.startsWith('admin_userinfo_')) {
    const targetId = data.replace('admin_userinfo_', '');
    const user = getUser(targetId);

    if (!user) {
      return bot.editMessageText('User not found.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getAdminBackKeyboard(),
      });
    }

    const username = user.username ? `@${user.username}` : 'N/A';
    const text =
      `👤 *User Info*\n\n` +
      `*Name:* ${user.firstName} ${user.lastName || ''}\n` +
      `*Username:* ${username}\n` +
      `*ID:* \`${user.id}\`\n` +
      `*Joined:* ${user.joinedAt}\n` +
      `*Last Active:* ${user.lastActive}\n` +
      `*Keys Generated:* ${user.totalKeys || 0}\n` +
      `*Configs Generated:* ${user.totalConfigs || 0}\n`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getUserActionsKeyboard(targetId),
    });
  }

  // ─── Ban / Unban ───────────────────────────────────────────
  if (data.startsWith('admin_ban_')) {
    const targetId = data.replace('admin_ban_', '');
    banUser(targetId);
    return bot.editMessageText(`🚫 User \`${targetId}\` has been banned.`, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getUserActionsKeyboard(targetId),
    });
  }

  if (data.startsWith('admin_unban_')) {
    const targetId = data.replace('admin_unban_', '');
    unbanUser(targetId);
    return bot.editMessageText(`✅ User \`${targetId}\` has been unbanned.`, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getUserActionsKeyboard(targetId),
    });
  }

  // ─── Banned Users List ─────────────────────────────────────
  if (data === 'admin_banned') {
    const banned = getBannedUsers();

    if (banned.length === 0) {
      return bot.editMessageText('🚫 *Banned Users*\n\nNo banned users.', {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      });
    }

    let text = `🚫 *Banned Users* (${banned.length})\n\n`;
    const buttons = [];

    banned.forEach((id) => {
      const user = getUser(id);
      const name = user ? (user.username ? `@${user.username}` : user.firstName) : id;
      text += `• ${name} (\`${id}\`)\n`;
      buttons.push([
        { text: `✅ Unban ${name}`, callback_data: `admin_unban_${id}` },
      ]);
    });

    buttons.push([{ text: '« Admin Menu', callback_data: 'admin_menu' }]);

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // ─── Server Management ─────────────────────────────────────
  if (data === 'admin_servers') {
    const servers = getServerList();
    return bot.editMessageText('🖥 *Manage Servers*', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getAdminServerKeyboard(servers),
    });
  }

  if (data.startsWith('admsrv_')) {
    const serverId = parseInt(data.replace('admsrv_', ''));
    const server = getServerById(serverId);

    if (!server) {
      return bot.editMessageText('Server not found.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getAdminBackKeyboard(),
      });
    }

    const text =
      `🖥 *Server: ${server.name}*\n\n` +
      `*Host:* \`${server.host}\`\n` +
      `*Port:* \`${server.port}\`\n` +
      `*Country:* ${server.country}\n` +
      `*Status:* ${server.status === 'online' ? '🟢 Online' : '🔴 Offline'}\n` +
      `*Protocols:* ${server.protocols.join(', ')}\n`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getAdminServerActionsKeyboard(serverId),
    });
  }

  // ─── Set Server Status ─────────────────────────────────────
  if (data.startsWith('admsrvset_')) {
    const parts = data.replace('admsrvset_', '').split('_');
    const status = parts[0];
    const serverId = parseInt(parts[1]);

    const serversData = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    const server = serversData.servers.find((s) => s.id === serverId);

    if (server) {
      server.status = status;
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(serversData, null, 2));

      return bot.editMessageText(
        `Server *${server.name}* set to ${status === 'online' ? '🟢 Online' : '🔴 Offline'}`,
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: getAdminServerActionsKeyboard(serverId),
        }
      );
    }
  }

  // ─── Remove Server ─────────────────────────────────────────
  if (data.startsWith('admsrvdel_')) {
    const serverId = parseInt(data.replace('admsrvdel_', ''));
    const serversData = JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8'));
    const idx = serversData.servers.findIndex((s) => s.id === serverId);

    if (idx !== -1) {
      const removed = serversData.servers.splice(idx, 1)[0];
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(serversData, null, 2));

      return bot.editMessageText(`🗑 Server *${removed.name}* removed.`, {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      });
    }
  }

  // ─── Add Server Prompt ─────────────────────────────────────
  if (data === 'admin_addserver') {
    return bot.editMessageText(
      '➕ *Add Server*\n\n' +
      'Send server details in this format:\n\n' +
      '`/addserver name|host|port|country|protocols`\n\n' +
      'Example:\n' +
      '`/addserver Singapore 2|sg2.example.com|443|SG|vmess,vless,shadowsocks`',
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      }
    );
  }

  // ─── Broadcast Prompt ──────────────────────────────────────
  if (data === 'admin_broadcast') {
    broadcastState[userId] = true;
    return bot.editMessageText(
      '📢 *Broadcast*\n\n' +
      'Send the message you want to broadcast to all users.\n\n' +
      'Type /cancel to cancel.',
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      }
    );
  }

  // ─── Admin Orders ──────────────────────────────────────────
  if (data === 'admin_orders') {
    const { getAllPendingOrders } = require('../vpn/premiumManager');
    const pending = getAllPendingOrders();

    if (pending.length === 0) {
      return bot.editMessageText('💰 *Orders*\n\nPending order မရှိပါ။', {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      });
    }

    let text = `💰 *Pending Orders (${pending.length})*\n\n`;
    const buttons = [];
    for (const o of pending) {
      text += `⏳ \`${o.orderId}\`\n` +
        `   User: \`${o.userId}\` | ${o.planName} | ${o.price} Ks\n\n`;
      buttons.push([
        { text: `✅ ${o.orderId}`, callback_data: `order_approve_${o.orderId}` },
        { text: `❌ ${o.orderId}`, callback_data: `order_reject_${o.orderId}` },
      ]);
    }
    buttons.push([{ text: '« Admin Menu', callback_data: 'admin_menu' }]);

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // ─── Trial Control ────────────────────────────────────────
  if (data === 'admin_trial_control') {
    return bot.editMessageText(
      `🎁 *Trial Control*\n\n` +
      `*Commands:*\n` +
      `\`/trialreset <user_id>\` — User ရဲ့ trial reset\n\n` +
      `*Current Settings:*\n` +
      `📦 Data: ${process.env.TRIAL_DATA_GB || 100} GB\n` +
      `📅 Expiry: ${process.env.TRIAL_EXPIRY_DAYS || 10} Days\n` +
      `📱 IP Limit: ${process.env.TRIAL_IP_LIMIT || 1}\n` +
      `🔢 Max per user: ${process.env.TRIAL_MAX_PER_USER || 1}`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getAdminBackKeyboard(),
      }
    );
  }

  return false;
}

function isBroadcasting(userId) {
  return broadcastState[String(userId)] === true;
}

function clearBroadcast(userId) {
  delete broadcastState[String(userId)];
}

module.exports = { handleAdminCallback, isBroadcasting, clearBroadcast };
