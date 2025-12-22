/**
 * OPSYN Pipeline Tests
 * 
 * Tests the complete workflow generation pipeline.
 */

import {
  processModelOutputToFlowTemplate,
  processModelOutputToFlowTemplateObject,
  validateFlowTemplate,
  generateFullPrompt,
  OPSYN_SYSTEM_PROMPT,
} from './opsyn-pipeline';

// Test cases matching Python robust_post_processor.py
const TEST_CASES = [
  {
    name: 'GitHub Issue Trigger (Wrong Name)',
    input: JSON.stringify({
      displayName: 'New Issue Trigger',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-github',
          triggerName: 'github_new_issue',  // Wrong - should be trigger_issues
          pieceVersion: '~0.5.11',
        },
      },
      schemaVersion: null,  // Should be set to "10"
    }),
    expected: {
      triggerName: 'trigger_issues',
      schemaVersion: '10',
    },
  },
  {
    name: 'Slack Message Trigger',
    input: JSON.stringify({
      displayName: 'Slack Notification',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-slack',
          triggerName: 'new_message',  // Wrong - should be new-message-in-channel
          pieceVersion: '~0.9.4',  // Old version
        },
      },
      schemaVersion: null,
    }),
    expected: {
      triggerName: 'new-message-in-channel',
      pieceVersion: '~0.10.16',
      schemaVersion: '10',
    },
  },
  {
    name: 'Google Sheets Trigger',
    input: JSON.stringify({
      displayName: 'New Row Added',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-google-sheets',
          triggerName: 'new_row',  // Wrong - should be googlesheets_new_row_added
          pieceVersion: '~0.1.1',  // Old version
        },
      },
      schemaVersion: null,
    }),
    expected: {
      triggerName: 'googlesheets_new_row_added',
      pieceVersion: '~0.12.20',
      schemaVersion: '10',
    },
  },
  {
    name: 'Slack Action',
    input: JSON.stringify({
      displayName: 'Send Message',
      trigger: {
        name: 'trigger',
        type: 'EMPTY',
        valid: true,
        displayName: 'Trigger',
        settings: {},
        nextAction: {
          name: 'step_1',
          type: 'PIECE',
          valid: true,
          displayName: 'Send Message',
          settings: {
            pieceName: '@activepieces/piece-slack',
            actionName: 'notify_channel',  // Wrong - should be send_channel_message
            pieceVersion: '~0.9.4',
          },
        },
      },
      schemaVersion: null,
    }),
    expected: {
      actionName: 'send_channel_message',
      pieceVersion: '~0.10.16',
      schemaVersion: '10',
    },
  },
  {
    name: 'Markdown Code Fence Input',
    input: '```json\n' + JSON.stringify({
      displayName: 'Test Flow',
      trigger: {
        name: 'trigger',
        type: 'PIECE_TRIGGER',
        valid: true,
        displayName: 'Trigger',
        settings: {
          pieceName: '@activepieces/piece-gmail',
          triggerName: 'new_email',
          pieceVersion: '~0.5.0',
        },
      },
      schemaVersion: null,
    }) + '\n```',
    expected: {
      triggerName: 'gmail_new_email_received',
      schemaVersion: '10',
    },
  },
  {
    name: 'CONDITION to ROUTER Conversion',
    input: JSON.stringify({
      displayName: 'Conditional Flow',
      trigger: {
        name: 'trigger',
        type: 'EMPTY',
        valid: true,
        displayName: 'Trigger',
        settings: {},
        nextAction: {
          name: 'step_1',
          type: 'CONDITION',  // Should be ROUTER
          valid: true,
          displayName: 'Check Condition',
          settings: {
            conditions: [
              { operator: 'eq', value: 'test' },
            ],
          },
        },
      },
      schemaVersion: null,
    }),
    expected: {
      actionType: 'ROUTER',
      hasBranches: true,
      schemaVersion: '10',
    },
  },
];

