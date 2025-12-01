# Fixing projectId TypeScript Errors

## Pattern

For all project-specific route handlers that use `request.principal.projectId`, add this at the start of the handler:

```typescript
authenticationUtils.assertProjectId(request.principal)
```

This will:
1. Assert at runtime that projectId exists (throw error if null)
2. Narrow the TypeScript type so projectId is known to be `string` (not `string | null`)

## Steps

1. Add import at top of file:
```typescript
import { authenticationUtils } from '../authentication/authentication-utils'
```

2. Add assertion at start of each route handler that uses `request.principal.projectId`:
```typescript
app.get('/some-route', SomeRequest, async (request) => {
    authenticationUtils.assertProjectId(request.principal)
    // Now request.principal.projectId is typed as string, not string | null
    // ... rest of handler
})
```

## Special Cases

### Event Hooks
For `eventsHooks.get(request.log).sendUserEvent()`, use:
```typescript
projectId: response.projectId ?? undefined
```

### WebSockets
Check if projectId exists before using:
```typescript
if (principal.projectId) {
    await socket.join(principal.projectId)
}
```

### Optional projectId
If projectId is truly optional for the operation, handle the null case:
```typescript
if (request.principal.projectId) {
    // use projectId
} else {
    // handle no project case
}
```

## Files to Fix

All controller files that have errors. The pattern is consistent - add the assertion at the start of handlers that require projectId.

