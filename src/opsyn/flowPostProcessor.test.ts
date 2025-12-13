/**
 * Unit Tests for Flow Post-Processor
 */

import {
  extractJsonCandidate,
  normalizeToImportFlowRequest,
  sanitizeImportRequest,
  buildImportPayload,
  ImportFlowRequest,
  __testing,
} from './flowPostProcessor';

const { sanitizeStringValue } = __testing;

describe('extractJsonCandidate', () => {
  it('should extract JSON from text with surrounding content', () => {
    const raw = 'Some text before {"key": "value"} and after';
    const result = extractJsonCandidate(raw);
    expect(result).toEqual({ key: 'value' });
  });

  it('should handle markdown code fences', () => {
    const raw = '```json\n{"test": true}\n```';
    const result = extractJsonCandidate(raw);
    expect(result).toEqual({ test: true });
  });

  it('should repair truncated JSON', () => {
    const raw = '{"incomplete": "json';
    const result = extractJsonCandidate(raw);
    expect(result).toEqual({ incomplete: 'json' });
  });

  it('should handle nested truncation', () => {
    const raw = '{"outer": {"inner": "value"';
    const result = extractJsonCandidate(raw);
    expect(result).toEqual({ outer: { inner: 'value' } });
  });

  it('should throw on empty input', () => {
    expect(() => extractJsonCandidate('')).toThrow('Input must be a non-empty string');
  });

  it('should throw on no JSON found', () => {
    expect(() => extractJsonCandidate('no json here')).toThrow('No JSON object found');
  });

  it('should handle arrays in JSON', () => {
    const raw = '{"items": [1, 2, 3]}';
    const result = extractJsonCandidate(raw);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('should handle truncated arrays', () => {
    const raw = '{"items": [1, 2, 3';
    const result = extractJsonCandidate(raw);
    expect(result).toEqual({ items: [1, 2, 3] });
  });
});

describe('normalizeToImportFlowRequest', () => {
  it('should handle direct ImportFlowRequest format', () => {
    const input = {
      displayName: 'Test Flow',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Test Trigger',
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '~1.0.0',
          input: {},
        },
      },
      schemaVersion: '6',
    };
    
    const result = normalizeToImportFlowRequest(input);
    expect(result.displayName).toBe('Test Flow');
    expect(result.trigger.type).toBe('PIECE_TRIGGER');
  });

  it('should unwrap IMPORT_FLOW format', () => {
    const input = {
      type: 'IMPORT_FLOW',
      request: {
        displayName: 'Wrapped Flow',
        trigger: {
          name: 'trigger',
          type: 'PIECE_TRIGGER',
          valid: true,
          displayName: 'Trigger',
          settings: {},
        },
        schemaVersion: null,
      },
    };
    
    const result = normalizeToImportFlowRequest(input);
    expect(result.displayName).toBe('Wrapped Flow');
  });

  it('should handle { flows: [...] } hallucination', () => {
    const input = {
      flows: [
        {
          displayName: 'Flow from Array',
          type: 'PIECE_TRIGGER',
          property: {
            spreadsheetId: 'abc123',
          },
        },
      ],
    };
    
    const result = normalizeToImportFlowRequest(input);
    expect(result.displayName).toBe('Flow from Array');
    expect(result.trigger.type).toBe('PIECE_TRIGGER');
  });

  it('should infer Google Sheets from spreadsheetId', () => {
    const input = {
      flows: [
        {
          displayName: 'Sheets Flow',
          property: {
            spreadsheetId: 'abc123',
          },
        },
      ],
    };
    
    const result = normalizeToImportFlowRequest(input);
    expect(result.trigger.settings.pieceName).toBe('@activepieces/piece-google-sheets');
  });

  it('should throw on empty flows array', () => {
    expect(() => normalizeToImportFlowRequest({ flows: [] })).toThrow('Empty flows array');
  });

  it('should throw on invalid input', () => {
    expect(() => normalizeToImportFlowRequest(null)).toThrow('Input must be an object');
  });
});

