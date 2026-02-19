/**
 * RobustFlowPostProcessor: TypeScript port of robust_post_processor.py
 * 
 * Provides robust post-processing for AI-generated Activepieces flow JSON.
 * Fixes schema issues, normalizes names, and ensures compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';
import { NameMatcher } from './name-matcher';
import { EmbeddingMatcher, getEmbeddingMatcher } from './embedding-matcher';

export interface Flow {
  displayName?: string;
  name?: string;
  schemaVersion?: string | null;
  trigger?: Trigger;
  [key: string]: any;
}

export interface Trigger {
  name?: string;
  type?: string;
  valid?: boolean;
  displayName?: string;
  settings?: Settings;
  nextAction?: Action;
  [key: string]: any;
}

export interface Action {
  name?: string;
  type?: string;
  valid?: boolean;
  displayName?: string;
  settings?: Settings;
  nextAction?: Action;
  children?: Action[];
  firstLoopAction?: Action;
  [key: string]: any;
}

export interface Settings {
  pieceName?: string;
  pieceVersion?: string;
  triggerName?: string;
  actionName?: string;
  input?: Record<string, any>;
  propertySettings?: Record<string, { type: string }>;
  [key: string]: any;
}

interface PieceRegistry {
  [pieceName: string]: {
    name: string;
    version: string;
    triggers?: Array<{ name: string; displayName: string }>;
    actions?: Array<{ name: string; displayName: string }>;
  };
}

export class RobustFlowPostProcessor {
  private targetSchemaVersion: string;
  private registry: PieceRegistry | null = null;
  private embeddingMatcher: EmbeddingMatcher | null = null;
  private readonly useEmbeddings: boolean;

  // Default versions (fallback if registry not available)
  private static readonly DEFAULT_VERSIONS: Record<string, string> = {
    '@activepieces/piece-google-sheets': '~0.12.20',
    '@activepieces/piece-text-ai': '~0.4.8',
    '@activepieces/piece-gmail': '~0.9.6',
    '@activepieces/piece-slack': '~0.10.16',
    '@activepieces/piece-schedule': '~0.1.13',
    '@activepieces/piece-utility-ai': '~0.5.9',
    '@activepieces/piece-google-drive': '~0.5.52',
    '@activepieces/piece-hubspot': '~0.7.19',
    '@activepieces/piece-date-helper': '~0.1.19',
    '@activepieces/piece-forms': '~0.4.10',
    '@activepieces/piece-webhook': '~0.1.25',
    '@activepieces/piece-telegram-bot': '~0.3.21',
    '@activepieces/piece-store': '~0.6.10',
    '@activepieces/piece-http': '~0.9.5',
    '@activepieces/piece-notion': '~0.4.13',
    '@activepieces/piece-tables': '~0.2.8',
    '@activepieces/piece-openai': '~0.6.7',
    '@activepieces/piece-salesforce': '~0.2.1',
    '@activepieces/piece-pipedrive': '~0.7.7',
    '@activepieces/piece-data-mapper': '~0.3.11',
    '@activepieces/piece-google-forms': '~0.3.13',
    '@activepieces/piece-ai': '~0.0.2',
  };

  // Hardcoded trigger fixes (fastest path) - matches Python robust_post_processor.py
  private static readonly TRIGGER_FIXES: Record<string, Record<string, string>> = {
    '@activepieces/piece-google-sheets': {
      new_row: 'googlesheets_new_row_added',
      newRow: 'googlesheets_new_row_added',
      'new-row': 'googlesheets_new_row_added',
      new_or_updated_row: 'google-sheets-new-or-updated-row',
    },
    '@activepieces/piece-gmail': {
      new_email: 'gmail_new_email_received',
      newEmail: 'gmail_new_email_received',
      'new-email': 'gmail_new_email_received',
      new_email_received: 'gmail_new_email_received',
      newEmailReceived: 'gmail_new_email_received',
      'new-email-received': 'gmail_new_email_received',
    },
    '@activepieces/piece-slack': {
      new_message: 'new-message-in-channel',
      newMessage: 'new-message-in-channel',
      'new-message': 'new-message-in-channel',
      new_message_typical: 'new-message-in-channel',
      newMessageTypical: 'new-message-in-channel',
      new_message_threaded: 'new-message-in-channel',
      newMessageThreaded: 'new-message-in-channel',
      new_message_in_channel: 'new-message-in-channel',
      newMessageInChannel: 'new-message-in-channel',
      new_command: 'new_command',
      newCommand: 'new_command',
      new_mention: 'new_mention',
      newMention: 'new_mention',
      new_reaction: 'new_reaction_added',
      newReaction: 'new_reaction_added',
      new_reaction_added: 'new_reaction_added',
      newReactionAdded: 'new_reaction_added',
    },
    '@activepieces/piece-github': {
      github_new_issue: 'trigger_issues',
      new_issue: 'trigger_issues',
      githubNewIssue: 'trigger_issues',
      github_new_pull_request: 'trigger_pull_request',
      new_pull_request: 'trigger_pull_request',
      githubNewPullRequest: 'trigger_pull_request',
      github_push: 'trigger_push',
      push: 'trigger_push',
      github_star: 'trigger_star',
      star: 'trigger_star',
    },
    '@activepieces/piece-google-calendar': {
      google_calendar_new_event: 'new_event',
      googleCalendarNewEvent: 'new_event',
      newEvent: 'new_event',
      'new-event': 'new_event',
      calendar_event: 'new_event',
      new_or_updated_event: 'new_or_updated_event',
      event_starts: 'event_starts_in',
      event_starts_in: 'event_starts_in',
      eventStartsIn: 'event_starts_in',
    },
    '@activepieces/piece-forms': {
      new_form_submission: 'form_submission',
      newSubmission: 'form_submission',
    },
    '@activepieces/piece-webhook': {
      catch_request: 'catch_webhook',
      webhook: 'catch_webhook',
    },
    '@activepieces/piece-hubspot': {
      new_contact: 'new-contact',
      newContact: 'new-contact',
    },
    '@activepieces/piece-google-drive': {
      new_file: 'new_file',
      newFile: 'new_file',
      'new-file': 'new_file',
      new_folder: 'new_folder',
      newFolder: 'new_folder',
    },
  };

  // Hardcoded action fixes - matches Python robust_post_processor.py
  private static readonly ACTION_FIXES: Record<string, Record<string, string>> = {
    '@activepieces/piece-google-sheets': {
      insertRow: 'insert_row',
      'insert-row': 'insert_row',
      updateRow: 'update_row',
      'update-row': 'update_row',
      findRows: 'find_rows',
      'find-rows': 'find_rows',
      deleteRow: 'delete_row',
      'delete-row': 'delete_row',
      getManyRows: 'get-many-rows',
      get_many_rows: 'get-many-rows',
    },
    '@activepieces/piece-gmail': {
      sendEmail: 'send_email',
      'send-email': 'send_email',
      compose_and_send_email: 'send_email',
      composeAndSendEmail: 'send_email',
      compose_email: 'send_email',
      composeEmail: 'send_email',
      get_mail: 'gmail_get_mail',
      getMail: 'gmail_get_mail',
      get_email: 'gmail_get_mail',
      getEmail: 'gmail_get_mail',
      search_mail: 'gmail_search_mail',
      searchMail: 'gmail_search_mail',
      search_email: 'gmail_search_mail',
      searchEmail: 'gmail_search_mail',
      find_email: 'gmail_search_mail',
      findEmail: 'gmail_search_mail',
      get_thread: 'gmail_get_thread',
      getThread: 'gmail_get_thread',
    },
    '@activepieces/piece-slack': {
      sendMessage: 'send_channel_message',
      send_message: 'send_channel_message',
      sendChannelMessage: 'send_channel_message',
      post_message: 'send_channel_message',
      postMessage: 'send_channel_message',
      notify_channel: 'send_channel_message',
      notifyChannel: 'send_channel_message',
      notify: 'send_channel_message',
      alert_channel: 'send_channel_message',
      alertChannel: 'send_channel_message',
      broadcast: 'send_channel_message',
      broadcast_message: 'send_channel_message',
      post_to_channel: 'send_channel_message',
      postToChannel: 'send_channel_message',
      send_dm: 'send_direct_message',
      sendDm: 'send_direct_message',
      send_direct: 'send_direct_message',
      sendDirect: 'send_direct_message',
      sendDirectMessage: 'send_direct_message',
      update_message: 'update-message',
      updateMessage: 'update-message',
      get_channel_history: 'getChannelHistory',
      getChannelHistory: 'getChannelHistory',
      get_thread: 'retrieveThreadMessages',
      getThread: 'retrieveThreadMessages',
      retrieve_thread: 'retrieveThreadMessages',
      retrieveThread: 'retrieveThreadMessages',
    },
    '@activepieces/piece-google-drive': {
      store_file: 'upload_gdrive_file',
      storeFile: 'upload_gdrive_file',
      upload_file: 'upload_gdrive_file',
      uploadFile: 'upload_gdrive_file',
      'upload-file': 'upload_gdrive_file',
      save_file: 'upload_gdrive_file',
      saveFile: 'upload_gdrive_file',
      create_file: 'upload_gdrive_file',
      createFile: 'upload_gdrive_file',
      create_folder: 'create_folder',
      createFolder: 'create_folder',
      'create-folder': 'create_folder',
      delete_file: 'trash_gdrive_file',
      deleteFile: 'trash_gdrive_file',
      trash_file: 'trash_gdrive_file',
      trashFile: 'trash_gdrive_file',
      get_file: 'get-file-or-folder-by-id',
      getFile: 'get-file-or-folder-by-id',
      read_file: 'read-file',
      readFile: 'read-file',
      list_files: 'list-files',
      listFiles: 'list-files',
      search_file: 'search-folder',
      searchFile: 'search-folder',
      find_file: 'search-folder',
      findFile: 'search-folder',
    },
    '@activepieces/piece-google-calendar': {
      create_event: 'create_google_calendar_event',
      createEvent: 'create_google_calendar_event',
      'create-event': 'create_google_calendar_event',
      add_event: 'create_google_calendar_event',
      addEvent: 'create_google_calendar_event',
      get_event: 'google_calendar_get_event_by_id',
      getEvent: 'google_calendar_get_event_by_id',
      find_event: 'google_calendar_get_event_by_id',
      findEvent: 'google_calendar_get_event_by_id',
      quick_event: 'create_quick_event',
      quickEvent: 'create_quick_event',
    },
    '@activepieces/piece-store': {
      get_value: 'get',
      getValue: 'get',
      get_next_row: 'get',
      getNextRow: 'get',
      put_value: 'put',
      putValue: 'put',
      set_value: 'put',
      setValue: 'put',
      store_value: 'put',
      storeValue: 'put',
      save_value: 'put',
      saveValue: 'put',
      add_to_list: 'add_to_list',
      addToList: 'add_to_list',
      append_to_list: 'add_to_list',
      appendToList: 'add_to_list',
      remove_value: 'remove_value',
      removeValue: 'remove_value',
      delete_value: 'remove_value',
      deleteValue: 'remove_value',
    },
    '@activepieces/piece-text-ai': {
      ask_ai: 'askAi',
      'ask-ai': 'askAi',
      summarize_text: 'summarizeText',
      'summarize-text': 'summarizeText',
    },
    '@activepieces/piece-openai': {
      askChatGpt: 'ask_chatgpt',
      'ask-chatgpt': 'ask_chatgpt',
      ask_chatgpt: 'ask_chatgpt',
      textToSpeech: 'text_to_speech',
      visionPrompt: 'vision_prompt',
    },
    '@activepieces/piece-http': {
      sendRequest: 'send_request',
      'send-request': 'send_request',
    },
    '@activepieces/piece-data-mapper': {
      advancedMapping: 'advanced_mapping',
      'advanced-mapping': 'advanced_mapping',
    },
  };

  // Field name conversions by piece - matches Python robust_post_processor.py
  private static readonly FIELD_CONVERSIONS: Record<string, Record<string, string>> = {
    '@activepieces/piece-google-sheets': {
      spreadsheet_id: 'spreadsheetId',
      sheet_id: 'sheetId',
      row_id: 'rowId',
      first_row_headers: 'firstRowHeaders',
      include_team_drives: 'includeTeamDrives',
      column_name: 'columnName',
    },
    '@activepieces/piece-gmail': {
      bodyType: 'body_type',
      replyTo: 'reply_to',
    },
    '@activepieces/piece-schedule': {
      hourOfTheDay: 'hour_of_the_day',
      runOnWeekends: 'run_on_weekends',
      dayOfTheWeek: 'day_of_the_week',
    },
    '@activepieces/piece-google-forms': {
      formId: 'form_id',
      includeTeamDrives: 'include_team_drives',
    },
    '@activepieces/piece-openai': {
      max_tokens: 'maxTokens',
      frequency_penalty: 'frequencyPenalty',
    },
  };

  constructor(targetSchemaVersion: string = '10', useEmbeddings: boolean = false) {
    this.targetSchemaVersion = targetSchemaVersion;
    // Disable embeddings by default - Python server handles this
    this.useEmbeddings = useEmbeddings;
    this.loadRegistry();
    if (useEmbeddings) {
      // Will always load from activepieces_embedding_model/
      // If not found, it logs a warning and disables embeddings gracefully
      this.embeddingMatcher = getEmbeddingMatcher(0.7);
    }
  }

  private loadRegistry(): void {
    const possiblePaths = [
      path.join(process.cwd(), 'piece_registry.json'),
      path.join(__dirname, '../../../../../piece_registry.json'),
    ];

    for (const registryPath of possiblePaths) {
      try {
        if (fs.existsSync(registryPath)) {
          const content = fs.readFileSync(registryPath, 'utf-8');
          this.registry = JSON.parse(content);
          return;
        }
      } catch (error) {
        // Continue to next path
      }
    }
  }

  async process(flowJson: Flow | { template: Flow }): Promise<Flow | { template: Flow }> {
    // Deep copy
    const flow = JSON.parse(JSON.stringify(flowJson));

    // Check if this is a FlowTemplate format
    if ('template' in flow && flow.template && 'trigger' in flow.template) {
      flow.template = await this.processFlow(flow.template);
      return flow;
    } else {
      return await this.processFlow(flow as Flow);
    }
  }

  private async processFlow(flow: Flow): Promise<Flow> {
    // 1. Fix root level
    flow = this.fixRootLevel(flow);

    // 2. Fix trigger
    if (flow.trigger) {
      flow.trigger = await this.fixTrigger(flow.trigger);
    }

    // 3. Fix actions recursively
    if (flow.trigger?.nextAction) {
      flow.trigger.nextAction = await this.fixAction(flow.trigger.nextAction);
    }

    return flow;
  }

  private fixRootLevel(flow: Flow): Flow {
    // Fix name -> displayName
    if (flow.name && !flow.displayName) {
      flow.displayName = flow.name;
    }

    // Ensure displayName exists
    if (!flow.displayName) {
      flow.displayName = 'Untitled Flow';
    }

    // Fix schemaVersion
    if (!flow.schemaVersion || flow.schemaVersion === null) {
      flow.schemaVersion = this.targetSchemaVersion;
    }

    return flow;
  }

  private async fixTrigger(trigger: Trigger): Promise<Trigger> {
    // Ensure required fields
    if (!trigger.type) trigger.type = 'PIECE_TRIGGER';
    if (trigger.valid === undefined) trigger.valid = true;
    if (!trigger.name) trigger.name = 'trigger';
    if (!trigger.displayName) trigger.displayName = 'Trigger';

    // Fix settings
    if (trigger.settings) {
      trigger.settings = await this.fixSettings(trigger.settings, true);
    }

    return trigger;
  }

  private async fixAction(action: Action | null | undefined): Promise<Action | undefined> {
    if (!action) return undefined;

    // Fix action type: CONDITION -> ROUTER
    if (action.type === 'CONDITION') {
      action.type = 'ROUTER';
      this.ensureRouterStructure(action);
    }

    // Ensure required fields
    if (!action.type) action.type = 'PIECE';
    if (action.valid === undefined) action.valid = true;
    if (!action.displayName) action.displayName = action.name || 'Action';

    // Fix settings
    if (action.settings && action.type === 'PIECE') {
      action.settings = await this.fixSettings(action.settings, false);
    }

    // Clean up UI-only fields
    this.removeUIFields(action);

    // Fix nextAction recursively
    if (action.nextAction) {
      action.nextAction = await this.fixAction(action.nextAction);
    }

    // Fix children (for ROUTER)
    if (action.children) {
      const fixedChildren = await Promise.all(
        action.children.map(child => this.fixAction(child))
      );
      action.children = fixedChildren.filter((c): c is Action => c !== undefined);
    }

    // Fix firstLoopAction (for LOOP_ON_ITEMS)
    if (action.firstLoopAction) {
      action.firstLoopAction = await this.fixAction(action.firstLoopAction);
    }

    return action;
  }

  private async fixSettings(settings: Settings, isTrigger: boolean): Promise<Settings> {
    const pieceName = settings.pieceName || '';

    // 1. Fix version from registry or defaults
    if (this.registry && pieceName in this.registry) {
      settings.pieceVersion = `~${this.registry[pieceName].version}`;
    } else if (RobustFlowPostProcessor.DEFAULT_VERSIONS[pieceName]) {
      settings.pieceVersion = RobustFlowPostProcessor.DEFAULT_VERSIONS[pieceName];
    } else if (!settings.pieceVersion) {
      settings.pieceVersion = '~1.0.0';
    }

    // 2. Fix trigger/action name
    if (isTrigger && settings.triggerName) {
      settings.triggerName = await this.fixTriggerName(pieceName, settings.triggerName);
    } else if (!isTrigger && settings.actionName) {
      settings.actionName = await this.fixActionName(pieceName, settings.actionName);
    }

    // 3. Ensure input exists
    if (!settings.input) {
      settings.input = {};
    }

    // 4. Fix field names
    settings.input = this.fixFieldNames(pieceName, settings.input);

    // 5. Ensure propertySettings exists
    if (!settings.propertySettings) {
      settings.propertySettings = {};
    }

    // 6. Update propertySettings for all input fields
    for (const fieldName of Object.keys(settings.input)) {
      if (!settings.propertySettings[fieldName]) {
        settings.propertySettings[fieldName] = { type: 'MANUAL' };
      }
    }

    // 7. Remove UI-only fields
    const uiFields = ['sampleData', 'inputUiInfo', 'pieceType', 'packageType', 'sampleDataUiInfo'];
    for (const field of uiFields) {
      delete (settings as any)[field];
    }

    return settings;
  }

  private async fixTriggerName(pieceName: string, triggerName: string): Promise<string> {
    // 1. Hardcoded fixes (fastest)
    if (RobustFlowPostProcessor.TRIGGER_FIXES[pieceName]?.[triggerName]) {
      return RobustFlowPostProcessor.TRIGGER_FIXES[pieceName][triggerName];
    }

    // 2. Piece registry lookup with pattern matching
    if (this.registry && this.registry[pieceName]?.triggers) {
      const availableTriggers = this.registry[pieceName].triggers!.map(t => t.name);
      const match = NameMatcher.findBestMatch(triggerName, availableTriggers, 0.5);
      if (match) {
        return match[0];
      }
    }

    // 3. Embedding-based semantic matching (fallback)
    if (this.embeddingMatcher && this.registry && this.registry[pieceName]?.triggers) {
      const availableTriggers = this.registry[pieceName].triggers!.map(t => t.name);
      const embMatch = await this.embeddingMatcher.findBestMatch(triggerName, availableTriggers, pieceName);
      if (embMatch) {
        return embMatch[0];
      }
    }

    return triggerName;
  }

  private async fixActionName(pieceName: string, actionName: string): Promise<string> {
    // 1. Hardcoded fixes (fastest)
    if (RobustFlowPostProcessor.ACTION_FIXES[pieceName]?.[actionName]) {
      return RobustFlowPostProcessor.ACTION_FIXES[pieceName][actionName];
    }

    // 2. Piece registry lookup with pattern matching
    if (this.registry && this.registry[pieceName]?.actions) {
      const availableActions = this.registry[pieceName].actions!.map(a => a.name);
      const match = NameMatcher.findBestMatch(actionName, availableActions, 0.5);
      if (match) {
        return match[0];
      }
    }

    // 3. Embedding-based semantic matching (fallback)
    if (this.embeddingMatcher && this.registry && this.registry[pieceName]?.actions) {
      const availableActions = this.registry[pieceName].actions!.map(a => a.name);
      const embMatch = await this.embeddingMatcher.findBestMatch(actionName, availableActions, pieceName);
      if (embMatch) {
        return embMatch[0];
      }
    }

    return actionName;
  }

  private ensureRouterStructure(action: Action): void {
    if (!action.settings) {
      action.settings = {};
    }

    if (!(action.settings as any).branches) {
      const conditions = (action.settings as any).conditions;
      if (conditions) {
        (action.settings as any).branches = [
          {
            branchType: 'CONDITION',
            branchName: 'Branch 1',
            conditions,
          },
          {
            branchType: 'FALLBACK',
            branchName: 'Otherwise',
          },
        ];
      } else {
        (action.settings as any).branches = [
          {
            branchType: 'FALLBACK',
            branchName: 'Otherwise',
          },
        ];
      }
    }

    // Ensure executionType is set
    if (!(action.settings as any).executionType) {
      (action.settings as any).executionType = 'EXECUTE_FIRST_MATCH';
    }
  }

  private fixFieldNames(pieceName: string, inputData: Record<string, any>): Record<string, any> {
    if (!RobustFlowPostProcessor.FIELD_CONVERSIONS[pieceName]) {
      return inputData;
    }

    const conversions = RobustFlowPostProcessor.FIELD_CONVERSIONS[pieceName];
    const fixed: Record<string, any> = {};

    for (const [key, value] of Object.entries(inputData)) {
      if (conversions[key]) {
        fixed[conversions[key]] = value;
      } else {
        fixed[key] = value;
      }
    }

    return fixed;
  }

  private removeUIFields(obj: any): void {
    const uiFields = ['sampleData', 'inputUiInfo', 'pieceType', 'packageType', 'sampleDataSettings', 'sampleDataUiInfo'];
    for (const field of uiFields) {
      delete obj[field];
    }
  }

  /**
   * Validate a processed flow
   */
  validate(flow: Flow | { template: Flow }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if it's FlowTemplate format
    const rawFlow = 'template' in flow ? flow.template : flow;

    // Check root level
    if (!rawFlow.displayName) {
      errors.push("Missing 'displayName' at root level");
    }

    if (!rawFlow.schemaVersion) {
      errors.push("Missing 'schemaVersion'");
    }

    // Check trigger
    if (!rawFlow.trigger) {
      errors.push("Missing 'trigger'");
    } else {
      const trigger = rawFlow.trigger;
      for (const field of ['name', 'type', 'valid', 'displayName', 'settings']) {
        if (!(field in trigger)) {
          errors.push(`Trigger missing '${field}'`);
        }
      }

      if (trigger.settings && trigger.type === 'PIECE_TRIGGER') {
        for (const field of ['pieceName', 'pieceVersion', 'triggerName']) {
          if (!(field in trigger.settings)) {
            errors.push(`Trigger settings missing '${field}'`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Process a JSON string (handles markdown code fences, etc.)
   */
  async processString(jsonStr: string): Promise<Flow | { template: Flow }> {
    let cleaned = jsonStr.trim();

    // Remove markdown code fences
    if (cleaned.includes('```json')) {
      const match = cleaned.match(/```json\s*(.*?)\s*```/s);
      if (match) {
        cleaned = match[1].trim();
      }
    } else if (cleaned.includes('```')) {
      const match = cleaned.match(/```\s*(.*?)\s*```/s);
      if (match) {
        cleaned = match[1].trim();
      }
    }

    // Try to find JSON object boundaries
    if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
      let braceCount = 0;
      let lastBrace = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') braceCount++;
        if (cleaned[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastBrace = i;
            break;
          }
        }
      }
      if (lastBrace > 0) {
        cleaned = cleaned.substring(0, lastBrace + 1);
      }
    }

    // Parse JSON
    let flow: Flow;
    try {
      flow = JSON.parse(cleaned);
    } catch (e) {
      // Try to extract just the JSON part
      const startIdx = cleaned.indexOf('{');
      if (startIdx >= 0) {
        flow = JSON.parse(cleaned.substring(startIdx));
      } else {
        throw new Error(`Invalid JSON: ${e}`);
      }
    }

    return this.process(flow);
  }
}

