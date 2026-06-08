// Embed documents once at startup, embed each query at search time, score every
// document against the query, sort by score

import type { FeatureExtractionPipelineType } from '@xenova/transformers';

type Doc = { text: string; vector: number[] };

type Search = { query: string; topK: number };

export class SemanticSearch {
  public extractor: FeatureExtractionPipelineType;
  private index: Doc[];

  constructor(extractor: FeatureExtractionPipelineType) {
    this.extractor = extractor;
    this.index = [];
  }

  async indexDocuments(docs: string[]) {
    console.log('Indexing...');

    const texts = docs.map((doc) => doc);

    const output = await this.extractor(texts, {
      pooling: 'mean',
      normalize: true,
    });

    // output.tolist() should produce number[][]; keep as any to be resilient
    const vectors: any = output.tolist();

    this.index = docs.map((doc, i) => ({
      text: doc,
      vector: vectors[i],
    }));

    return this;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector lenght mismatch ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    }

    return Math.max(-1, Math.min(1, dotProduct));
  }

  async search({ query, topK = 2 }: Search) {
    if (this.index.length === 0) {
      throw new Error('No documents indexed. Call indexDocuments() first');
    }

    const queryOutput = await this.extractor(query, {
      pooling: 'mean',
      normalize: true,
    });
    const queryVector = queryOutput.tolist()[0];

    const scored = this.index.map((doc) => ({
      doc,
      score: this.cosineSimilarity(queryVector, doc.vector),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(({ doc, score }) => ({
      text: doc.text,
      score: score,
    }));
  }

  toJSON() {
    return JSON.stringify(this.index);
  }

  fromJSON(json: string) {
    this.index = JSON.parse(json);
    return this;
  }
}
