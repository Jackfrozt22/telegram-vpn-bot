require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleCommand } = require('./commands');
const { handleCallback } = require('./callbacks');
const { getMainMenuKeyboard } = require('./keyboards');
const { isAdmin, requireAdmin } = require('./admin/auth');
const { registerUser, isBanned, getAllUsers } = require('./admin/userManager');
const { handleAdminCallback, isBroadcasting, clearBroadcast, isResettingTrial, clearTrialReset, isExtendingKey, clearKeyExtend } = require('./admin/adminCallbacks');
const { getAdminMenuKeyboard } = require('./admin/adminKeyboards');
const { handleXuiCallback, handleXuiAdminMessage, getAdminState, clearAdminState } = require('./admin/xuiAdminCallbacks');
const { checkMembership, getForceJoinKeyboard, getForceJoinMessage, isForceJoinEnabled } = require('./middleware/forceJoin');
const { logUserAction } = require('./middleware/userLogger');
const { startUsageAlertScheduler } = require('./middleware/usageAlert');
const { startDailyStatsScheduler } = require('./middleware/dailyStats');
const { startKeyCleanupScheduler } = require('./middleware/keyCleanup');
const { recordReferral, findReferrerByCode } = require('./vpn/referralManager');
const { getAllPendingOrders, approveOrder, rejectOrder, getOrderById, updateOrderScreenshot } = require('./vpn/premiumManager');
const { hasUsedTrial, getTrialInfo } = require('./vpn/trialManager');

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

// Start schedulers
startUsageAlertScheduler(bot);
startDailyStatsScheduler(bot);
startKeyCleanupScheduler(bot);

// Admin state for order management
const adminOrderState = new Map();

// ─── Helper: Check force join ────────────────────────────────
async function enforceJoin(msg) {
  if (!isForceJoinEnabled()) return true;
  if (isAdmin(msg.from.id)) return true;

  const isMember = await checkMembership(bot, msg.from.id);
  if (!isMember) {
    bot.sendMessage(msg.chat.id, getForceJoinMessage(), {
      parse_mode: 'Markdown',
      reply_markup: getForceJoinKeyboard(),
    });
    return false;
  }
  return true;
}

async function enforceJoinCallback(query) {
  if (!isForceJoinEnabled()) return true;
  if (isAdmin(query.from.id)) return true;

  const isMember = await checkMembership(bot, query.from.id);
  if (!isMember) {
    bot.answerCallbackQuery(query.id, {
      text: '⚠️ Channel join ပေးပါ!',
      show_alert: true,
    });
    bot.editMessageText(getForceJoinMessage(), {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: getForceJoinKeyboard(),
    });
    return false;
  }
  return true;
}

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

  await bot.sendMessage(msg.chat.id, `📢 Broadcasting to ${userIds.length} users...`);

  for (const uid of userIds) {
    try {
      await bot.sendMessage(uid, `📢 Broadcast\n\n${text}`);
      sent++;
      if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1000));
    } catch {
      failed++;
    }
  }

  await bot.sendMessage(msg.chat.id, `📢 Broadcast complete!\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
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

// ─── Admin: Order Management ─────────────────────────────────
bot.onText(/\/orders/, (msg) => {
  if (!requireAdmin(bot, msg)) return;
  const pending = getAllPendingOrders();

  if (pending.length === 0) {
    bot.sendMessage(msg.chat.id, '📋 *Pending Orders*\n\nPending order မရှိပါ။', { parse_mode: 'Markdown' });
    return;
  }

  let text = `📋 *Pending Orders (${pending.length})*\n\n`;
  const buttons = [];
  for (const o of pending) {
    text += `⏳ \`${o.orderId}\`\n` +
      `   User: \`${o.userId}\` | ${o.planName} | ${o.price} Ks\n\n`;
    buttons.push([
      { text: `✅ Approve ${o.orderId}`, callback_data: `order_approve_${o.orderId}` },
      { text: `❌ Reject ${o.orderId}`, callback_data: `order_reject_${o.orderId}` },
    ]);
  }
  buttons.push([{ text: '« Admin Menu', callback_data: 'admin_menu' }]);

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
});