describe('sanitizeImportRequest', () => {
  const createTestRequest = (input: Record<string, unknown>): ImportFlowRequest => ({
    displayName: 'Test',
    trigger: {
      name: 'trigger',
      type: 'PIECE_TRIGGER',
      valid: true,
      displayName: 'Trigger',
      settings: {
        pieceName: '@activepieces/piece-slack',
        pieceVersion: '~1.0.0',
        input,
      },
    },
    schemaVersion: '6',
  });

  it('should sanitize connection references', () => {
    const req = createTestRequest({
      auth: "{{connections['abc123']}}",
    });
    
    const result = sanitizeImportRequest(req);
    const input = (result.trigger.settings as Record<string, unknown>).input as Record<string, unknown>;
    expect(input.auth).toBe('__TODO_CONNECTION__');
  });

  it('should sanitize Slack tokens (xoxb-)', () => {
    const req = createTestRequest({
      token: 'xoxb-123456789-abcdefghij',
    });
    
    const result = sanitizeImportRequest(req);
    const input = (result.trigger.settings as Record<string, unknown>).input as Record<string, unknown>;
    expect(input.token).toBe('__TODO_CONNECTION__');
  });

  it('should sanitize Slack channel IDs', () => {
    const req = createTestRequest({
      channel: 'C0123456789',
    });
    
    const result = sanitizeImportRequest(req);
    const input = (result.trigger.settings as Record<string, unknown>).input as Record<string, unknown>;
    expect(input.channel).toBe('__TODO_CHANNEL_ID__');
  });

  it('should preserve #channel names', () => {
    const req = createTestRequest({
      channel: '#sales',
    });
    
    const result = sanitizeImportRequest(req);
    const input = (result.trigger.settings as Record<string, unknown>).input as Record<string, unknown>;
    expect(input.channel).toBe('#sales');
  });

  it('should remove inputUiInfo', () => {
    const req: ImportFlowRequest = {
      displayName: 'Test',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-slack',
          inputUiInfo: { customizedInputs: {} },
          input: {},
        },
      },
      schemaVersion: '6',
    };
    
    const result = sanitizeImportRequest(req);
    expect('inputUiInfo' in result.trigger.settings).toBe(false);
  });

  it('should preserve propertySettings as empty object', () => {
    const req: ImportFlowRequest = {
      displayName: 'Test',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-slack',
          propertySettings: { some: 'data' },
          input: {},
        },
      },
      schemaVersion: '6',
    };
    
    const result = sanitizeImportRequest(req);
    expect(result.trigger.settings.propertySettings).toEqual({});
  });

  it('should not have any remaining xoxb- tokens', () => {
    const req = createTestRequest({
      auth: 'xoxb-secret',
      token: 'xoxp-another-secret',
      apiKey: 'xoxa-app-secret',
    });
    
    const result = sanitizeImportRequest(req);
    const stringified = JSON.stringify(result);
    expect(stringified).not.toContain('xoxb-');
    expect(stringified).not.toContain('xoxp-');
    expect(stringified).not.toContain('xoxa-');
  });

  it('should not have any remaining {{connections[...]}}}', () => {
    const req = createTestRequest({
      auth: "{{connections['test']}}",
      another: "{{connections[\"test2\"]}}",
    });
    
    const result = sanitizeImportRequest(req);
    const stringified = JSON.stringify(result);
    expect(stringified).not.toContain('{{connections[');
  });
});

describe('buildImportPayload', () => {
  it('should wrap request in IMPORT_FLOW payload', () => {
    const req: ImportFlowRequest = {
      displayName: 'Test',
      trigger: {
        name: 'trigger',
        type: 'EMPTY',
        valid: true,
        displayName: 'Empty Trigger',
        settings: {},
      },
      schemaVersion: '6',
    };
    
    const result = buildImportPayload(req);
    expect(result.type).toBe('IMPORT_FLOW');
    expect(result.request.displayName).toBe('Test');
  });

  it('should set schemaVersion to null', () => {
    const req: ImportFlowRequest = {
      displayName: 'Test',
      trigger: {
        name: 'trigger',
        type: 'EMPTY',
        valid: true,
        displayName: 'Empty Trigger',
        settings: {},
      },
      schemaVersion: '6',
    };
    
    const result = buildImportPayload(req);
    expect(result.request.schemaVersion).toBe(null);
  });

  it('should sanitize the request', () => {
    const req: ImportFlowRequest = {
      displayName: 'Test',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-slack',
          input: {
            auth: "{{connections['test']}}",
          },
        },
      },
      schemaVersion: '6',
    };
    
    const result = buildImportPayload(req);
    const input = (result.request.trigger.settings as Record<string, unknown>).input as Record<string, unknown>;
    expect(input.auth).toBe('__TODO_CONNECTION__');
  });
});

describe('sanitizeStringValue', () => {
  it('should sanitize auth keys', () => {
    expect(sanitizeStringValue('auth', 'any-value')).toBe('__TODO_CONNECTION__');
  });

  it('should sanitize apiKey keys', () => {
    expect(sanitizeStringValue('apiKey', 'sk-123')).toBe('__TODO_CONNECTION__');
  });

  it('should sanitize token keys', () => {
    expect(sanitizeStringValue('access_token', 'tok-123')).toBe('__TODO_CONNECTION__');
  });

  it('should sanitize connection references regardless of key', () => {
    expect(sanitizeStringValue('any', "{{connections['test']}}")).toBe('__TODO_CONNECTION__');
  });

  it('should sanitize Slack tokens in any value', () => {
    expect(sanitizeStringValue('random', 'xoxb-123-456')).toBe('__TODO_CONNECTION__');
  });

  it('should not sanitize regular strings', () => {
    expect(sanitizeStringValue('message', 'Hello world')).toBe('Hello world');
  });
});

describe('Integration: Full Pipeline', () => {
  it('should process the malformed model output', () => {
    const raw = `{
      "flows": [
        {
          "displayName": "New Row Triggered",
          "type": "PIECE_TRIGGER",
          "property": {
            "auth": "{{connections['J62V0T6iQ43MxqQ3Za07i']}}",
            "spreadsheetId": "__TODO_SPREADSHEET_ID__"
          }
        }
      ]
    }`;

    const json = extractJsonCandidate(raw);
    const normalized = normalizeToImportFlowRequest(json);
    const payload = buildImportPayload(normalized);

    expect(payload.type).toBe('IMPORT_FLOW');
    expect(payload.request.displayName).toBe('New Row Triggered');
    expect(payload.request.trigger.type).toBe('PIECE_TRIGGER');
    
    // Should have sanitized the connection
    const input = (payload.request.trigger.settings as Record<string, unknown>).input as Record<string, unknown>;
    expect(input?.auth).toBe('__TODO_CONNECTION__');
  });

  it('should handle truncated output', () => {
    const raw = `{
      "flows": [
        {
          "displayName": "Truncated Flow",
          "type": "PIECE_TRIGGER"
    `;

    const json = extractJsonCandidate(raw);
    const normalized = normalizeToImportFlowRequest(json);
    
    expect(normalized.displayName).toBe('Truncated Flow');
  });
});

