# Telegram Bot

A custom Telegram bot built with Node.js and [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api).

## Features

- `/start` - Start the bot with a welcome message
- `/help` - Show available commands
- `/menu` - Show an interactive inline keyboard menu
- `/about` - About this bot
- Inline keyboard buttons with callback handling
- Echo messages back to the user
- Settings submenu (Language, Notifications)

## Setup

### 1. Create a Bot on Telegram

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token you receive

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and paste your bot token:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 4. Run the Bot

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

## Project Structure

```
telegram-bot/
├── src/
│   ├── bot.js          # Main entry point
│   ├── commands.js     # Command handlers (/start, /help, /menu, /about)
│   ├── callbacks.js    # Inline keyboard callback handlers
│   └── keyboards.js    # Keyboard layout definitions
├── .env.example        # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

## Adding New Features

### Add a new command

1. Add a regex listener in `src/bot.js`:
   ```js
   bot.onText(/\/mycommand/, (msg) => handleCommand(bot, msg, 'mycommand'));
   ```

2. Add the handler in `src/commands.js`:
   ```js
   case 'mycommand':
     bot.sendMessage(chatId, 'My custom response');
     break;
   ```

### Add a new inline button

1. Add the button in `src/keyboards.js`:
   ```js
   { text: 'My Button', callback_data: 'my_action' }
   ```

2. Handle the callback in `src/callbacks.js`:
   ```js
   case 'my_action':
     bot.editMessageText('Button clicked!', {
       chat_id: chatId,
       message_id: messageId,
       reply_markup: getBackKeyboard(),
     });
     break;
   ```

## License

ISC
