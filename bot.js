const TelegramBot = require('node-telegram-bot-api');
const {handler, init} = require("./openai");

const fs = require('fs');
const inquirer = require('inquirer');

const configFilePath = './config.json';
let config;

if (fs.existsSync(configFilePath)) {
  // Load the configuration if it exists
  config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
} else {
  // Ask the user to provide necessary details
  inquirer.prompt([
    {
      name: 'telegramBotToken',
      type: 'input',
      message: 'Enter your Telegram Bot Token:',
    },
    {
      name: 'openAIKey',
      type: 'input',
      message: 'Enter your OpenAI API Key:',
    },
    {
      name: 'openAIAssistantId',
      type: 'input',
      message: 'Enter your OpenAI Assistant ID:',
    }
  ]).then(answers => {
    // Save the answers to the config file
    fs.writeFileSync(configFilePath, JSON.stringify(answers, null, 4));
    config = answers;
    startBot();
  });
}

function startBot() {
  init();
// Create a bot that uses 'polling' to fetch new updates
  const bot = new TelegramBot(config.telegramBotToken, { polling: true });

// Matches "/echo [whatever]"
  bot.onText(/\/echo (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const resp = match[1]; // the captured "whatever"
    console.log(msg, match);
    // Send back the matched "whatever" to the chat
    debugger;
    const answer = await handler(msg.chat.id, msg.text);

    bot.sendMessage(chatId, answer);
  });

// Listen for any kind of message. There are different kinds of messages.
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const answer = await handler(msg.from.id, msg.chat.id, msg.text);
    // Send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, answer);
  });

  console.log('started');
}

if (config) {
  startBot();
}