// ─── Admin: Trial Reset ──────────────────────────────────────
bot.onText(/\/trialreset (\d+)/, async (msg, match) => {
  if (!requireAdmin(bot, msg)) return;

  const targetUserId = match[1];
  const { resetTrial } = require('./vpn/trialManager');

  if (resetTrial(targetUserId)) {
    await bot.sendMessage(msg.chat.id, `✅ User ${targetUserId} ၏ trial reset ပြီးပါပြီ။`);
    try {
      await bot.sendMessage(targetUserId,
        `🎉 Trial Key ပြန်လည်ရယူနိုင်ပါပြီ!\n\nAdmin မှ trial reset လုပ်ပေးထားပါတယ်။ 🎁 Trial Key ကို ပြန်ထုတ်ယူနိုင်ပါပြီ။`
      );
      await bot.sendMessage(msg.chat.id, `📨 User ${targetUserId} ကို notify ပို့ပြီးပါပြီ။`);
    } catch {
      await bot.sendMessage(msg.chat.id, `⚠️ User ${targetUserId} ကို notify ပို့လို့ မရပါ။`);
    }
  } else {
    await bot.sendMessage(msg.chat.id, `ℹ️ User ${targetUserId} trial data မရှိပါ။`);
  }
});

// ─── User Commands ───────────────────────────────────────────
bot.onText(/\/start(.*)/, async (msg, match) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;

  // Handle referral link
  const param = (match[1] || '').trim();
  if (param.startsWith('ref_')) {
    const referrerId = param.replace('ref_', '');
    if (referrerId !== String(msg.from.id)) {
      const recorded = recordReferral(referrerId, msg.from.id, msg.from.first_name || 'User');
      if (recorded) {
        logUserAction(bot, msg.from, '👥 Referred User Joined',
          `Referred by: \`${referrerId}\``
        );
        // Notify referrer
        try {
          const { getUserReferral, getReferralConfig } = require('./vpn/referralManager');
          const ref = getUserReferral(referrerId);
          const config = getReferralConfig();
          await bot.sendMessage(referrerId,
            `👥 *New Referral!*\n\n` +
            `${msg.from.first_name || 'User'} သင့် link ကနေ join ပါတယ်!\n` +
            `📊 Total: ${ref.invitedUsers.length}/${config.requiredInvites}\n\n` +
            (ref.invitedUsers.length >= config.requiredInvites
              ? `🎁 Bonus key ယူလို့ရပါပြီ! /menu > Referral ကို နှိပ်ပါ!`
              : `${config.requiredInvites - ref.invitedUsers.length} ယောက် ထပ်လိုပါသေးတယ်!`),
            { parse_mode: 'Markdown' }
          );
        } catch {}
      }
    }
  }

  logUserAction(bot, msg.from, '🟢 Bot Started', 'User opened the bot');
  handleCommand(bot, msg, 'start');
});

bot.onText(/\/help/, async (msg) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;
  handleCommand(bot, msg, 'help');
});

bot.onText(/\/menu/, async (msg) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;
  handleCommand(bot, msg, 'menu');
});

bot.onText(/\/trial/, async (msg) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;

  const { getTrialConfig } = require('./vpn/trialManager');

  if (hasUsedTrial(msg.from.id)) {
    bot.sendMessage(msg.chat.id,
      '🎁 *Trial Key*\n\n❌ Trial key ကို တစ်ကြိမ်သာ ထုတ်ခွင့်ရှိပါတယ်။\nသင် trial key ယူပြီးပါပြီ။',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const config = getTrialConfig();
  bot.sendMessage(msg.chat.id,
    `🎁 *Trial Key*\n\n` +
    `Free trial key ထုတ်ယူနိုင်ပါတယ်!\n\n` +
    `📦 Data: *${config.totalGB} GB*\n` +
    `📅 Expiry: *${config.expiryDays} Days*\n` +
    `📱 Device Limit: *${config.ipLimit}*\n` +
    `🔐 Encryption: *aes-256-gcm*\n\n` +
    `⚠️ တစ်ယောက်ကို *${config.maxTrials} ကြိမ်* သာ ထုတ်ခွင့်ရှိပါတယ်။`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Trial Key ထုတ်ယူမယ်', callback_data: 'trial_claim' }],
          [{ text: '« Back', callback_data: 'back_to_menu' }],
        ],
      },
    }
  );
});

