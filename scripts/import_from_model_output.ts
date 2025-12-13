#!/usr/bin/env npx ts-node
/**
 * CLI Script: Import Flow from Model Output
 * 
 * Usage:
 *   npx ts-node scripts/import_from_model_output.ts <projectId> [model_output.txt]
 * 
 * Environment Variables:
 *   AP_BASE_URL - API base URL (default: http://localhost:4200/api/v1)
 *   AP_API_KEY  - API key for authentication
 * 
 * Example:
 *   AP_API_KEY=your-key npx ts-node scripts/import_from_model_output.ts abc123 model_output.txt
 */

import * as fs from 'fs';
import * as path from 'path';

// Import the post-processor
import {
  importFlowToProject,
  extractJsonCandidate,
  normalizeToImportFlowRequest,
  buildImportPayload,
  generateFlowTemplateFile,
  runSanityTests,
} from '../src/opsyn/flowPostProcessor';

// Configuration
const AP_BASE_URL = process.env.AP_BASE_URL || 'http://localhost:4200/api/v1';

async function main() {
  const args = process.argv.slice(2);

  // Handle special commands
  if (args[0] === '--test') {
    runSanityTests();
    process.exit(0);
  }

  if (args[0] === '--help' || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  if (args[0] === '--dry-run') {
    // Dry run mode: just parse and show what would be imported
    const inputFile = args[1] || 'model_output.txt';
    await dryRun(inputFile);
    process.exit(0);
  }

  if (args[0] === '--generate-template') {
    // Generate FlowTemplate JSON file for UI import
    const inputFile = args[1] || 'model_output.txt';
    const outputFile = args[2] || 'flow_template.json';
    await generateTemplate(inputFile, outputFile);
    process.exit(0);
  }

  // Normal import mode
  const projectId = args[0];
  const inputFile = args[1] || 'model_output.txt';

  // Validate environment
  if (!process.env.AP_API_KEY) {
    console.error('Error: AP_API_KEY environment variable is required');
    console.error('');
    console.error('Set it like this:');
    console.error('  export AP_API_KEY=your-api-key');
    console.error('  # or');
    console.error('  AP_API_KEY=your-key npx ts-node scripts/import_from_model_output.ts ...');
    process.exit(1);
  }

  // Read input file
  const rawOutput = readInputFile(inputFile);
  if (!rawOutput) {
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Flow Import from Model Output');
  console.log('='.repeat(60));
  console.log(`Project ID: ${projectId}`);
  console.log(`Input File: ${inputFile}`);
  console.log(`API URL:    ${AP_BASE_URL}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    const result = await importFlowToProject(projectId, rawOutput);

    console.log('');
    console.log('='.repeat(60));
    console.log('SUCCESS!');
    console.log('='.repeat(60));
    console.log(`Flow ID:      ${result.flowId}`);
    console.log(`Display Name: ${result.displayName}`);
    console.log('');
    console.log(`View in UI:   ${AP_BASE_URL.replace('/api/v1', '')}/flows/${result.flowId}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('FAILED!');
    console.error('='.repeat(60));
    
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      
      // Show more details for API errors
      if ('response' in error) {
        const axiosError = error as { response?: { status: number; data: unknown } };
        if (axiosError.response) {
          console.error(`Status: ${axiosError.response.status}`);
          console.error('Response:', JSON.stringify(axiosError.response.data, null, 2));
        }
      }
    } else {
      console.error('Unknown error:', error);
    }
    
    console.error('='.repeat(60));
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: npx ts-node scripts/import_from_model_output.ts [options] <projectId> [input_file]

Arguments:
  projectId     The Activepieces project ID to import the flow into
  input_file    Path to file containing model output (default: model_output.txt)

Options:
  --help              Show this help message
  --test              Run sanity tests
  --dry-run           Parse and show the payload without importing
  --generate-template Generate FlowTemplate JSON file for UI import
                      Usage: --generate-template [input_file] [output_file]

Environment Variables:
  AP_BASE_URL   API base URL (default: http://localhost:4200/api/v1)
  AP_API_KEY    API key for authentication (required for import, not needed for --generate-template)

Examples:
  # Run tests
  npx ts-node scripts/import_from_model_output.ts --test

  # Dry run to see parsed output
  npx ts-node scripts/import_from_model_output.ts --dry-run model_output.txt

  # Generate FlowTemplate JSON for UI import (no API key needed!)
  npx ts-node scripts/import_from_model_output.ts --generate-template model_output.txt flow_template.json

  # Import a flow via API (requires API key)
  AP_API_KEY=sk_xxx npx ts-node scripts/import_from_model_output.ts proj_abc123 model_output.txt

  # Import with custom API URL
  AP_BASE_URL=https://app.activepieces.com/api/v1 AP_API_KEY=sk_xxx \\
    npx ts-node scripts/import_from_model_output.ts proj_abc123 model_output.txt
`);
}

function readInputFile(filePath: string): string | null {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Input file not found: ${resolvedPath}`);
    return null;
  }

  try {
    return fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file: ${(error as Error).message}`);
    return null;
  }
}

async function dryRun(inputFile: string) {
  const rawOutput = readInputFile(inputFile);
  if (!rawOutput) {
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Dry Run: Parse Model Output');
  console.log('='.repeat(60));
  console.log(`Input File: ${inputFile}`);
  console.log('');

  console.log('--- Raw Input (first 500 chars) ---');
  console.log(rawOutput.substring(0, 500));
  if (rawOutput.length > 500) {
    console.log(`... (${rawOutput.length - 500} more characters)`);
  }
  console.log('');

  try {
    console.log('--- Step 1: Extract JSON ---');
    const jsonCandidate = extractJsonCandidate(rawOutput);
    console.log('Extracted JSON keys:', Object.keys(jsonCandidate as object));
    console.log('');

    console.log('--- Step 2: Normalize ---');
    const normalized = normalizeToImportFlowRequest(jsonCandidate);
    console.log(`Display Name: ${normalized.displayName}`);
    console.log(`Trigger Type: ${normalized.trigger.type}`);
    console.log(`Trigger Name: ${normalized.trigger.name}`);
    console.log(`Has NextAction: ${!!normalized.trigger.nextAction}`);
    console.log('');

    console.log('--- Step 3: Build Payload ---');
    const payload = buildImportPayload(normalized);
    console.log('');
    console.log('--- Final Payload ---');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');

    console.log('='.repeat(60));
    console.log('Dry run complete. Use without --dry-run to import.');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('');
    console.error('--- Error ---');
    console.error((error as Error).message);
    process.exit(1);
  }
}

async function generateTemplate(inputFile: string, outputFile: string) {
  const rawOutput = readInputFile(inputFile);
  if (!rawOutput) {
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Generate FlowTemplate for UI Import');
  console.log('='.repeat(60));
  console.log(`Input File:  ${inputFile}`);
  console.log(`Output File: ${outputFile}`);
  console.log('');

  try {
    console.log('Processing model output...');
    const templateJson = generateFlowTemplateFile(rawOutput);
    
    console.log('Writing FlowTemplate file...');
    fs.writeFileSync(outputFile, templateJson, 'utf-8');
    
    console.log('');
    console.log('='.repeat(60));
    console.log('SUCCESS!');
    console.log('='.repeat(60));
    console.log(`FlowTemplate saved to: ${outputFile}`);
    console.log('');
    console.log('To import in the UI:');
    console.log('  1. Open Activepieces UI');
    console.log('  2. Click "New Flow" → "From local file"');
    console.log('  3. Select the generated JSON file');
    console.log('  4. Click "Import"');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('FAILED!');
    console.error('='.repeat(60));
    console.error((error as Error).message);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run
main().catch(console.error);

