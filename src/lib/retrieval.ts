import { pipeline, type PretrainedOptions } from '@xenova/transformers';
import { SemanticSearch } from '../tools/semanticSearch.js';

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

export async function retrievalPipeline(query: string) {
  return await search.search({ query, topK: 2 });
}