bot.onText(/\/mykey/, async (msg) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;
  handleCallback(bot, {
    id: 'cmd',
    from: msg.from,
    message: { chat: msg.chat, message_id: msg.message_id },
    data: 'menu_mykey',
  });
});

bot.onText(/\/account/, async (msg) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;
  handleCallback(bot, {
    id: 'cmd',
    from: msg.from,
    message: { chat: msg.chat, message_id: msg.message_id },
    data: 'my_account',
  });
});

bot.onText(/\/id/, async (msg) => {
  if (isBanned(msg.from.id)) return;
  if (!await enforceJoin(msg)) return;

  const userId = String(msg.from.id);
  const { getTrialInfo } = require('./vpn/trialManager');
  const { getUserPremiumKeys } = require('./vpn/premiumManager');
  const { getUserReferral } = require('./vpn/referralManager');
  const xuiClient = require('./vpn/xuiClient');

  const user = getUser(userId);
  const trial = getTrialInfo(userId);
  const premium = getUserPremiumKeys(userId);
  const ref = getUserReferral(userId);

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const userName = escHtml(msg.from.first_name || 'User');
  const username = msg.from.username ? `@${escHtml(msg.from.username)}` : 'N/A';

  let text =
    `📋 <b>My Information</b>\n\n` +
    `<b>Name:</b> ${userName}\n` +
    `<b>Username:</b> ${username}\n` +
    `<b>User ID:</b> <code>${userId}</code>\n` +
    `<b>Joined:</b> ${user ? new Date(user.joinedAt).toLocaleDateString('en-GB') : 'N/A'}\n` +
    `<b>Last Active:</b> ${user ? new Date(user.lastActive).toLocaleDateString('en-GB') : 'N/A'}\n\n`;

  text += `🎁 <b>Trial Key:</b> ${trial && trial.count > 0 ? `ယူပြီး (${trial.count})` : 'မယူရသေးပါ'}\n`;
  text += `💎 <b>Premium Keys:</b> ${premium.length} ခု\n`;
  text += `👥 <b>Referrals:</b> ${ref.invitedUsers.length} ယောက် invited\n\n`;

  const allKeys = [];
  if (trial && trial.keys) allKeys.push(...trial.keys.map(k => ({ ...k, type: 'Trial' })));
  allKeys.push(...premium.map(k => ({ ...k, type: 'Premium' })));

  if (allKeys.length > 0) {
    try {
      const clients = await xuiClient.getAllClients();
      text += `<b>🔑 Keys:</b>\n`;
      for (const key of allKeys) {
        const client = clients.find(c => c.email === key.email);
        if (client) {
          const usedGB = ((client.up + client.down) / 1024 / 1024 / 1024).toFixed(2);
          const totalGB = client.total > 0 ? (client.total / 1024 / 1024 / 1024).toFixed(0) : '∞';
          const expiry = client.expiryTime > 0 ? new Date(client.expiryTime).toLocaleDateString('en-GB') : '∞';
          const now = Date.now();
          const isExpired = client.expiryTime > 0 && client.expiryTime < now;
          const status = !client.enable ? '🔴 Disabled' : isExpired ? '🔴 Expired' : '🟢 Active';
          const daysLeft = client.expiryTime > 0 ? Math.max(0, Math.ceil((client.expiryTime - now) / 86400000)) : '∞';

          text += `\n${status} <b>${key.type}</b>\n`;
          text += `  📊 Data: ${usedGB} / ${totalGB} GB\n`;
          text += `  📅 Expiry: ${expiry} (${daysLeft} days left)\n`;
          text += `  🔗 <code>${key.link}</code>\n`;
        }
      }
    } catch {
      text += `\n<i>Key data ယူ၍မရပါ</i>\n`;
    }
  } else {
    text += `<i>Key မရှိသေးပါ</i>`;
  }

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

bot.onText(/\/cancel/, (msg) => {
  clearBroadcast(msg.from.id);
  clearAdminState(msg.from.id);
  adminOrderState.delete(String(msg.from.id));
  bot.sendMessage(msg.chat.id, 'Cancelled.', { reply_markup: getMainMenuKeyboard() });
});

// ─── Callback Query Handler ─────────────────────────────────
bot.on('callback_query', async (query) => {
  if (isBanned(query.from.id)) {
    bot.answerCallbackQuery(query.id, { text: '⛔ You are banned' });
    return;
  }

  registerUser(query.from);

  // Check join callback
  if (query.data === 'check_join') {
    const isMember = await checkMembership(bot, query.from.id);
    if (isMember) {
      bot.answerCallbackQuery(query.id, { text: '✅ Join ပြီးပါပြီ!' });
      bot.editMessageText(
        `🔐 *VPN Key Bot*\n\n` +
        `Channel join ပြီးပါပြီ! အောက်က menu ကနေ ရွေးချယ်ပါ 👇`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: getMainMenuKeyboard(),
        }
      );
      logUserAction(bot, query.from, '📢 Channel Joined', 'User joined the required channel');
      return;
    }
    bot.answerCallbackQuery(query.id, {
      text: '❌ Channel ကို join ပေးပါ!',
      show_alert: true,
    });
    return;
  }

  // Admin order callbacks
  if (query.data.startsWith('order_approve_')) {
    if (!isAdmin(query.from.id)) return;
    const orderId = query.data.replace('order_approve_', '');

    bot.answerCallbackQuery(query.id, { text: '⏳ Approving...' });
    const result = await approveOrder(orderId);

    if (result.success) {
      bot.editMessageText(
        `✅ *Order Approved!*\n\n` +
        `📋 Order: \`${orderId}\`\n` +
        `👤 User: \`${result.userId}\`\n` +
        `📦 Plan: ${result.order.planName}\n\n` +
        `Key auto-created ပြီး user ထံ ပို့ပေးပါပြီ။`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
        }
      );

      // Notify user
      try {
        await bot.sendMessage(result.userId,
          `✅ *Order Approved!*\n\n` +
          `📋 Order: \`${orderId}\`\n` +
          `📦 Plan: *${result.order.planName}* (${result.order.dataGB}GB/${result.order.days}Days)\n\n` +
          `🔗 *Config Link:*\n\`${result.link}\`\n\n` +
          `_Link ကို copy ပြီး VPN app ထဲ import လုပ်ပါ။_`,
          { parse_mode: 'Markdown' }
        );
      } catch {}

      logUserAction(bot, query.from, '✅ Order Approved',
        `📋 Order: \`${orderId}\`\nUser: \`${result.userId}\``
      );
    } else {
      bot.editMessageText(`❌ Approve failed: ${result.msg}`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      });
    }
    return;
  }

  if (query.data.startsWith('order_reject_')) {
    if (!isAdmin(query.from.id)) return;
    const orderId = query.data.replace('order_reject_', '');
    const result = rejectOrder(orderId);

    if (result.success) {
      bot.answerCallbackQuery(query.id, { text: '❌ Rejected' });
      bot.editMessageText(
        `❌ *Order Rejected*\n\n📋 Order: \`${orderId}\``,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
        }
      );

      // Notify user
      try {
        await bot.sendMessage(result.userId,
          `❌ *Order Rejected*\n\n` +
          `📋 Order: \`${orderId}\`\n\n` +
          `Admin ထံ ဆက်သွယ်ပြီး မေးမြန်းနိုင်ပါတယ်။`,
          { parse_mode: 'Markdown' }
        );
      } catch {}
    }
    return;
  }

  // Force join check for non-admin callbacks
  if (!query.data.startsWith('xui_') && !query.data.startsWith('admin_') && !query.data.startsWith('admsrv')) {
    if (!await enforceJoinCallback(query)) return;
  }

  // Check if it's an X-UI callback
  if (query.data.startsWith('xui_')) {
    return handleXuiCallback(bot, query);
  }

  // Check if it's an admin callback
  if (query.data.startsWith('admin_') || query.data.startsWith('admsrv') || query.data.startsWith('extend_days_') || query.data.startsWith('extend_gb_')) {
    return handleAdminCallback(bot, query);
  }

  return handleCallback(bot, query);
});

