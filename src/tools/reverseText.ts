export default function reverseText(text: string): string {
  return String(text).split('').reverse().join('');
}
