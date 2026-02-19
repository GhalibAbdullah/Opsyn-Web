/**
 * NameMatcher: Robust pattern matching for trigger/action names.
 * 
 * Ported from Python to TypeScript.
 * Uses 7 matching strategies for finding the best match.
 */

export class NameMatcher {
  // Common piece prefixes to strip
  private static readonly PIECE_PREFIXES = [
    'gmail_', 'gmail-', 'gmail',
    'googlesheets_', 'googlesheets-', 'googlesheets', 'google_sheets_', 'google-sheets-', 'google-sheets',
    'slack_', 'slack-', 'slack',
    'hubspot_', 'hubspot-', 'hubspot',
    'webhook_', 'webhook-', 'webhook',
    'schedule_', 'schedule-', 'schedule',
    'telegram_', 'telegram-', 'telegram',
    'notion_', 'notion-', 'notion',
    'openai_', 'openai-', 'openai',
    'forms_', 'forms-', 'forms',
    'http_', 'http-', 'http',
    'drive_', 'drive-', 'drive', 'google_drive_', 'google-drive-',
    'sheets_', 'sheets-', 'sheets',
    'pipedrive_', 'pipedrive-', 'pipedrive',
    'salesforce_', 'salesforce-', 'salesforce',
  ];

  // Semantic synonyms
  private static readonly SYNONYMS: Record<string, string[]> = {
    // Verbs
    add: ['insert', 'create', 'new', 'append'],
    insert: ['add', 'create', 'new', 'append'],
    create: ['add', 'insert', 'new', 'make'],
    get: ['fetch', 'retrieve', 'read', 'find', 'lookup', 'list'],
    fetch: ['get', 'retrieve', 'read', 'find', 'list'],
    retrieve: ['get', 'fetch', 'find', 'read', 'list'],
    find: ['get', 'search', 'lookup', 'query', 'fetch', 'retrieve', 'list'],
    search: ['find', 'query', 'lookup', 'get', 'list'],
    list: ['get', 'fetch', 'find', 'retrieve'],
    update: ['edit', 'modify', 'change', 'patch'],
    edit: ['update', 'modify', 'change'],
    delete: ['remove', 'trash', 'destroy'],
    remove: ['delete', 'trash', 'destroy'],
    send: ['post', 'submit', 'dispatch', 'transmit', 'publish'],
    post: ['send', 'submit', 'create', 'publish'],
    submit: ['send', 'post', 'create'],
    receive: ['get', 'catch', 'incoming', 'handle'],
    catch: ['receive', 'capture', 'intercept', 'handle', 'incoming'],
    incoming: ['catch', 'receive', 'new', 'handle'],
    handle: ['catch', 'receive', 'process'],
    trigger: ['webhook', 'event', 'hook'],
    webhook: ['trigger', 'hook', 'request', 'callback', 'incoming'],
    request: ['webhook', 'call', 'invoke'],
    // Nouns
    message: ['msg', 'notification', 'alert', 'text'],
    email: ['mail', 'message'],
    row: ['record', 'entry', 'line', 'item', 'rows'],
    rows: ['row', 'records', 'entries', 'items', 'list'],
    channel: ['room', 'chat', 'public'],
    direct: ['dm', 'private', 'personal'],
    response: ['reply', 'answer'],
    new: ['created', 'added', 'incoming', 'fresh'],
  };

  static levenshteinDistance(s1: string, s2: string): number {
    if (s1.length < s2.length) {
      return this.levenshteinDistance(s2, s1);
    }

    if (s2.length === 0) {
      return s1.length;
    }

    let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);

    for (let i = 0; i < s1.length; i++) {
      const currentRow = [i + 1];
      for (let j = 0; j < s2.length; j++) {
        const insertions = previousRow[j + 1] + 1;
        const deletions = currentRow[j] + 1;
        const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
        currentRow.push(Math.min(insertions, deletions, substitutions));
      }
      previousRow = currentRow;
    }

