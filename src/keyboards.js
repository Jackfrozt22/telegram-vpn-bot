function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔑 Generate Key', callback_data: 'menu_generate' },
        { text: '📦 My Keys', callback_data: 'menu_mykeys' },
      ],
      [
        { text: '🖥 Servers', callback_data: 'menu_servers' },
        { text: '⚙️ Generate Config', callback_data: 'menu_config' },
      ],
      [
        { text: '❓ Help', callback_data: 'help' },
      ],
    ],
  };
}

function getKeyTypeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🆔 UUID', callback_data: 'gen_uuid' },
        { text: '🔐 Password', callback_data: 'gen_password' },
      ],
      [
        { text: '🔑 Base64 Key', callback_data: 'gen_base64' },
        { text: '#️⃣ Hex Key', callback_data: 'gen_hex' },
      ],
      [
        { text: '🎲 All Keys', callback_data: 'gen_all' },
      ],
      [{ text: '« Back', callback_data: 'back_to_menu' }],
    ],
  };
}

function getProtocolKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔷 VMess', callback_data: 'config_vmess' },
        { text: '🔶 VLESS', callback_data: 'config_vless' },
      ],
      [
        { text: '🛡 Shadowsocks', callback_data: 'config_ss' },
      ],
      [
        { text: '📄 V2Ray Full JSON', callback_data: 'config_v2ray_menu' },
      ],
      [{ text: '« Back', callback_data: 'back_to_menu' }],
    ],
  };
}

function getV2RayProtocolKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'VMess JSON', callback_data: 'v2ray_vmess' },
        { text: 'VLESS JSON', callback_data: 'v2ray_vless' },
      ],
      [
        { text: 'Shadowsocks JSON', callback_data: 'v2ray_ss' },
      ],
      [{ text: '« Back', callback_data: 'menu_config' }],
    ],
  };
}

function getServerListKeyboard(servers) {
  const buttons = servers.map((s) => [
    { text: `${s.status === 'online' ? '🟢' : '🔴'} ${s.name}`, callback_data: `server_${s.id}` },
  ]);
  buttons.push([{ text: '« Back', callback_data: 'back_to_menu' }]);
  return { inline_keyboard: buttons };
}

function getServerActionsKeyboard(serverId) {
  return {
    inline_keyboard: [
      [
        { text: '🔷 VMess', callback_data: `srvconf_vmess_${serverId}` },
        { text: '🔶 VLESS', callback_data: `srvconf_vless_${serverId}` },
      ],
      [
        { text: '🛡 SS', callback_data: `srvconf_ss_${serverId}` },
      ],
      [{ text: '« Back to Servers', callback_data: 'menu_servers' }],
    ],
  };
}

function getShadowsocksMethodKeyboard(prefix = 'ss') {
  return {
    inline_keyboard: [
      [{ text: 'aes-256-gcm', callback_data: `${prefix}_aes-256-gcm` }],
      [{ text: 'aes-128-gcm', callback_data: `${prefix}_aes-128-gcm` }],
      [{ text: 'chacha20-ietf-poly1305', callback_data: `${prefix}_chacha20-ietf-poly1305` }],
      [{ text: '« Back', callback_data: 'menu_config' }],
    ],
  };
}

function getBackKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '« Back to Menu', callback_data: 'back_to_menu' }],
    ],
  };
}

function getKeyActionsKeyboard(keyName) {
  return {
    inline_keyboard: [
      [
        { text: '👁 View', callback_data: `viewkey_${keyName}` },
        { text: '🗑 Delete', callback_data: `delkey_${keyName}` },
      ],
      [{ text: '« Back to Keys', callback_data: 'menu_mykeys' }],
    ],
  };
}

module.exports = {
  getMainMenuKeyboard,
  getKeyTypeKeyboard,
  getProtocolKeyboard,
  getV2RayProtocolKeyboard,
  getServerListKeyboard,
  getServerActionsKeyboard,
  getShadowsocksMethodKeyboard,
  getBackKeyboard,
  getKeyActionsKeyboard,
};
