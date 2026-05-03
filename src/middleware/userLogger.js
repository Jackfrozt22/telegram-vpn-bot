const LOG_CHANNEL = process.env.USER_LOG_CHANNEL || '';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function logUserAction(bot, user, action, details = '') {
  if (!LOG_CHANNEL) return;

  const userId = user.id || user;
  const firstName = escapeHtml(user.first_name || '');
  const lastName = escapeHtml(user.last_name || '');
  const username = user.username ? `@${escapeHtml(user.username)}` : 'N/A';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  const langCode = user.language_code || 'N/A';

  const now = new Date();
  const timeStr = now.toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });
  const dateStr = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Yangon' });
  const timeOnly = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Yangon', hour12: true });

  // Action type icon
  let actionIcon = '📌';
  if (action.includes('Trial')) actionIcon = '🎁';
  else if (action.includes('Premium') || action.includes('Order')) actionIcon = '💎';
  else if (action.includes('Referral')) actionIcon = '👥';
  else if (action.includes('Key')) actionIcon = '🔑';
  else if (action.includes('Start')) actionIcon = '🚀';
  else if (action.includes('Account')) actionIcon = '👤';

  const userLink = user.username
    ? `<a href="https://t.me/${escapeHtml(user.username)}">${fullName}</a>`
    : fullName;

  const text =
    `📋 <b>User Log</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 ${userLink}\n` +
    `🔗 ${username} | <code>${userId}</code>\n` +
    `🌐 Lang: ${langCode}\n` +
    `📅 ${dateStr} | 🕐 ${timeOnly} MMT\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${actionIcon} <b>${escapeHtml(action)}</b>\n` +
    (details ? `\n📝 ${escapeHtml(details)}` : '');

  try {
    await bot.sendMessage(LOG_CHANNEL, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    console.error('Failed to send user log:', err.message);
  }
}

function isLoggingEnabled() {
  return !!LOG_CHANNEL;
}

module.exports = {
  logUserAction,
  isLoggingEnabled,
};
