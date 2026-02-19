/**
 * EmbeddingMatcher: Semantic similarity matching for trigger/action names.
 * 
 * Ported from Python to TypeScript using @xenova/transformers.
 * Provides embedding-based matching as a fallback when pattern matching fails.
 * 
 * Always loads the fine-tuned model from activepieces_embedding_model/ directory.
 * Throws an error if the model is not found.
 */

import type { FeatureExtractionPipeline } from '@xenova/transformers';
import path from 'path';

export interface MatchResult {
  name: string;
  score: number;
}

export class EmbeddingMatcher {
  private extractor: FeatureExtractionPipeline | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private readonly threshold: number;
  private readonly cache: Map<string, Float32Array> = new Map();
  
  // Model path - always uses the fine-tuned model
  private readonly modelPath: string | null;
  
  constructor(threshold: number = 0.7, modelPath?: string) {
    this.threshold = threshold;
    // Always use the fine-tuned model from activepieces_embedding_model
    this.modelPath = modelPath || this.getLocalModelPath();
    
    if (!this.modelPath) {
      // This should rarely happen since the model is in the repo
      // But if it does, we'll handle it gracefully in init()
      console.warn(
        '⚠️  Fine-tuned embedding model not found at expected locations. ' +
        'Embedding matching will be disabled. Pattern matching will still work.'
      );
    }
  }
  
