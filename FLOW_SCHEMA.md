# Activepieces Flow Schema Documentation

This document describes the valid schema for creating flows via the Activepieces API. This is useful for training models that need to output flow JSON compatible with the API.

## Overview

Creating a flow via API is a two-step process:
1. **Create Flow**: POST to `/flows` with basic flow metadata
2. **Import Flow Structure**: POST to `/flows/:id` with `IMPORT_FLOW` operation containing the full flow structure

## Step 1: Create Flow Request

**Endpoint**: `POST /flows`

**Schema**: `CreateFlowRequest`

```typescript
{
  displayName: string          // Required: Flow display name
  projectId: string            // Required: Project ID
  folderId?: string            // Optional: Folder ID (if provided, folderName is ignored)
  folderName?: string          // Optional: Folder name (will create folder if doesn't exist)
  metadata?: Metadata          // Optional: Flow metadata
}
```

**Response**: Returns a `PopulatedFlow` with an empty draft version.

## Step 2: Import Flow Structure

**Endpoint**: `POST /flows/:id`

**Schema**: `FlowOperationRequest` with type `IMPORT_FLOW`

```typescript
{
  type: "IMPORT_FLOW",
  request: {
    displayName: string        // Required: Flow display name
    trigger: FlowTrigger       // Required: Flow trigger (see below)
    schemaVersion?: string | null  // Optional: Schema version (defaults to latest)
  }
}
```

## FlowTrigger Schema

The `trigger` field is a union type that can be either:

### EmptyTrigger
```typescript
{
  type: "EMPTY",
  name: string                 // Required: Unique step name
  valid: boolean              // Required: Whether trigger is valid
  displayName: string         // Required: Display name
  settings: any               // Can be any value
  nextAction?: FlowAction     // Optional: Next action in the flow
}
```

### PieceTrigger
```typescript
{
  type: "PIECE_TRIGGER",
  name: string                 // Required: Unique step name
  valid: boolean              // Required: Whether trigger is valid
  displayName: string         // Required: Display name
  settings: {
    pieceName: string         // Required: e.g., "@activepieces/piece-webhook"
    pieceVersion: string      // Required: Semantic version (e.g., "1.0.0")
    triggerName?: string      // Optional: Specific trigger name
    input: Record<string, any>  // Required: Trigger input parameters
    propertySettings: Record<string, PropertySettings>  // Required: Property settings
    sampleData?: SampleDataSetting  // Optional: Sample data
    customLogoUrl?: string    // Optional: Custom logo URL
  },
  nextAction?: FlowAction     // Optional: Next action in the flow
}
```

## FlowAction Schema

Actions form a linked list structure via `nextAction`. Each action can be one of four types:

### Common Properties
All actions share these properties:
```typescript
{
  name: string                // Required: Unique step name
  valid: boolean             // Required: Whether action is valid
  displayName: string        // Required: Display name
  skip?: boolean             // Optional: Whether to skip this action
}
```

### 1. CODE Action
```typescript
{
  ...commonProperties,
  type: "CODE",
  settings: {
    sourceCode: {
      packageJson: string    // Required: package.json content
      code: string          // Required: JavaScript/TypeScript code
    },
    input: Record<string, any>  // Required: Input parameters
    errorHandlingOptions?: {
      continueOnFailure?: { value: boolean }
      retryOnFailure?: { value: boolean }
    },
    sampleData?: SampleDataSetting,
    customLogoUrl?: string
  },
  nextAction?: FlowAction   // Optional: Next action
}
```

### 2. PIECE Action
```typescript
{
  ...commonProperties,
  type: "PIECE",
  settings: {
    pieceName: string        // Required: e.g., "@activepieces/piece-http"
    pieceVersion: string     // Required: Semantic version
    actionName?: string      // Optional: Specific action name
    input: Record<string, any>  // Required: Action input parameters
    propertySettings: Record<string, PropertySettings>  // Required
    errorHandlingOptions?: {
      continueOnFailure?: { value: boolean }
      retryOnFailure?: { value: boolean }
    },
    sampleData?: SampleDataSetting,
    customLogoUrl?: string
  },
  nextAction?: FlowAction   // Optional: Next action
}
```

### 3. LOOP_ON_ITEMS Action
```typescript
{
  ...commonProperties,
  type: "LOOP_ON_ITEMS",
  settings: {
    items: string            // Required: Expression for items to loop over
    sampleData?: SampleDataSetting,
    customLogoUrl?: string
  },
  firstLoopAction?: FlowAction  // Optional: First action inside the loop
  nextAction?: FlowAction       // Optional: Action after loop completes
}
```

### 4. ROUTER Action
```typescript
{
  ...commonProperties,
  type: "ROUTER",
  settings: {
    executionType: "EXECUTE_ALL_MATCH" | "EXECUTE_FIRST_MATCH",
    branches: Array<{
      branchType: "CONDITION" | "FALLBACK",
      branchName: string,
      conditions?: Array<Array<BranchCondition>>  // Required for CONDITION type
    }>,
    sampleData?: SampleDataSetting,
    customLogoUrl?: string
  },
  children: Array<FlowAction | null>  // Required: Actions for each branch (same length as branches)
  nextAction?: FlowAction             // Optional: Action after router completes
}
```

## BranchCondition Schema

Used in ROUTER actions for conditional branches:

