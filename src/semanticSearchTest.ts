import { pipeline } from '@xenova/transformers';
import type { PretrainedOptions } from '@xenova/transformers/types/utils/hub.js';

const sentences = ['I like cats', 'Stock market'];

const options = {
  dtype: 'q8',
} as PretrainedOptions;

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
  options,
);

const batchOutput = await extractor(sentences, {
  pooling: 'mean',
  normalize: true,
});

console.log(`[Batch shape]: ${batchOutput.dims}`);

const vectors = batchOutput.tolist();
console.log(`Number of vectors: ${vectors.length}`);
console.log(`Each vector has: ${vectors[0].length} dimensions`);

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector lenght mismatch ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return Math.max(-1, Math.min(1, dotProduct));
}

console.log(cosineSimilarity(vectors[0], vectors[1]));
