import { createInterface } from 'node:readline';
import { stdin } from 'node:process';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

function getWordCount(text: string): number {
  const words = String(text).split(' ');

  const wordCount = words.length;

  return wordCount;
}

function getHeaders() {
  return {
    'content-type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY as string,
    'anthropic-version': '2023-06-01',
  };
}

function buildRequest(messages: any) {
  return {
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: 'Respond every message in Spanish.',
    messages,
    tools: [
      {
        name: 'get_word_count',
        description: 'Counts the number of words in a given text',
        input_schema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to count words in',
            },
          },
          required: ['text'],
        },
      },
    ],
  };
}

async function chat(messages: Message[]) {
  const URL = 'https://api.anthropic.com/v1/messages';

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(buildRequest(messages)),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    if (data.stop_reason === 'tool_use') {
      const toolUse = data.content.find((b: any) => b.type === 'tool_use');

      const result = getWordCount(toolUse.input.text);

      const updatedMessages = [
        ...messages,
        { role: 'assistant', content: data.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: String(result),
            },
          ],
        },
      ];

      return await fetch(URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(buildRequest(updatedMessages)),
      }).then((r) => r.json());
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
    console.log(
      'Assintant: ',
      response?.content.type === 'tool_result' ?
        response.content.content
      : response?.content,
    );

    await startLoop();
  });
}

startLoop();