  private getLocalModelPath(): string | null {
    // Try to find the local fine-tuned model
    const possiblePaths = [
      path.join(process.cwd(), 'activepieces_embedding_model'),
      path.join(__dirname, '../../../../../activepieces_embedding_model'),
    ];
    
    for (const modelPath of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(modelPath)) {
          // Verify it's a valid model directory
          const configPath = path.join(modelPath, 'config.json');
          if (fs.existsSync(configPath)) {
            return modelPath;
          }
        }
      } catch {
        // Continue to next path
      }
    }
    
    return null;
  }
  
  /**
   * Initialize the embedding model (lazy loading).
   */
  private async init(): Promise<void> {
    if (this.initialized || this.initPromise) {
      if (this.initPromise) {
        await this.initPromise;
      }
      return;
    }
    
    this.initPromise = (async () => {
      if (!this.modelPath) {
        // Model path not found, disable embeddings
        this.extractor = null;
        this.initialized = true;
        return;
      }
      
      try {
        // Dynamically import transformers to avoid bundling issues
        // NOTE: This is only used for local TypeScript post-processing
        // When using the Python model server, embeddings are handled there
        const transformers = await import('@xenova/transformers');
        
        // Use feature-extraction pipeline for embeddings
        this.extractor = await transformers.pipeline(
          'feature-extraction',
          this.modelPath!,
          {
            quantized: false, // Use full precision for better accuracy
            progress_callback: (progress: any) => {
              if (progress.status === 'loading') {
                console.log(`  ℹ️  Loading embedding model: ${progress.file || ''}`);
              }
            },
          }
        ) as FeatureExtractionPipeline;
        
        this.initialized = true;
        console.log(`  ✅ Embedding matcher initialized (model: ${this.modelPath})`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to load embedding model: ${error}`);
        this.extractor = null;
        this.initialized = true; // Mark as initialized to prevent retries
      }
    })();
    
    await this.initPromise;
  }
  
  /**
   * Get embedding for a text, with caching.
   */
  private async getEmbedding(text: string): Promise<Float32Array | null> {
    if (!this.extractor) {
      await this.init();
      if (!this.extractor) {
        return null;
      }
    }
    
    // Check cache
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    
    try {
      // Get embedding
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });
      
      // Convert to Float32Array
      const embedding = Array.isArray(output) 
        ? new Float32Array(output.flat())
        : new Float32Array(output.data);
      
      // Cache it
      this.cache.set(text, embedding);
      
      return embedding;
    } catch (error) {
      console.warn(`  ⚠️  Failed to get embedding for "${text}": ${error}`);
      return null;
    }
  }
  
  /**
   * Calculate cosine similarity between two embeddings.
   */
  private cosineSimilarity(emb1: Float32Array, emb2: Float32Array): number {
    if (emb1.length !== emb2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < emb1.length; i++) {
      dotProduct += emb1[i] * emb2[i];
      norm1 += emb1[i] * emb1[i];
      norm2 += emb2[i] * emb2[i];
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }
    
    return dotProduct / denominator;
  }
  
  /**
   * Find the best matching candidate for a query using semantic similarity.
   * 
   * @param query - The name to match (e.g., "notify_channel")
   * @param candidates - List of valid names to match against
   * @param context - Optional context (e.g., piece name) to improve matching
   * @returns Tuple of [best_match, score] if found, null if no match above threshold
   */
  async findBestMatch(
    query: string,
    candidates: string[],
    context?: string
  ): Promise<[string, number] | null> {
    if (!candidates || candidates.length === 0) {
      return null;
    }
    
    await this.init();
    
    if (!this.extractor) {
      return null;
    }
    
    // Add context to query if provided
    const queryWithContext = context
      ? this.buildContextualQuery(query, context)
      : query;
    
    // Get query embedding
    const queryEmb = await this.getEmbedding(queryWithContext);
    if (!queryEmb) {
      return null;
    }
    
    // Calculate similarity with each candidate
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const candidate of candidates) {
      // Also embed candidate with context for fair comparison
      const candidateWithContext = context
        ? this.buildContextualQuery(candidate, context)
        : candidate;
      
      const candidateEmb = await this.getEmbedding(candidateWithContext);
      if (!candidateEmb) {
        continue;
      }
      
      const similarity = this.cosineSimilarity(queryEmb, candidateEmb);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = candidate;
      }
    }
    
    if (bestMatch && bestScore >= this.threshold) {
      return [bestMatch, bestScore];
    }
    
    return null;
  }
  
  /**
   * Find top-k matching candidates for a query.
   */
  async findMatches(
    query: string,
    candidates: string[],
    topK: number = 3,
    context?: string
  ): Promise<MatchResult[]> {
    if (!candidates || candidates.length === 0) {
      return [];
    }
    
    await this.init();
    
    if (!this.extractor) {
      return [];
    }
    
    const queryWithContext = context
      ? this.buildContextualQuery(query, context)
      : query;
    
    const queryEmb = await this.getEmbedding(queryWithContext);
    if (!queryEmb) {
      return [];
    }
    
    // Calculate all similarities
    const similarities: MatchResult[] = [];
    
    for (const candidate of candidates) {
      const candidateWithContext = context
        ? this.buildContextualQuery(candidate, context)
        : candidate;
      
      const candidateEmb = await this.getEmbedding(candidateWithContext);
      if (candidateEmb) {
        const similarity = this.cosineSimilarity(queryEmb, candidateEmb);
        similarities.push({
          name: candidate,
          score: similarity,
        });
      }
    }
    
    // Sort by similarity and return top-k
    similarities.sort((a, b) => b.score - a.score);
    return similarities.slice(0, topK);
  }
  
  /**
   * Build a contextual query by adding piece name context.
   */
  private buildContextualQuery(name: string, context: string): string {
    // Extract short piece name (e.g., "piece-slack" from "@activepieces/piece-slack")
    const shortContext = context
      .split('/')
      .pop()
      ?.replace('piece-', '')
      .replace(/-/g, ' ') || '';
    
    return `${shortContext} ${name}`;
  }
  
  /**
   * Check if embedding matching is available.
   */
  isAvailable(): boolean {
    return this.extractor !== null;
  }
  
  /**
   * Clear the embedding cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance for global use
let embeddingMatcherInstance: EmbeddingMatcher | null = null;

export function getEmbeddingMatcher(threshold: number = 0.7): EmbeddingMatcher {
  if (!embeddingMatcherInstance) {
    embeddingMatcherInstance = new EmbeddingMatcher(threshold);
  }
  return embeddingMatcherInstance;
}