// ─── Photo handler for payment screenshots ───────────────────
bot.on('photo', async (msg) => {
  if (!msg.caption || isBanned(msg.from.id)) return;

  // Check if caption contains order ID
  const orderMatch = msg.caption.match(/ORD\d+/);
  if (!orderMatch) return;

  const orderId = orderMatch[0];
  const order = getOrderById(orderId);
  if (!order || order.userId !== String(msg.from.id)) {
    bot.sendMessage(msg.chat.id, '❌ Order ID မမှန်ပါ။');
    return;
  }
  if (order.status !== 'pending') {
    bot.sendMessage(msg.chat.id, `ℹ️ Order \`${orderId}\` ${order.status} ဖြစ်ပြီးပါပြီ။`, { parse_mode: 'Markdown' });
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  updateOrderScreenshot(String(msg.from.id), orderId, fileId);

  bot.sendMessage(msg.chat.id,
    `✅ *Screenshot ရရှိပါပြီ!*\n\n` +
    `📋 Order: \`${orderId}\`\n` +
    `Admin approve လုပ်ပေးပါမယ်။ ခဏစောင့်ပါ။`,
    { parse_mode: 'Markdown' }
  );

  // Notify admin
  const adminIds = (process.env.ADMIN_IDS || '').split(',');
  for (const adminId of adminIds) {
    try {
      await bot.sendPhoto(adminId.trim(), fileId, {
        caption: `💰 *Payment Screenshot*\n\n` +
          `📋 Order: \`${orderId}\`\n` +
          `👤 User: \`${order.userId}\`\n` +
          `📦 Plan: ${order.planName} | ${order.price} Ks`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `order_approve_${orderId}` },
              { text: '❌ Reject', callback_data: `order_reject_${orderId}` },
            ],
          ],
        },
      });
    } catch {}
  }

  logUserAction(bot, msg.from, '💰 Payment Screenshot Sent',
    `📋 Order: \`${orderId}\`\n📦 Plan: ${order.planName} | ${order.price} Ks`
  );
});

