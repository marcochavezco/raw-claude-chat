import { createInterface } from 'node:readline';
import { stdin } from 'node:process';
import { chat, type Message } from './lib/anthropic.js';

const history: Message[] = [];

async function conversation(message: Message) {
  history.push(message);
  try {
    const response = await chat(history);

    if (!response) {
      throw new Error('chat() returned null');
    }

    const content = response.content[0];

    const assistantMessage = {
      role: 'assistant' as const,
      content: content.type === 'tool_result' ? content : content.text,
    };
    history.push(assistantMessage);
    return assistantMessage;
  } catch (error: any) {
    console.log(error.message);
  }
}

async function startLoop() {
  const rl = createInterface({
    input: stdin,
  });

  rl.question('You: ', async (answer: string) => {
    if (answer.toLowerCase() === 'exit') {
      console.log('Exiting...');
      rl.close();
      return;
    }

    const response = await conversation({ role: 'user', content: answer });
    console.log('Assintant: ', response?.content);

    await startLoop();
  });
}

startLoop();
