const fs = require("fs");
const { OpenAI } = require("openai");

let openai;

let ASSISTANT_ID;

function init() {
  const configFilePath = './config.json';
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  openai = new OpenAI({
    apiKey: config.openAIKey,
  });

  ASSISTANT_ID = config.openAIAssistantId;
}

// Function to introduce a delay using promises
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// File to store thread mappings
const threadsFilePath = 'threads.json';

// Load existing threads from file or initialize an empty object
let threads = fs.existsSync(threadsFilePath) ? JSON.parse(fs.readFileSync(threadsFilePath, 'utf8')) : {};

console.log("Loaded threads from file:", threads);

// Function to get or create a thread ID based on the user's composite key
async function getOrCreateThreadId(userId, chatId, message) {
  const userKey = `${userId}_${chatId}`;
  console.log(`Getting or creating thread for key: ${userKey}`);

  if (!threads[userKey]) {
    console.log("No existing thread found, creating a new one...");
    // Create a new thread for the user
    const threadResponse = await openai.beta.threads.create({
      messages: [
        {
          "role": "user",
          "content": message,
        }
      ]
    });
    console.log("New thread created:", threadResponse);
    threads[userKey] = threadResponse.id;

    // Save the updated threads mapping
    fs.writeFileSync(threadsFilePath, JSON.stringify(threads, null, 2));
    console.log("Updated threads mapping saved to file");
  } else {
    console.log(`Existing thread found: ${threads[userKey]}, adding message to thread...`);
    const thread = threads[userKey];
    const threadMessages = await openai.beta.threads.messages.create(
        thread,
        { role: "user", content: message }
    );
    console.log("Message added to thread:", threadMessages);
  }

  return threads[userKey];
}

// Exporting the default function for handling API requests
async function handler(id, chatId, message) {
  console.log(`Handling request for id: ${id}, chatId: ${chatId}, with message: ${message}`);

  try {
    const threadId = await getOrCreateThreadId(id, chatId, message);
    console.log(`Using thread ID: ${threadId} for communication`);

    // Run the Assistant on the thread
    console.log("Creating run for the Assistant...");
    let runResponse = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });
    console.log("Assistant run created:", runResponse);

    // Wait for the run to complete and retrieve the response
    let runStatus = runResponse.status;
    console.log(`Current run status: ${runStatus}`);
    while (runStatus === "queued" || runStatus === "in_progress") {
      console.log("Waiting for run to complete...");
      await delay(15000); // Delay for checking the run status
      runResponse = await openai.beta.threads.runs.retrieve(threadId, runResponse.id);
      runStatus = runResponse.status;
      console.log(`Updated run status: ${runStatus}`);

      if (runStatus === "completed") {
        console.log("Run completed");
        break;
      }
    }

    // Retrieve the latest messages from the thread, including the Assistant's response
    console.log("Retrieving messages from thread...");
    const allMessages = await openai.beta.threads.messages.list(threadId);
    const assistantResponse = allMessages.data.filter((msg) => msg.role === "assistant")[0];

    const responseText = assistantResponse.content.filter(b => b.type === 'text').map(t => t.text.value).join('\n');
    console.log("Assistant response:", responseText);
    return responseText;
  } catch (error) {
    console.error("Error occurred:", error);
    return "error:" + error.toString();
  }
}

module.exports = {
  handler,
  init,
}