async function runTests() {
  console.log('🧪 Testing OPSYN Pipeline\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log('-'.repeat(60));

    try {
      // Run pipeline
      const template = await processModelOutputToFlowTemplateObject(testCase.input);
      const trigger = template.template.trigger;
      const action = trigger?.nextAction;

      let testPassed = true;
      const errors: string[] = [];

      // Check trigger fixes
      if (testCase.expected.triggerName) {
        const actual = trigger?.settings?.triggerName;
        if (actual !== testCase.expected.triggerName) {
          testPassed = false;
          errors.push(`Trigger name: expected "${testCase.expected.triggerName}", got "${actual}"`);
        }
      }

      // Check action fixes
      if (testCase.expected.actionName) {
        const actual = action?.settings?.actionName;
        if (actual !== testCase.expected.actionName) {
          testPassed = false;
          errors.push(`Action name: expected "${testCase.expected.actionName}", got "${actual}"`);
        }
      }

      // Check action type (for CONDITION -> ROUTER)
      if (testCase.expected.actionType) {
        const actual = action?.type;
        if (actual !== testCase.expected.actionType) {
          testPassed = false;
          errors.push(`Action type: expected "${testCase.expected.actionType}", got "${actual}"`);
        }
      }

      // Check branches (for ROUTER)
      if (testCase.expected.hasBranches) {
        const hasBranches = Array.isArray((action?.settings as any)?.branches);
        if (!hasBranches) {
          testPassed = false;
          errors.push('Expected branches array but not found');
        }
      }

      // Check version updates
      if (testCase.expected.pieceVersion) {
        const actual = trigger?.settings?.pieceVersion || action?.settings?.pieceVersion;
        if (actual !== testCase.expected.pieceVersion) {
          testPassed = false;
          errors.push(`Piece version: expected "${testCase.expected.pieceVersion}", got "${actual}"`);
        }
      }

      // Check schema version
      if (testCase.expected.schemaVersion) {
        const actual = template.template.schemaVersion;
        if (actual !== testCase.expected.schemaVersion) {
          testPassed = false;
          errors.push(`Schema version: expected "${testCase.expected.schemaVersion}", got "${actual}"`);
        }
      }

      if (testPassed) {
        console.log('  ✅ PASSED');
        passed++;
      } else {
        console.log('  ❌ FAILED');
        errors.forEach(e => console.log(`     - ${e}`));
        failed++;
      }

      // Show result summary
      console.log(`  📊 Result:`);
      console.log(`     - Flow name: ${template.name}`);
      console.log(`     - Schema version: ${template.template.schemaVersion}`);
      if (trigger?.settings?.triggerName) {
        console.log(`     - Trigger: ${trigger.settings.triggerName}`);
      }
      if (action?.settings?.actionName) {
        console.log(`     - Action: ${action.settings.actionName}`);
      }
      if (action?.type === 'ROUTER') {
        console.log(`     - Type: ROUTER (converted from CONDITION)`);
      }
      console.log(`     - Pieces: ${template.pieces.join(', ')}`);

    } catch (error) {
      console.log('  ❌ ERROR');
      console.log(`     ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  // Test system prompt
  console.log('\n' + '='.repeat(60));
  console.log('🔧 Testing System Prompt Generation');
  console.log('-'.repeat(60));

  const fullPrompt = generateFullPrompt('Create a workflow that sends Slack when new GitHub issue');
  console.log('  User prompt: "Create a workflow that sends Slack when new GitHub issue"');
  console.log(`  Full prompt includes system prompt: ${fullPrompt.includes(OPSYN_SYSTEM_PROMPT)}`);
  console.log(`  Full prompt length: ${fullPrompt.length} chars`);

  // Test validation
  console.log('\n' + '='.repeat(60));
  console.log('🔧 Testing Validation');
  console.log('-'.repeat(60));

  const sampleTemplate = await processModelOutputToFlowTemplateObject(TEST_CASES[0].input);
  const validation = validateFlowTemplate(sampleTemplate);
  console.log(`  Validation result: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
  if (validation.errors.length > 0) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Pipeline is working correctly.');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    return false;
  }
}

// Export for Jest or direct execution
export { runTests };

// Run if executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

