import getWordCount from '../tools/getWordCount.js';
import reverseText from '../tools/reverseText.js';
import { getContextWindow } from './context.js';
import { retrievalPipeline } from './retrieval.js';

export type Message = {
  role: 'user' | 'assistant';
  content: string | any[];
};

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
    system: `
    - Answer questions based only on the following context:\n${context.map((r: any) => r.text).join('\n')}
    - You are an agent. Think step by step. Always use the search tool to find information. When you have a complete answer, you MUST call the finish tool with your final answer. Never respond directly with text.`,
    messages,
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    tools: [
      {
        name: 'search',
        description: 'Searches for relevant information based on a query',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'finish',
        description:
          'Call this when you have enough information to give a final answer',
        input_schema: {
          type: 'object',
          properties: {
            answer: {
              type: 'string',
              description: 'The final answer to return',
            },
          },
          required: ['answer'],
        },
      },
      {
        name: 'calculate',
        description: 'Calculates a numeric expresion',
        input_schema: {
          type: 'object',
          properties: {
            expresion: {
              type: 'string',
              description: 'The expresion to evaluate',
            },
          },
          required: ['expresion'],
        },
      },
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

export async function chat(initialMessages: Message[]) {
  const URL = 'https://api.anthropic.com/v1/messages';

  let data: any;
  let messages = [...initialMessages];
  let iteration = 0;
  const MAX_ITERATIONS = 5;

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
      if (iteration >= MAX_ITERATIONS) {
        console.error(`[agent] max iterations (${MAX_ITERATIONS} reached)`);
        return { error: 'max_iterations_reached', partialMessages: messages };
      }
      iteration++;
      console.log(`[iteration ${iteration}]`);

      const toolUse = data.content.find((b: any) => b.type === 'tool_use');
      console.log(`[tool call] ${toolUse.name}:`, toolUse.input);

      let result: string;
      try {
        switch (toolUse.name) {
          case 'search':
            const searchResult = await retrievalPipeline(toolUse.input.query);
            result = JSON.stringify(searchResult);
            break;
          case 'finish':
            return { finalAnswer: toolUse.input.answer };
          case 'calculate':
            const evalResult = eval(toolUse.input.expresion);
            result = String(evalResult);
            break;
          case 'get_word_count':
            result = String(getWordCount(toolUse.input.text));
            break;
          case 'reverse_text':
            result = reverseText(toolUse.input.text);
            break;
          default:
            throw new Error(`Unknown tool: ${toolUse.name}`);
        }
      } catch (toolError: any) {
        result = `Error: ${toolError.message}`;
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

      console.log(`[tool result] ${result}`);

      try {
        const next = await fetch(URL, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(
            await buildRequest(getContextWindow(messages, 6), query),
          ),
        });
        data = await next.json();
      } catch (fetchError: any) {
        console.error(`Fetch error: ${fetchError.message}`);
        return { error: 'fetch_error', partialMessages: messages };
      }
    }
    return data;
  } catch (error: any) {
    console.error(error.message);
    return null;
  }
}
