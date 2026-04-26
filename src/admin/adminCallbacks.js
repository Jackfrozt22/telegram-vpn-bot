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

async function handleAdminCallback(bot, query) {
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
    const { getTrialConfig } = require('../vpn/trialManager');
    const xuiClient = require('../vpn/xuiClient');
    const config = getTrialConfig();

    let inboundName = `ID: ${config.inboundId}`;
    try {
      const inbound = await xuiClient.getInbound(config.inboundId);
      if (inbound) inboundName = `${inbound.remark} (ID: ${config.inboundId})`;
    } catch {}

    return bot.editMessageText(
      `🎁 *Trial Control*\n\n` +
      `*Current Settings:*\n` +
      `🌐 Inbound: *${inboundName}*\n` +
      `📦 Data: *${config.totalGB} GB*\n` +
      `📅 Expiry: *${config.expiryDays} Days*\n` +
      `📱 IP Limit: *${config.ipLimit}*\n` +
      `🔢 Max per user: *${config.maxTrials}*\n\n` +
      `Setting ပြင်ချင်ရင် အောက်က button နှိပ်ပါ`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌐 Inbound ပြောင်း', callback_data: 'admin_trial_set_inbound' }],
            [
              { text: '📦 Data GB ပြင်', callback_data: 'admin_trial_set_gb' },
              { text: '📅 Days ပြင်', callback_data: 'admin_trial_set_days' },
            ],
            [
              { text: '📱 IP Limit ပြင်', callback_data: 'admin_trial_set_ip' },
              { text: '🔢 Max Trials ပြင်', callback_data: 'admin_trial_set_max' },
            ],
            [
              { text: '🔄 User Reset', callback_data: 'admin_trial_reset_user' },
              { text: '🔄 All Reset', callback_data: 'admin_trial_reset_all' },
            ],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
      }
    );
  }

  // ─── Trial Inbound Selector ───────────────────────────────
  if (data === 'admin_trial_set_inbound') {
    const xuiClient = require('../vpn/xuiClient');
    try {
      const result = await xuiClient.listInbounds();
      if (!result.success || !result.obj || result.obj.length === 0) {
        return bot.editMessageText('❌ Inbound မရှိပါ။', {
          chat_id: chatId, message_id: messageId,
          reply_markup: getAdminBackKeyboard(),
        });
      }

      const buttons = result.obj.map((inb) => [
        {
          text: `${inb.remark} (${inb.protocol}, port: ${inb.port})`,
          callback_data: `admin_trial_inb_${inb.id}`,
        },
      ]);
      buttons.push([{ text: '« Back', callback_data: 'admin_trial_control' }]);

      return bot.editMessageText(
        `🌐 *Trial Inbound ပြောင်း*\n\nInbound ရွေးချယ်ပါ:`,
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons },
        }
      );
    } catch (err) {
      return bot.editMessageText(`❌ Error: ${err.message}`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: getAdminBackKeyboard(),
      });
    }
  }

  if (data.startsWith('admin_trial_inb_')) {
    const inboundId = parseInt(data.replace('admin_trial_inb_', ''));
    const { updateTrialConfig } = require('../vpn/trialManager');
    const xuiClient = require('../vpn/xuiClient');

    let inboundName = `ID: ${inboundId}`;
    try {
      const inbound = await xuiClient.getInbound(inboundId);
      if (inbound) inboundName = inbound.remark;
    } catch {}

    updateTrialConfig({ inboundId });
    return bot.editMessageText(
      `✅ Trial Inbound *${inboundName}* (ID: ${inboundId}) သို့ ပြောင်းပြီးပါပြီ!`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Control', callback_data: 'admin_trial_control' }],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
      }
    );
  }

  // ─── Trial Reset: Single User (prompt for ID) ──────────────
  if (data === 'admin_trial_reset_user') {
    broadcastState[`reset_${userId}`] = true;
    return bot.editMessageText(
      `🔄 *Trial Reset (User)*\n\nReset လုပ်ချင်တဲ့ User ID ကို ရိုက်ထည့်ပါ:`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '« Back', callback_data: 'admin_trial_control' }],
          ],
        },
      }
    );
  }

  // ─── Trial Reset: All Users ────────────────────────────────
  if (data === 'admin_trial_reset_all') {
    return bot.editMessageText(
      `⚠️ *All User Trial Reset*\n\nUser အားလုံးရဲ့ trial ကို reset လုပ်မှာ သေချာပါသလား?`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Reset All', callback_data: 'admin_trial_reset_all_confirm' }],
            [{ text: '❌ Cancel', callback_data: 'admin_trial_control' }],
          ],
        },
      }
    );
  }

  if (data === 'admin_trial_reset_all_confirm') {
    const { resetTrial } = require('../vpn/trialManager');
    const trialsFile = path.join(__dirname, '../../data/trials.json');

    let resetCount = 0;
    if (fs.existsSync(trialsFile)) {
      const trialsData = JSON.parse(fs.readFileSync(trialsFile, 'utf8'));
      const userIdsToReset = Object.keys(trialsData.trials || {});
      resetCount = userIdsToReset.length;

      // Reset all
      trialsData.trials = {};
      fs.writeFileSync(trialsFile, JSON.stringify(trialsData, null, 2));

      // Notify all users
      for (const uid of userIdsToReset) {
        try {
          await bot.sendMessage(uid,
            `🎉 Trial Key ပြန်လည်ရယူနိုင်ပါပြီ!\n\nAdmin မှ trial reset လုပ်ပေးထားပါတယ်။ 🎁 Trial Key ကို ပြန်ထုတ်ယူနိုင်ပါပြီ။`
          );
        } catch {}
      }
    }

    return bot.editMessageText(
      `✅ User ${resetCount} ယောက် trial reset ပြီးပါပြီ!\nUser အားလုံးကို notify ပို့ပြီးပါပြီ။`,
      {
        chat_id: chatId, message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Control', callback_data: 'admin_trial_control' }],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
      }
    );
  }

  // ─── Trial Setting Options ────────────────────────────────
  if (data === 'admin_trial_set_gb') {
    return bot.editMessageText(
      `📦 *Trial Data GB ပြင်*\n\nGB ပမာဏ ရွေးချယ်ပါ:`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '50 GB', callback_data: 'admin_trial_gb_50' },
              { text: '100 GB', callback_data: 'admin_trial_gb_100' },
              { text: '150 GB', callback_data: 'admin_trial_gb_150' },
            ],
            [
              { text: '200 GB', callback_data: 'admin_trial_gb_200' },
              { text: '250 GB', callback_data: 'admin_trial_gb_250' },
              { text: '500 GB', callback_data: 'admin_trial_gb_500' },
            ],
            [{ text: '« Back', callback_data: 'admin_trial_control' }],
          ],
        },
      }
    );
  }

  if (data.startsWith('admin_trial_gb_')) {
    const gb = parseInt(data.replace('admin_trial_gb_', ''));
    const { updateTrialConfig } = require('../vpn/trialManager');
    updateTrialConfig({ totalGB: gb });
    return bot.editMessageText(
      `✅ Trial Data *${gb} GB* သို့ ပြောင်းပြီးပါပြီ!`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Control', callback_data: 'admin_trial_control' }],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
      }
    );
  }

  if (data === 'admin_trial_set_days') {
    return bot.editMessageText(
      `📅 *Trial Expiry Days ပြင်*\n\nရက် ပမာဏ ရွေးချယ်ပါ:`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '3 Days', callback_data: 'admin_trial_days_3' },
              { text: '5 Days', callback_data: 'admin_trial_days_5' },
              { text: '7 Days', callback_data: 'admin_trial_days_7' },
            ],
            [
              { text: '10 Days', callback_data: 'admin_trial_days_10' },
              { text: '14 Days', callback_data: 'admin_trial_days_14' },
              { text: '30 Days', callback_data: 'admin_trial_days_30' },
            ],
            [{ text: '« Back', callback_data: 'admin_trial_control' }],
          ],
        },
      }
    );
  }

  if (data.startsWith('admin_trial_days_')) {
    const days = parseInt(data.replace('admin_trial_days_', ''));
    const { updateTrialConfig } = require('../vpn/trialManager');
    updateTrialConfig({ expiryDays: days });
    return bot.editMessageText(
      `✅ Trial Expiry *${days} Days* သို့ ပြောင်းပြီးပါပြီ!`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Control', callback_data: 'admin_trial_control' }],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
      }
    );
  }

  if (data === 'admin_trial_set_ip') {
    return bot.editMessageText(
      `📱 *Trial IP Limit ပြင်*\n\nDevice limit ရွေးချယ်ပါ:`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '1 Device', callback_data: 'admin_trial_ip_1' },
              { text: '2 Devices', callback_data: 'admin_trial_ip_2' },
              { text: '3 Devices', callback_data: 'admin_trial_ip_3' },
            ],
            [{ text: '« Back', callback_data: 'admin_trial_control' }],
          ],
        },
      }
    );
  }

  if (data.startsWith('admin_trial_ip_')) {
    const ip = parseInt(data.replace('admin_trial_ip_', ''));
    const { updateTrialConfig } = require('../vpn/trialManager');
    updateTrialConfig({ ipLimit: ip });
    return bot.editMessageText(
      `✅ Trial IP Limit *${ip}* သို့ ပြောင်းပြီးပါပြီ!`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Control', callback_data: 'admin_trial_control' }],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
      }
    );
  }

  if (data === 'admin_trial_set_max') {
    return bot.editMessageText(
      `🔢 *Trial Max Per User ပြင်*\n\nအကြိမ် ပမာဏ ရွေးချယ်ပါ:`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '1 ကြိမ်', callback_data: 'admin_trial_max_1' },
              { text: '2 ကြိမ်', callback_data: 'admin_trial_max_2' },
              { text: '3 ကြိမ်', callback_data: 'admin_trial_max_3' },
            ],
            [{ text: '« Back', callback_data: 'admin_trial_control' }],
          ],
        },
      }
    );
  }

  if (data.startsWith('admin_trial_max_')) {
    const max = parseInt(data.replace('admin_trial_max_', ''));
    const { updateTrialConfig } = require('../vpn/trialManager');
    updateTrialConfig({ maxTrials: max });
    return bot.editMessageText(
      `✅ Trial Max per user *${max}* ကြိမ် သို့ ပြောင်းပြီးပါပြီ!`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Control', callback_data: 'admin_trial_control' }],
            [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
          ],
        },
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

function isResettingTrial(userId) {
  return broadcastState[`reset_${String(userId)}`] === true;
}

function clearTrialReset(userId) {
  delete broadcastState[`reset_${String(userId)}`];
}

module.exports = { handleAdminCallback, isBroadcasting, clearBroadcast, isResettingTrial, clearTrialReset };