```typescript
{
  firstValue: string         // Required: First value to compare
  secondValue?: string       // Required for most operators (not for single-value conditions)
  operator: BranchOperator   // Required: Comparison operator
  caseSensitive?: boolean    // Optional: For text comparisons
}
```

### BranchOperator Values

**Text Operators**:
- `TEXT_CONTAINS`
- `TEXT_DOES_NOT_CONTAIN`
- `TEXT_EXACTLY_MATCHES`
- `TEXT_DOES_NOT_EXACTLY_MATCH`
- `TEXT_STARTS_WITH`
- `TEXT_DOES_NOT_START_WITH`
- `TEXT_ENDS_WITH`
- `TEXT_DOES_NOT_END_WITH`

**Number Operators**:
- `NUMBER_IS_GREATER_THAN`
- `NUMBER_IS_LESS_THAN`
- `NUMBER_IS_EQUAL_TO`

**Date Operators**:
- `DATE_IS_BEFORE`
- `DATE_IS_EQUAL`
- `DATE_IS_AFTER`

**Boolean Operators**:
- `BOOLEAN_IS_TRUE`
- `BOOLEAN_IS_FALSE`

**List Operators**:
- `LIST_CONTAINS`
- `LIST_DOES_NOT_CONTAIN`
- `LIST_IS_EMPTY`
- `LIST_IS_NOT_EMPTY`

**Existence Operators**:
- `EXISTS`
- `DOES_NOT_EXIST`

**Single-value conditions** (don't require `secondValue`):
- `EXISTS`, `DOES_NOT_EXIST`, `BOOLEAN_IS_TRUE`, `BOOLEAN_IS_FALSE`, `LIST_IS_EMPTY`, `LIST_IS_NOT_EMPTY`

## PropertySettings Schema

```typescript
{
  // Structure depends on property type, typically includes:
  // - Input validation rules
  // - UI display settings
  // - Default values
  // This is a flexible Record<string, any> structure
}
```

## SampleDataSetting Schema

```typescript
{
  // Structure for storing sample data
  // Used for testing and preview purposes
}
```

## Complete Example

Here's a complete example of creating a flow with a webhook trigger and an HTTP action:

```json
{
  "type": "IMPORT_FLOW",
  "request": {
    "displayName": "My Flow",
    "schemaVersion": null,
    "trigger": {
      "type": "PIECE_TRIGGER",
      "name": "trigger_1",
      "valid": true,
      "displayName": "Webhook Trigger",
      "settings": {
        "pieceName": "@activepieces/piece-webhook",
        "pieceVersion": "1.0.0",
        "triggerName": "webhook",
        "input": {},
        "propertySettings": {}
      },
      "nextAction": {
        "type": "PIECE",
        "name": "action_1",
        "valid": true,
        "displayName": "HTTP Request",
        "settings": {
          "pieceName": "@activepieces/piece-http",
          "pieceVersion": "1.0.0",
          "actionName": "send_request",
          "input": {
            "url": "https://api.example.com/endpoint",
            "method": "POST"
          },
          "propertySettings": {}
        }
      }
    }
  }
}
```

## FlowVersion Schema (for reference)

The complete `FlowVersion` structure returned by the API:

```typescript
{
  id: string                  // Flow version ID
  created: string             // ISO timestamp
  updated: string             // ISO timestamp
  flowId: string              // Parent flow ID
  displayName: string         // Flow display name
  trigger: FlowTrigger       // Flow trigger
  updatedBy: string | null    // User ID who last updated
  valid: boolean              // Whether flow is valid
  schemaVersion: string | null  // Schema version (e.g., "8")
  agentIds: string[]          // Array of agent IDs
  state: "LOCKED" | "DRAFT"   // Flow version state
  connectionIds: string[]     // Array of connection IDs
  backupFiles: Record<string, string> | null  // Backup file references
}
```

## Notes

1. **Step Names**: Each step (trigger or action) must have a unique `name` within the flow. These are typically generated IDs.

2. **Linked Structure**: Actions form a linked list via `nextAction`. For loops, use `firstLoopAction`. For routers, use `children` array.

3. **Router Children**: The `children` array in ROUTER actions must have the same length as the `branches` array. Each child corresponds to the action chain for that branch.

4. **Schema Version**: The latest schema version is `"8"` (as of `LATEST_FLOW_SCHEMA_VERSION`). You can omit this or set to `null` to use the latest.

5. **Validation**: The `valid` field should be set to `true` if all required fields are present and valid. The API will validate the flow structure.

6. **Expressions**: Many fields (like `items` in LOOP_ON_ITEMS) accept expressions that can reference previous step outputs using `{{stepName.output}}` syntax.

7. **Piece Names**: Piece names follow the format `@activepieces/piece-{name}` (e.g., `@activepieces/piece-http`, `@activepieces/piece-webhook`).

8. **Piece Versions**: Must be valid semantic versions (e.g., `"1.0.0"`, `"1.2.3"`).

## API Endpoints Summary

- `POST /flows` - Create a new flow (returns flow with empty draft version)
- `POST /flows/:id` - Apply operation to flow (use `IMPORT_FLOW` to set structure)
- `GET /flows/:id` - Get flow by ID
- `GET /flows` - List flows
- `DELETE /flows/:id` - Delete flow

## Authentication

All endpoints require authentication. Use either:
- User authentication (Bearer token)
- Service key authentication (API key)

