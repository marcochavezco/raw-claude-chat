export default function getWordCount(text: string): number {
  const words = String(text).split(' ');

  const wordCount = words.length;

  return wordCount;
}