// ─── Admin message handler (broadcast + XUI) ────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  if (!isAdmin(msg.from.id)) return;

  // Key extend: admin sends client email
  if (isExtendingKey(msg.from.id)) {
    clearKeyExtend(msg.from.id);
    const email = msg.text.trim();

    const xuiClient = require('./vpn/xuiClient');
    try {
      const clients = await xuiClient.getAllClients();
      const client = clients.find((c) => c.email === email);

      if (!client) {
        await bot.sendMessage(msg.chat.id, `❌ Client "${email}" မတွေ့ပါ။`);
        return;
      }

      const usedGB = ((client.up + client.down) / 1024 / 1024 / 1024).toFixed(2);
      const totalGB = client.total > 0 ? (client.total / 1024 / 1024 / 1024).toFixed(0) : 'Unlimited';
      const expiry = client.expiryTime > 0
        ? new Date(client.expiryTime).toLocaleDateString('en-GB')
        : 'Unlimited';

      await bot.sendMessage(msg.chat.id,
        `🔑 Client Found!\n\n` +
        `Email: ${email}\n` +
        `📦 Data: ${usedGB} GB / ${totalGB} GB\n` +
        `📅 Expiry: ${expiry}\n\n` +
        `Action ရွေးပါ:`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📅 +7 Days', callback_data: `extend_days_7_${email}` },
                { text: '📅 +14 Days', callback_data: `extend_days_14_${email}` },
                { text: '📅 +30 Days', callback_data: `extend_days_30_${email}` },
              ],
              [
                { text: '📦 +50 GB', callback_data: `extend_gb_50_${email}` },
                { text: '📦 +100 GB', callback_data: `extend_gb_100_${email}` },
                { text: '📦 +200 GB', callback_data: `extend_gb_200_${email}` },
              ],
              [{ text: '« Admin Menu', callback_data: 'admin_menu' }],
            ],
          },
        }
      );
    } catch (err) {
      await bot.sendMessage(msg.chat.id, `❌ Error: ${err.message}`);
    }
    return;
  }

  // Trial reset: admin sends user ID
  if (isResettingTrial(msg.from.id)) {
    clearTrialReset(msg.from.id);
    const targetId = msg.text.trim();

    if (!/^\d+$/.test(targetId)) {
      await bot.sendMessage(msg.chat.id, '❌ User ID သည် ဂဏန်းဖြစ်ရပါမယ်။');
      return;
    }

    const { resetTrial } = require('./vpn/trialManager');
    if (resetTrial(targetId)) {
      await bot.sendMessage(msg.chat.id, `✅ User ${targetId} ၏ trial reset ပြီးပါပြီ။`);
      try {
        await bot.sendMessage(targetId,
          `🎉 Trial Key ပြန်လည်ရယူနိုင်ပါပြီ!\n\nAdmin မှ trial reset လုပ်ပေးထားပါတယ်။ 🎁 Trial Key ကို ပြန်ထုတ်ယူနိုင်ပါပြီ။`
        );
        await bot.sendMessage(msg.chat.id, `📨 User ${targetId} ကို notify ပို့ပြီးပါပြီ။`);
      } catch {
        await bot.sendMessage(msg.chat.id, `⚠️ User ${targetId} ကို notify ပို့လို့ မရပါ။`);
      }
    } else {
      await bot.sendMessage(msg.chat.id, `ℹ️ User ${targetId} trial data မရှိပါ။`);
    }
    return;
  }

  // Broadcast takes priority
  if (isBroadcasting(msg.from.id)) {
    clearBroadcast(msg.from.id);

    const users = getAllUsers();
    const userIds = Object.keys(users);
    let sent = 0;
    let failed = 0;
    const failedIds = [];

    await bot.sendMessage(msg.chat.id, `📢 Broadcasting to ${userIds.length} users...`);

    for (const uid of userIds) {
      try {
        if (msg.photo) {
          const photoId = msg.photo[msg.photo.length - 1].file_id;
          await bot.sendPhoto(uid, photoId, { caption: msg.caption || '' });
        } else {
          await bot.sendMessage(uid, `📢 Broadcast\n\n${msg.text}`);
        }
        sent++;
        // Rate limit: 30 msgs/sec max for Telegram API
        if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        failed++;
        failedIds.push(uid);
        console.error(`Broadcast failed for ${uid}: ${err.message}`);
      }
    }

    await bot.sendMessage(msg.chat.id,
      `📢 Broadcast Complete!\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}` +
      (failedIds.length > 0 ? `\n\nFailed IDs: ${failedIds.slice(0, 10).join(', ')}${failedIds.length > 10 ? '...' : ''}` : '')
    );
    return;
  }

  // XUI admin message handling
  const handled = await handleXuiAdminMessage(bot, msg);
  if (handled) return;
});

// ─── General Message Handler ─────────────────────────────────
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  if (isBanned(msg.from.id)) return;
  if (isAdmin(msg.from.id) && (isBroadcasting(msg.from.id) || isResettingTrial(msg.from.id) || isExtendingKey(msg.from.id) || getAdminState(msg.from.id))) return;

  bot.sendMessage(msg.chat.id,
    'Menu ကို အသုံးပြုပါ:',
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
