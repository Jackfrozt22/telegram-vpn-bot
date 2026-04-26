const LOG_CHANNEL = process.env.USER_LOG_CHANNEL || '';

async function logUserAction(bot, user, action, details = '') {
  if (!LOG_CHANNEL) return;

  const userId = user.id || user;
  const firstName = user.first_name || '';
  const lastName = user.last_name || '';
  const username = user.username ? `@${user.username}` : 'N/A';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });

  const text =
    `📋 *User Activity Log*\n\n` +
    `👤 *Name:* ${fullName}\n` +
    `🔗 *Username:* ${username}\n` +
    `🆔 *User ID:* \`${userId}\`\n` +
    `📅 *Time:* ${now} (MMT)\n\n` +
    `📌 *Action:* ${action}\n` +
    (details ? `\n📝 *Details:*\n${details}` : '');

  try {
    await bot.sendMessage(LOG_CHANNEL, text, { parse_mode: 'Markdown' });
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
