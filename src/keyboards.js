function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🎁 Trial Key', callback_data: 'trial_key' },
        { text: '📦 My Key', callback_data: 'menu_mykey' },
      ],
      [
        { text: '👤 My Account', callback_data: 'my_account' },
        { text: '📞 Admin ဆက်သွယ်ရန်', callback_data: 'contact_admin' },
      ],
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

module.exports = {
  getMainMenuKeyboard,
  getBackKeyboard,
};
