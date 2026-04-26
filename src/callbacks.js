const { getMainMenuKeyboard, getBackKeyboard } = require('./keyboards');
const { hasUsedTrial, createTrialKey, getTrialConfig, getTrialInfo } = require('./vpn/trialManager');
const xuiClient = require('./vpn/xuiClient');
const { getUser } = require('./admin/userManager');
const { logUserAction } = require('./middleware/userLogger');

async function handleCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = String(query.from.id);
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  // ─── Main Menu ─────────────────────────────────────────────
  if (data === 'back_to_menu') {
    return bot.editMessageText('🔐 *VPN Key Bot*\n\nရွေးချယ်ပါ:', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard(),
    });
  }

  // ─── Trial Key ─────────────────────────────────────────────
  if (data === 'trial_key') {
    if (hasUsedTrial(userId)) {
      return bot.editMessageText(
        '🎁 *Trial Key*\n\n' +
        '❌ Trial key ကို တစ်ကြိမ်သာ ထုတ်ခွင့်ရှိပါတယ်။\n' +
        'သင် trial key ယူပြီးပါပြီ။\n\n' +
        '📦 My Key မှာ ပြန်ကြည့်နိုင်ပါတယ်။',
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📦 My Key ကြည့်မယ်', callback_data: 'menu_mykey' }],
              [{ text: '« Back', callback_data: 'back_to_menu' }],
            ],
          },
        }
      );
    }

    const config = getTrialConfig();
    return bot.editMessageText(
      `🎁 *Trial Key*\n\n` +
      `Free trial key ထုတ်ယူနိုင်ပါတယ်!\n\n` +
      `📦 Data: *${config.totalGB} GB*\n` +
      `📅 Expiry: *${config.expiryDays} Days*\n` +
      `📱 Device Limit: *${config.ipLimit}*\n` +
      `🔐 Encryption: *aes-256-gcm*\n\n` +
      `⚠️ တစ်ယောက်ကို *${config.maxTrials} ကြိမ်* သာ ထုတ်ခွင့်ရှိပါတယ်။`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Trial Key ထုတ်ယူမယ်', callback_data: 'trial_claim' }],
            [{ text: '« Back', callback_data: 'back_to_menu' }],
          ],
        },
      }
    );
  }

  if (data === 'trial_claim') {
    if (hasUsedTrial(userId)) {
      return bot.editMessageText(
        '❌ Trial key ကို တစ်ကြိမ်သာ ထုတ်ခွင့်ရှိပါတယ်။',
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: getBackKeyboard(),
        }
      );
    }

    bot.editMessageText('⏳ Trial key ထုတ်ပေးနေပါတယ်...', {
      chat_id: chatId, message_id: messageId,
    });

    const result = await createTrialKey(userId, query.from.username || query.from.first_name);

    if (!result.success) {
      return bot.editMessageText(`❌ ${result.msg}`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    const d = result.data;
    const expiryDate = new Date(d.expiryDate).toLocaleDateString('en-GB');

    // Log to admin channel
    logUserAction(bot, query.from, '🎁 Trial Key Claimed',
      `📦 Data: ${d.dataGB} GB\n` +
      `📅 Expiry: ${expiryDate}\n` +
      `📱 Device: ${d.ipLimit}\n` +
      `🔗 Email: \`${d.email}\``
    );

    return bot.editMessageText(
      `🎁 *Trial Key ရရှိပါပြီ!*\n\n` +
      `📅 Expiry: *${expiryDate}*\n` +
      `📦 Data: *${d.dataGB} GB*\n` +
      `📱 Device: *${d.ipLimit}*\n\n` +
      `🔗 *Config Link:*\n\`${d.link}\`\n\n` +
      `_Link ကို copy ပြီး VPN app ထဲ import လုပ်ပါ။_`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getBackKeyboard(),
      }
    );
  }

  // ─── My Key ────────────────────────────────────────────────
  if (data === 'menu_mykey') {
    logUserAction(bot, query.from, '📦 Viewed My Key');
    const trialInfo = getTrialInfo(userId);

    if (!trialInfo || trialInfo.keys.length === 0) {
      return bot.editMessageText(
        '📦 *My Key*\n\n' +
        'Key မရှိသေးပါ။ Trial Key ထုတ်ယူပါ။',
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 Trial Key ထုတ်ယူမယ်', callback_data: 'trial_key' }],
              [{ text: '« Back', callback_data: 'back_to_menu' }],
            ],
          },
        }
      );
    }

    // Get live data from X-UI
    let liveText = '';
    try {
      const clients = await xuiClient.getAllClients();
      for (const key of trialInfo.keys) {
        const client = clients.find((c) => c.email === key.email);
        if (client) {
          const upGB = (client.up / 1024 / 1024 / 1024).toFixed(2);
          const downGB = (client.down / 1024 / 1024 / 1024).toFixed(2);
          const totalGB = (client.total / 1024 / 1024 / 1024).toFixed(0);
          const usedGB = ((client.up + client.down) / 1024 / 1024 / 1024).toFixed(2);
          const expiry = client.expiryTime > 0
            ? new Date(client.expiryTime).toLocaleDateString('en-GB')
            : 'Unlimited';
          const now = Date.now();
          const isExpired = client.expiryTime > 0 && client.expiryTime < now;
          const status = !client.enable ? '🔴 Disabled' : isExpired ? '🔴 Expired' : '🟢 Active';

          liveText +=
            `*Status:* ${status}\n` +
            `📅 *Expiry:* ${expiry}\n` +
            `📊 *Used:* ${usedGB} GB / ${totalGB} GB\n` +
            `   ⬆️ Upload: ${upGB} GB\n` +
            `   ⬇️ Download: ${downGB} GB\n`;
        }
      }
    } catch {
      liveText = '_Data ယူ၍မရပါ_\n';
    }

    const lastKey = trialInfo.keys[trialInfo.keys.length - 1];
    const text =
      `📦 *My Key*\n\n` +
      liveText +
      `\n🔗 *Config Link:*\n\`${lastKey.link}\`\n\n` +
      `_Link ကို copy ပြီး VPN app ထဲ import လုပ်ပါ။_`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getBackKeyboard(),
    });
  }

  // ─── My Account ────────────────────────────────────────────
  if (data === 'my_account') {
    const user = getUser(userId);
    const trialInfo = getTrialInfo(userId);
    const hasTrial = trialInfo && trialInfo.count > 0;

    const userName = query.from.first_name || 'User';
    const username = query.from.username ? `@${query.from.username}` : 'N/A';

    let text =
      `👤 *My Account*\n\n` +
      `*Name:* ${userName}\n` +
      `*Username:* ${username}\n` +
      `*ID:* \`${userId}\`\n` +
      `*Joined:* ${user ? new Date(user.joinedAt).toLocaleDateString('en-GB') : 'N/A'}\n\n`;

    if (hasTrial) {
      text += `🎁 *Trial Key:* ယူပြီး (${trialInfo.count}/${getTrialConfig().maxTrials})\n`;

      // Get live usage from X-UI
      try {
        const clients = await xuiClient.getAllClients();
        const lastKey = trialInfo.keys[trialInfo.keys.length - 1];
        const client = clients.find((c) => c.email === lastKey.email);

        if (client) {
          const usedGB = ((client.up + client.down) / 1024 / 1024 / 1024).toFixed(2);
          const totalGB = (client.total / 1024 / 1024 / 1024).toFixed(0);
          const expiry = client.expiryTime > 0
            ? new Date(client.expiryTime).toLocaleDateString('en-GB')
            : 'Unlimited';
          const now = Date.now();
          const isExpired = client.expiryTime > 0 && client.expiryTime < now;
          const daysLeft = client.expiryTime > 0
            ? Math.max(0, Math.ceil((client.expiryTime - now) / (1000 * 60 * 60 * 24)))
            : '∞';
          const status = !client.enable ? '🔴 Disabled' : isExpired ? '🔴 Expired' : '🟢 Active';

          text +=
            `\n📊 *Key Status:* ${status}\n` +
            `📅 *Expiry:* ${expiry} (${daysLeft} days left)\n` +
            `📦 *Data Used:* ${usedGB} GB / ${totalGB} GB\n`;
        }
      } catch {
        text += `\n_Usage data ယူ၍မရပါ_\n`;
      }
    } else {
      text += `🎁 *Trial Key:* မယူရသေးပါ\n`;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getBackKeyboard(),
    });
  }

  // ─── Contact Admin ─────────────────────────────────────────
  if (data === 'contact_admin') {
    const adminContact = process.env.ADMIN_CONTACT || 'https://t.me/JackFrozt_2k4';

    const text =
      `📞 *Admin ဆက်သွယ်ရန်*\n\n` +
      `အကူအညီလိုအပ်ပါက Admin ထံ ဆက်သွယ်ပါ။\n\n` +
      `*ဆက်သွယ်နိုင်တဲ့ အကြောင်းအရာများ:*\n` +
      `• Key သက်တမ်းတိုးခြင်း\n` +
      `• Premium key ဝယ်ယူခြင်း\n` +
      `• ချိတ်ဆက်မှု ပြဿနာများ\n` +
      `• အခြား အကူအညီများ`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Admin ထံ ဆက်သွယ်မယ်', url: adminContact }],
          [{ text: '« Back to Menu', callback_data: 'back_to_menu' }],
        ],
      },
    });
  }
}

module.exports = { handleCallback };
