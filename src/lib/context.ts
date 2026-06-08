import type { Message } from './anthropic.js';

export function getContextWindow(
  history: Message[],
  maxMessages: number,
): Message[] {
  if (history.length > maxMessages) {
    return history.slice(-maxMessages);
  }

  return history;
}
