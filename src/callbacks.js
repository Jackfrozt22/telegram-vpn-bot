const {
  getMainMenuKeyboard,
  getKeyTypeKeyboard,
  getProtocolKeyboard,
  getV2RayProtocolKeyboard,
  getServerListKeyboard,
  getServerActionsKeyboard,
  getShadowsocksMethodKeyboard,
  getBackKeyboard,
  getKeyActionsKeyboard,
} = require('./keyboards');

const { generateVPNKey } = require('./vpn/keyGenerator');
const { storeKey, getAllKeys, getKey, deleteKey, getKeyCount } = require('./vpn/keyStore');
const { getServerList, getServerById, getOnlineServers, getCountryFlag, formatServerList } = require('./vpn/serverList');
const { generateVMessConfig, generateVLESSConfig, generateShadowsocksConfig, generateV2RayClientConfig, formatConfigMessage } = require('./vpn/configGenerator');

function handleCallback(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = String(query.from.id);
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  // ─── Main Menu ─────────────────────────────────────────────
  if (data === 'back_to_menu') {
    return bot.editMessageText('🔐 *Main Menu*', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard(),
    });
  }

  // ─── Generate Key Menu ─────────────────────────────────────
  if (data === 'menu_generate') {
    return bot.editMessageText('🔑 *Generate VPN Key*\n\nChoose key type:', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getKeyTypeKeyboard(),
    });
  }

  // ─── Key Generation ────────────────────────────────────────
  if (data.startsWith('gen_')) {
    const type = data.replace('gen_', '');
    const keys = generateVPNKey(type);
    let text = '🔑 *Generated Key(s):*\n\n';

    for (const [name, value] of Object.entries(keys)) {
      text += `*${name}:* \`${value}\`\n`;
    }

    // Auto-save to store
    const keyName = `key_${Date.now()}`;
    storeKey(userId, keyName, { type, ...keys });
    text += `\n💾 Auto-saved as \`${keyName}\``;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getKeyTypeKeyboard(),
    });
  }

  // ─── My Keys ───────────────────────────────────────────────
  if (data === 'menu_mykeys') {
    const keys = getAllKeys(userId);
    const keyNames = Object.keys(keys);

    if (keyNames.length === 0) {
      return bot.editMessageText('📦 *My Keys*\n\nNo keys saved yet. Generate some first!', {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getBackKeyboard(),
      });
    }

    let text = `📦 *My Keys* (${keyNames.length})\n\n`;
    const buttons = [];

    keyNames.slice(0, 10).forEach((name) => {
      const k = keys[name];
      text += `• \`${name}\` — ${k.type || 'unknown'}\n`;
      buttons.push([
        { text: `👁 ${name}`, callback_data: `viewkey_${name}` },
        { text: '🗑', callback_data: `delkey_${name}` },
      ]);
    });

    if (keyNames.length > 10) {
      text += `\n_...and ${keyNames.length - 10} more_`;
    }

    buttons.push([{ text: '« Back', callback_data: 'back_to_menu' }]);

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  if (data.startsWith('viewkey_')) {
    const keyName = data.replace('viewkey_', '');
    const keyData = getKey(userId, keyName);

    if (!keyData) {
      return bot.editMessageText('Key not found.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    let text = `🔑 *Key: ${keyName}*\n\n`;
    for (const [k, v] of Object.entries(keyData)) {
      if (typeof v === 'object') continue;
      text += `*${k}:* \`${v}\`\n`;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getKeyActionsKeyboard(keyName),
    });
  }

  if (data.startsWith('delkey_')) {
    const keyName = data.replace('delkey_', '');
    deleteKey(userId, keyName);

    return bot.editMessageText(`🗑 Key \`${keyName}\` deleted.`, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getBackKeyboard(),
    });
  }

  // ─── Server List ───────────────────────────────────────────
  if (data === 'menu_servers') {
    const servers = getOnlineServers();
    return bot.editMessageText(formatServerList(servers), {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getServerListKeyboard(servers),
    });
  }

  if (data.startsWith('server_')) {
    const serverId = parseInt(data.replace('server_', ''));
    const server = getServerById(serverId);

    if (!server) {
      return bot.editMessageText('Server not found.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    const flag = getCountryFlag(server.country);
    let text = `${flag} *${server.name}*\n\n`;
    text += `*Host:* \`${server.host}\`\n`;
    text += `*Port:* \`${server.port}\`\n`;
    text += `*Status:* ${server.status === 'online' ? '🟢 Online' : '🔴 Offline'}\n`;
    text += `*Protocols:* ${server.protocols.join(', ')}\n\n`;
    text += `Generate config for this server:`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getServerActionsKeyboard(serverId),
    });
  }

  // ─── Server-specific config generation ─────────────────────
  if (data.startsWith('srvconf_')) {
    const parts = data.replace('srvconf_', '').split('_');
    const protocol = parts[0];
    const serverId = parseInt(parts[1]);
    const server = getServerById(serverId);

    if (!server) {
      return bot.editMessageText('Server not found.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    let result;
    if (protocol === 'vmess') {
      result = generateVMessConfig(server);
    } else if (protocol === 'vless') {
      result = generateVLESSConfig(server);
    } else if (protocol === 'ss') {
      result = generateShadowsocksConfig(server);
    }

    if (result) {
      const text = formatConfigMessage(result);
      // Save the generated config
      const keyName = `${protocol}_${server.name.replace(/\s+/g, '_')}_${Date.now()}`;
      storeKey(userId, keyName, result);

      return bot.editMessageText(text + `\n\n💾 Saved as \`${keyName}\``, {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getServerActionsKeyboard(serverId),
      });
    }
  }

  // ─── Config Generation Menu ────────────────────────────────
  if (data === 'menu_config') {
    return bot.editMessageText('⚙️ *Generate Config*\n\nChoose protocol:', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getProtocolKeyboard(),
    });
  }

  // ─── Quick Config (uses first online server) ───────────────
  if (data === 'config_vmess' || data === 'config_vless') {
    const servers = getOnlineServers();
    if (servers.length === 0) {
      return bot.editMessageText('No online servers available.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    const server = servers[0];
    const result = data === 'config_vmess'
      ? generateVMessConfig(server)
      : generateVLESSConfig(server);

    const text = formatConfigMessage(result);
    const keyName = `${result.type}_${Date.now()}`;
    storeKey(userId, keyName, result);

    return bot.editMessageText(text + `\n\n💾 Saved as \`${keyName}\``, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getProtocolKeyboard(),
    });
  }

  if (data === 'config_ss') {
    return bot.editMessageText('🛡 *Shadowsocks*\n\nChoose encryption method:', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getShadowsocksMethodKeyboard('ssgen'),
    });
  }

  if (data.startsWith('ssgen_')) {
    const method = data.replace('ssgen_', '');
    const servers = getOnlineServers();
    if (servers.length === 0) {
      return bot.editMessageText('No online servers available.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    const server = servers[0];
    const result = generateShadowsocksConfig(server, { method });
    const text = formatConfigMessage(result);
    const keyName = `ss_${Date.now()}`;
    storeKey(userId, keyName, result);

    return bot.editMessageText(text + `\n\n💾 Saved as \`${keyName}\``, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getProtocolKeyboard(),
    });
  }

  // ─── V2Ray Full JSON Config ────────────────────────────────
  if (data === 'config_v2ray_menu') {
    return bot.editMessageText('📄 *V2Ray Full JSON Config*\n\nChoose protocol:', {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getV2RayProtocolKeyboard(),
    });
  }

  if (data.startsWith('v2ray_')) {
    const protocol = data.replace('v2ray_', '');
    const servers = getOnlineServers();
    if (servers.length === 0) {
      return bot.editMessageText('No online servers available.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: getBackKeyboard(),
      });
    }

    const server = servers[0];
    const protoMap = { vmess: 'vmess', vless: 'vless', ss: 'shadowsocks' };
    const v2rayConfig = generateV2RayClientConfig(server, protoMap[protocol] || protocol);

    const configJson = JSON.stringify(v2rayConfig, null, 2);
    const text = `📄 *V2Ray ${protocol.toUpperCase()} Config*\n` +
      `Server: \`${server.host}\`\n\n` +
      `\`\`\`json\n${configJson.substring(0, 3000)}\n\`\`\``;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: getV2RayProtocolKeyboard(),
    });
  }

  // ─── Help ──────────────────────────────────────────────────
  if (data === 'help') {
    return bot.editMessageText(
      `📖 *VPN Key Bot - Help*\n\n` +
      `🔑 *Generate Key* - Create UUID, passwords, keys\n` +
      `📦 *My Keys* - View & manage saved keys\n` +
      `🖥 *Servers* - Browse VPN servers\n` +
      `⚙️ *Config* - Generate VMess/VLESS/SS configs\n\n` +
      `All generated keys and configs are auto-saved!`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getBackKeyboard(),
      }
    );
  }
}

module.exports = { handleCallback };
