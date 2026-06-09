// Autonomous task runner with RAG capabilities

import { chat, type Message } from './lib/anthropic.js';

const task =
  'What year did Alex start learning AI, and how many years of experience does he have in total if he started coding at age 18 and is now 28?';

const messages: Message[] = [{ role: 'user', content: task }];

const response = await chat(messages);

if (response?.finalAnswer) {
  console.log('Final answer:', response.finalAnswer);
} else {
  console.log('Final answer:', response?.content[0]?.text);
}
