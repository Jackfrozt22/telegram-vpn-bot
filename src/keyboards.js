function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Info', callback_data: 'info' },
        { text: 'Settings', callback_data: 'settings' },
      ],
      [
        { text: 'Help', callback_data: 'help' },
      ],
    ],
  };
}

function getSettingsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Language', callback_data: 'settings_language' },
        { text: 'Notifications', callback_data: 'settings_notifications' },
      ],
      [
        { text: '<< Back to Menu', callback_data: 'back_to_menu' },
      ],
    ],
  };
}

function getBackKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '<< Back to Menu', callback_data: 'back_to_menu' }],
    ],
  };
}

module.exports = { getMainMenuKeyboard, getSettingsKeyboard, getBackKeyboard };
