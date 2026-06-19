// Autonomous task runner with RAG capabilities

import { chat, type Message } from './lib/anthropic.js';

const task = 'What is 2 + 2? Use the calculate tool.';
const messages: Message[] = [{ role: 'user', content: task }];

const response = await chat(messages);

if (response?.finalAnswer) {
  console.log('Final answer:', response.finalAnswer);
} else {
  console.log('Final answer:', response?.content[0]?.text);
}
