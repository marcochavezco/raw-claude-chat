import { createInterface } from 'node:readline';
import { stdin } from 'node:process';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

async function chat(messages: Message[]) {
  const URL = 'https://api.anthropic.com/v1/messages';

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: 'Respond every message in Spanish.',
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    return data;
  } catch (error: any) {
    console.error(error.message);
    return null;
  }
}

const history: Message[] = [];

async function conversation(message: Message) {
  history.push(message);
  try {
    const response = await chat(history);
    const assistantMessage = {
      role: 'assistant' as const,
      content: response.content[0].text,
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