    return previousRow[previousRow.length - 1];
  }

  static normalize(name: string): string {
    return name.toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/\s/g, '');
  }

  static tokenize(name: string): string[] {
    // Convert camelCase/PascalCase to snake_case
    const withUnderscores = name.replace(/([a-z])([A-Z])/g, '$1_$2');
    // Split by _ or - or spaces
    const tokens = withUnderscores.split(/[_\-\s]+/).map(t => t.toLowerCase()).filter(t => t);
    return tokens;
  }

  static stripPiecePrefix(name: string): string {
    const lowerName = name.toLowerCase();
    for (const prefix of this.PIECE_PREFIXES) {
      if (lowerName.startsWith(prefix)) {
        return name.substring(prefix.length);
      }
    }
    return name;
  }

  static expandWithSynonyms(tokens: string[]): Set<string> {
    const expanded = new Set(tokens);
    for (const token of tokens) {
      if (this.SYNONYMS[token]) {
        this.SYNONYMS[token].forEach(syn => expanded.add(syn));
      }
    }
    return expanded;
  }

  static tokensMatchWithSynonyms(token1: string, token2: string): boolean {
    if (token1 === token2) return true;
    if (this.SYNONYMS[token1]?.includes(token2)) return true;
    if (this.SYNONYMS[token2]?.includes(token1)) return true;
    return false;
  }

  static tokenOverlapScore(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const expanded1 = this.expandWithSynonyms(tokens1);
    const expanded2 = this.expandWithSynonyms(tokens2);

    const intersection = new Set([...expanded1].filter(x => expanded2.has(x)));
    const union = new Set([...expanded1, ...expanded2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  static tokenSequenceScore(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let maxMatches = 0;
    for (let i = 0; i < tokens2.length; i++) {
      let matches = 0;
      for (let j = 0; j < tokens1.length && i + j < tokens2.length; j++) {
        if (this.tokensMatchWithSynonyms(tokens2[i + j], tokens1[j])) {
          matches++;
        } else {
          break;
        }
      }
      maxMatches = Math.max(maxMatches, matches);
    }

    let nonContiguousMatches = 0;
    for (const t1 of tokens1) {
      for (const t2 of tokens2) {
        if (this.tokensMatchWithSynonyms(t1, t2)) {
          nonContiguousMatches++;
          break;
        }
      }
    }

    const contiguousScore = maxMatches / Math.max(tokens1.length, tokens2.length);
    const nonContiguousScore = nonContiguousMatches / Math.max(tokens1.length, tokens2.length);
    return Math.max(contiguousScore, nonContiguousScore * 0.9);
  }

  static similarityScore(name1: string, name2: string): number {
    // Exact match
    if (name1 === name2) return 1.0;

    // Normalized exact match
    const norm1 = this.normalize(name1);
    const norm2 = this.normalize(name2);
    if (norm1 === norm2) return 0.98;

    // Strip prefixes and compare
    const stripped1 = this.normalize(this.stripPiecePrefix(name1));
    const stripped2 = this.normalize(this.stripPiecePrefix(name2));
    if (stripped1 === stripped2) return 0.95;

    // Substring match
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.90;
    if (stripped1.includes(stripped2) || stripped2.includes(stripped1)) return 0.85;

    // Token-based matching
    const tokens1 = this.tokenize(name1);
    const tokens2 = this.tokenize(name2);

    // Verb match bonus
    let verbMatchBonus = 0.0;
    const stopWords = new Set(['new', 'on', 'the', 'a', 'an', 'to', 'from']);
    const keyTokens1 = tokens1.filter(t => !stopWords.has(t)).slice(0, 2);
    const keyTokens2 = tokens2.filter(t => !stopWords.has(t)).slice(0, 2);

    for (const kt1 of keyTokens1) {
      for (const kt2 of keyTokens2) {
        if (this.tokensMatchWithSynonyms(kt1, kt2)) {
          verbMatchBonus = 0.25;
          break;
        }
      }
    }

    const overlapScore = this.tokenOverlapScore(tokens1, tokens2);
    const sequenceScore = this.tokenSequenceScore(tokens1, tokens2);

    const maxLen = Math.max(stripped1.length, stripped2.length);
    const editDistance = maxLen > 0 ? this.levenshteinDistance(stripped1, stripped2) : 0;
    const editScore = maxLen > 0 ? 1 - (editDistance / maxLen) : 0;

    const combinedScore = overlapScore * 0.25 + sequenceScore * 0.35 + editScore * 0.25 + verbMatchBonus * 0.15;
    return Math.min(1.0, combinedScore + verbMatchBonus * 0.1);
  }

  static findBestMatch(
    target: string,
    candidates: string[],
    threshold: number = 0.45
  ): [string, number] | null {
    if (candidates.length === 0) return null;

    // Exact match first
    if (candidates.includes(target)) {
      return [target, 1.0];
    }

    // Score all candidates
    const scored = candidates.map(candidate => ({
      candidate,
      score: this.similarityScore(target, candidate),
    }));

    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score < threshold) {
      return null;
    }

    return [scored[0].candidate, scored[0].score];
  }
}

