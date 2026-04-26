const { getMainMenuKeyboard, getBackKeyboard } = require('./keyboards');
const { hasUsedTrial, createTrialKey, getTrialConfig, getTrialInfo } = require('./vpn/trialManager');
const { getPlans, createOrder, getUserPremiumKeys } = require('./vpn/premiumManager');
const { getUserReferral, getReferralCode, canClaimBonus, claimReferralBonus, getReferralConfig } = require('./vpn/referralManager');
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

  // ─── Premium Key Menu ──────────────────────────────────────
  if (data === 'premium_menu') {
    const plans = getPlans();
    let text = `💎 *Premium Key*\n\n` +
      `Premium plan ရွေးချယ်ပါ:\n\n`;

    const buttons = plans.map((p) => [
      {
        text: `${p.name} — ${p.dataGB}GB | ${p.days}Days | ${p.price} Ks`,
        callback_data: `premium_select_${p.id}`,
      },
    ]);
    buttons.push([{ text: '📋 My Orders', callback_data: 'premium_orders' }]);
    buttons.push([{ text: '« Back', callback_data: 'back_to_menu' }]);

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // ─── Premium Plan Select ──────────────────────────────────
  if (data.startsWith('premium_select_')) {
    const planId = data.replace('premium_select_', '');
    const plans = getPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return bot.editMessageText('❌ Plan မတွေ့ပါ။', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    return bot.editMessageText(
      `💎 *${plan.name}*\n\n` +
      `📦 Data: *${plan.dataGB} GB*\n` +
      `📅 Duration: *${plan.days} Days*\n` +
      `📱 Devices: *${plan.ipLimit}*\n` +
      `💰 Price: *${plan.price} Ks*\n\n` +
      `ဝယ်ယူမယ်ဆိုရင် *"ဝယ်ယူမယ်"* ကို နှိပ်ပါ။\n` +
      `Payment screenshot ပို့ပေးရပါမယ်။`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 ဝယ်ယူမယ်', callback_data: `premium_buy_${planId}` }],
            [{ text: '« Plans', callback_data: 'premium_menu' }],
          ],
        },
      }
    );
  }

  // ─── Premium Buy (Create Order) ───────────────────────────
  if (data.startsWith('premium_buy_')) {
    const planId = data.replace('premium_buy_', '');
    const order = createOrder(userId, planId);
    if (!order) {
      return bot.editMessageText('❌ Plan မတွေ့ပါ။', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    logUserAction(bot, query.from, '💎 Premium Order Created',
      `📋 Order: \`${order.orderId}\`\n` +
      `📦 Plan: ${order.planName} (${order.dataGB}GB/${order.days}Days)\n` +
      `💰 Price: ${order.price} Ks`
    );

    return bot.editMessageText(
      `💎 *Order Created!*\n\n` +
      `📋 Order ID: \`${order.orderId}\`\n` +
      `📦 Plan: *${order.planName}* (${order.dataGB}GB/${order.days}Days)\n` +
      `💰 Price: *${order.price} Ks*\n\n` +
      `*ငွေလွှဲနည်း:*\n` +
      `Admin ထံ ငွေလွှဲပြီး screenshot ကို\n` +
      `ဒီ bot ထဲ ပို့ပေးပါ။\n\n` +
      `Screenshot ပို့ရင် Order ID ပါ ရေးပေးပါ:\n` +
      `\`${order.orderId}\`\n\n` +
      `_Admin approve လုပ်ပြီးရင် key auto ထုတ်ပေးပါမယ်။_`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📞 Admin ထံ ဆက်သွယ်မယ်', url: process.env.ADMIN_CONTACT || 'https://t.me/JackFrozt_2k4' }],
            [{ text: '« Back to Menu', callback_data: 'back_to_menu' }],
          ],
        },
      }
    );
  }

  // ─── Premium Orders ───────────────────────────────────────
  if (data === 'premium_orders') {
    const { getUserOrders } = require('./vpn/premiumManager');
    const orders = getUserOrders(userId);

    if (orders.length === 0) {
      return bot.editMessageText(
        '📋 *My Orders*\n\nOrder မရှိသေးပါ။',
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💎 Premium Key ဝယ်မယ်', callback_data: 'premium_menu' }],
              [{ text: '« Back', callback_data: 'back_to_menu' }],
            ],
          },
        }
      );
    }

    const statusEmoji = { pending: '⏳', approved: '✅', rejected: '❌' };
    let text = '📋 *My Orders*\n\n';
    for (const o of orders.slice(-5).reverse()) {
      text += `${statusEmoji[o.status] || '❓'} \`${o.orderId}\`\n` +
        `   ${o.planName} | ${o.price} Ks | ${o.status}\n\n`;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💎 Premium Key ဝယ်မယ်', callback_data: 'premium_menu' }],
          [{ text: '« Back', callback_data: 'back_to_menu' }],
        ],
      },
    });
  }

  // ─── Referral Menu ────────────────────────────────────────
  if (data === 'referral_menu') {
    const ref = getUserReferral(userId);
    const config = getReferralConfig();
    const botUsername = (await bot.getMe()).username;
    const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
    const inviteCount = ref.invitedUsers.length;
    const nextMilestone = (ref.bonusClaimed + 1) * config.requiredInvites;
    const remaining = Math.max(0, nextMilestone - inviteCount);

    let text =
      `👥 *Referral System*\n\n` +
      `သူငယ်ချင်း *${config.requiredInvites} ယောက်* invite လုပ်ရင်\n` +
      `🎁 Free *${config.bonusGB} GB* key ရမယ်!\n\n` +
      `📊 *Invite Count:* ${inviteCount} ယောက်\n` +
      `🎯 *Next Bonus:* ${remaining} ယောက် ထပ်လို\n` +
      `🏆 *Bonus Claimed:* ${ref.bonusClaimed} ကြိမ်\n\n` +
      `🔗 *Your Referral Link:*\n\`${refLink}\`\n\n` +
      `_Link ကို share ပြီး သူငယ်ချင်းတွေကို invite လုပ်ပါ!_`;

    const buttons = [];
    if (canClaimBonus(userId)) {
      buttons.push([{ text: '🎁 Bonus Key ယူမယ်', callback_data: 'referral_claim' }]);
    }
    buttons.push([{ text: '« Back', callback_data: 'back_to_menu' }]);

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  // ─── Referral Claim ───────────────────────────────────────
  if (data === 'referral_claim') {
    if (!canClaimBonus(userId)) {
      return bot.editMessageText(
        '❌ Invite လုံလောက်မှု မရှိသေးပါ။',
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: getBackKeyboard(),
        }
      );
    }

    bot.editMessageText('⏳ Bonus key ထုတ်ပေးနေပါတယ်...', {
      chat_id: chatId, message_id: messageId,
    });

    const result = await claimReferralBonus(userId);

    if (!result.success) {
      return bot.editMessageText(`❌ ${result.msg}`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    logUserAction(bot, query.from, '🎁 Referral Bonus Claimed',
      `📦 Data: ${result.bonusGB} GB\n` +
      `🔗 Email: \`${result.email}\``
    );

    return bot.editMessageText(
      `🎁 *Referral Bonus ရရှိပါပြီ!*\n\n` +
      `📦 Data: *${result.bonusGB} GB*\n` +
      `📅 Duration: *30 Days*\n\n` +
      `🔗 *Config Link:*\n\`${result.link}\`\n\n` +
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
    const premiumKeys = getUserPremiumKeys(userId);

    const hasKeys = (trialInfo && trialInfo.keys.length > 0) || premiumKeys.length > 0;

    if (!hasKeys) {
      return bot.editMessageText(
        '📦 *My Key*\n\n' +
        'Key မရှိသေးပါ။',
        {
          chat_id: chatId, message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 Trial Key ထုတ်ယူမယ်', callback_data: 'trial_key' }],
              [{ text: '💎 Premium Key ဝယ်မယ်', callback_data: 'premium_menu' }],
              [{ text: '« Back', callback_data: 'back_to_menu' }],
            ],
          },
        }
      );
    }

    let text = '📦 *My Keys*\n\n';
    let clients = [];
    try {
      clients = await xuiClient.getAllClients();
    } catch {}

    // Trial keys
    if (trialInfo && trialInfo.keys.length > 0) {
      text += '🎁 *Trial Key:*\n';
      for (const key of trialInfo.keys) {
        const client = clients.find((c) => c.email === key.email);
        if (client) {
          const usedGB = ((client.up + client.down) / 1024 / 1024 / 1024).toFixed(2);
          const totalGB = (client.total / 1024 / 1024 / 1024).toFixed(0);
          const expiry = client.expiryTime > 0
            ? new Date(client.expiryTime).toLocaleDateString('en-GB')
            : 'Unlimited';
          const now = Date.now();
          const isExpired = client.expiryTime > 0 && client.expiryTime < now;
          const status = !client.enable ? '🔴 Disabled' : isExpired ? '🔴 Expired' : '🟢 Active';

          text +=
            `  ${status} | 📊 ${usedGB}/${totalGB} GB | 📅 ${expiry}\n`;
        }
        text += `  🔗 \`${key.link}\`\n\n`;
      }
    }

    // Premium keys
    if (premiumKeys.length > 0) {
      text += '💎 *Premium Keys:*\n';
      for (const key of premiumKeys) {
        const client = clients.find((c) => c.email === key.email);
        if (client) {
          const usedGB = ((client.up + client.down) / 1024 / 1024 / 1024).toFixed(2);
          const totalGB = (client.total / 1024 / 1024 / 1024).toFixed(0);
          const expiry = client.expiryTime > 0
            ? new Date(client.expiryTime).toLocaleDateString('en-GB')
            : 'Unlimited';
          const now = Date.now();
          const isExpired = client.expiryTime > 0 && client.expiryTime < now;
          const status = !client.enable ? '🔴 Disabled' : isExpired ? '🔴 Expired' : '🟢 Active';

          text +=
            `  ${status} | ${key.planName} | 📊 ${usedGB}/${totalGB} GB | 📅 ${expiry}\n`;
        }
        text += `  🔗 \`${key.link}\`\n\n`;
      }
    }

    text += `_Link ကို copy ပြီး VPN app ထဲ import လုပ်ပါ။_`;

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
    const premiumKeys = getUserPremiumKeys(userId);
    const ref = getUserReferral(userId);

    const userName = query.from.first_name || 'User';
    const username = query.from.username ? `@${query.from.username}` : 'N/A';

    let text =
      `👤 *My Account*\n\n` +
      `*Name:* ${userName}\n` +
      `*Username:* ${username}\n` +
      `*ID:* \`${userId}\`\n` +
      `*Joined:* ${user ? new Date(user.joinedAt).toLocaleDateString('en-GB') : 'N/A'}\n\n`;

    // Trial status
    if (hasTrial) {
      text += `🎁 *Trial Key:* ယူပြီး (${trialInfo.count}/${getTrialConfig().maxTrials})\n`;
    } else {
      text += `🎁 *Trial Key:* မယူရသေးပါ\n`;
    }

    // Premium keys count
    text += `💎 *Premium Keys:* ${premiumKeys.length} ခု\n`;

    // Referral info
    text += `👥 *Referrals:* ${ref.invitedUsers.length} ယောက် invited\n`;

    // Live usage for latest key
    const allKeys = [];
    if (trialInfo && trialInfo.keys) allKeys.push(...trialInfo.keys);
    allKeys.push(...premiumKeys);

    if (allKeys.length > 0) {
      try {
        const clients = await xuiClient.getAllClients();
        const lastKey = allKeys[allKeys.length - 1];
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
            `\n📊 *Latest Key:* ${status}\n` +
            `📅 *Expiry:* ${expiry} (${daysLeft} days left)\n` +
            `📦 *Data Used:* ${usedGB} GB / ${totalGB} GB\n`;
        }
      } catch {
        text += `\n_Usage data ယူ၍မရပါ_\n`;
      }
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
