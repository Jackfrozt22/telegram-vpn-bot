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

  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });

  const text =
    `📋 <b>User Activity Log</b>\n\n` +
    `👤 <b>Name:</b> ${fullName}\n` +
    `🔗 <b>Username:</b> ${username}\n` +
    `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
    `📅 <b>Time:</b> ${now} (MMT)\n\n` +
    `📌 <b>Action:</b> ${escapeHtml(action)}\n` +
    (details ? `\n📝 <b>Details:</b>\n${escapeHtml(details)}` : '');

  try {
    await bot.sendMessage(LOG_CHANNEL, text, { parse_mode: 'HTML' });
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
