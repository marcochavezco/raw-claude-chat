import { createInterface } from 'node:readline';
import { stdin } from 'node:process';
import { pipeline, type PretrainedOptions } from '@xenova/transformers';
import type { FeatureExtractionPipeline } from '@xenova/transformers';
import { SemanticSearch } from './semanticSearch.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

type Message = {
  role: 'user' | 'assistant';
  content: string | any[];
};

const history: Message[] = [];

function getWordCount(text: string): number {
  const words = String(text).split(' ');

  const wordCount = words.length;

  return wordCount;
}

function reverseText(text: string): string {
  return String(text).split('').reverse().join('');
}

function getHeaders() {
  return {
    'content-type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY as string,
    'anthropic-version': '2023-06-01',
  };
}

async function buildRequest(messages: any, query?: string) {
  const context = query ? await retrievalPipeline(query) : [];

  return {
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: `Answer questions based only on the following context:\n${context.map((r: any) => r.text).join('\n')}`,
    messages,
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
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
      {
        name: 'reverse_text',
        description: 'Reverses the given text',
        input_schema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to reverse',
            },
          },
          required: ['text'],
        },
      },
    ],
  };
}

function getContextWindow(history: Message[], maxMessages: number): Message[] {
  if (history.length > maxMessages) {
    return history.slice(-maxMessages);
  }

  return history;
}

const knowledge = [
  'Alex lives in Austin, Texas.',
  'Alex is a software engineer with 5 years of experience.',
  "Alex's favorite programming language is TypeScript.",
  'Alex owns a dog named Luna.',
  'Alex is learning AI engineering in 2026.',
];

const options = {
  dtype: 'q8',
} as PretrainedOptions;

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
  options,
);

const search = new SemanticSearch(extractor);
await search.indexDocuments(knowledge);

async function retrievalPipeline(query: string) {
  return await search.search({ query, topK: 2 });
}

async function chat(initialMessages: Message[]) {
  const URL = 'https://api.anthropic.com/v1/messages';

  let data: any;
  let messages = [...initialMessages];

  const lastMessage = messages[messages.length - 1];
  const query =
    typeof lastMessage?.content === 'string' ? lastMessage.content : undefined;

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(
        await buildRequest(getContextWindow(messages, 6), query),
      ),
    });

    data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    console.log(
      `[tokens] input: ${data.usage.input_tokens} | output: ${data.usage.output_tokens} | total: ${data.usage.input_tokens + data.usage.output_tokens}`,
    );

    while (data.stop_reason === 'tool_use') {
      const toolUse = data.content.find((b: any) => b.type === 'tool_use');

      let result: string;
      switch (toolUse.name) {
        case 'get_word_count':
          result = String(getWordCount(toolUse.input.text));
          break;
        case 'reverse_text':
          result = reverseText(toolUse.input.text);
          break;
        default:
          throw new Error(`Unknown tool: ${toolUse.name}`);
      }

      messages = [
        ...messages,
        { role: 'assistant', content: data.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result,
            },
          ],
        },
      ];

      const next = await fetch(URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(
          await buildRequest(getContextWindow(messages, 6), query),
        ),
      });

      data = await next.json();
    }
    return data;
  } catch (error: any) {
    console.error(error.message);
    return null;
  }
}

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
