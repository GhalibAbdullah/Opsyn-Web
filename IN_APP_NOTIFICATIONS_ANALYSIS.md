# In-App Notifications Implementation Analysis

## Executive Summary

**✅ YES, in-app notifications CAN be implemented** without deployment. The codebase already has most of the required infrastructure:
- ✅ WebSocket/Socket.IO infrastructure
- ✅ Toast notification system
- ✅ Flow run tracking and completion hooks
- ✅ Real-time event system

**What needs to be built:**
- ❌ Notification database entity/table
- ❌ Notification API endpoints
- ❌ Notification bell/badge UI component
- ❌ Notification center/dropdown UI
- ❌ WebSocket event for flow run completion notifications
- ❌ Per-workflow notification settings

---

## 1. Current Infrastructure Analysis

### 1.1 WebSocket Infrastructure ✅

**Location:** `packages/react-ui/src/components/socket-provider.tsx`
- Socket.IO client already configured
- Auto-reconnection enabled
- Token-based authentication
- Project-based room joining (`socket.join(projectId)`)

**Backend:** `packages/server/api/src/app/core/websockets.service.ts`
- Users join project rooms automatically
- Event listener system in place
- Can emit to project rooms: `app.io.to(projectId).emit(...)`

### 1.2 Toast Notification System ✅

**Location:** `packages/react-ui/src/components/ui/toast.tsx`
- Radix UI Toast component
- Supports variants (default, destructive)
- Already used throughout the app
- Can show temporary notifications

**Usage Example:**
```typescript
const { toast } = useToast();
toast({
  title: 'Flow Run Failed',
  description: 'Error details...',
  variant: 'destructive',
});
```

### 1.3 Flow Run Tracking ✅

**Flow Run Status Enum:** `packages/shared/src/lib/flow-run/execution/flow-execution.ts`
```typescript
enum FlowRunStatus {
  FAILED = 'FAILED',
  SUCCEEDED = 'SUCCEEDED',
  PAUSED = 'PAUSED',
  RUNNING = 'RUNNING',
  QUEUED = 'QUEUED',
  TIMEOUT = 'TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

**Flow Run Completion Hook:** `packages/server/api/src/app/flows/flow-run/flow-run-side-effects.ts`
- `onFinish()` hook fires when flow run completes
- Already emits `ApplicationEventName.FLOW_RUN_FINISHED` event
- Currently only used for enterprise alerts (email)

**Flow Run Entity:** `packages/server/api/src/app/flows/flow-run/flow-run-entity.ts`
- Stores: `status`, `failedStep`, `startTime`, `finishTime`, `projectId`, `flowId`
- All data needed for notifications is available

### 1.4 Existing WebSocket Events ✅

**Client Events:** `packages/shared/src/lib/websocket/index.ts`
- `FLOW_RUN_PROGRESS` - Already exists for real-time updates
- `TEST_STEP_FINISHED` - Used for test runs
- Pattern established for flow-related events

**Current Usage:** `packages/react-ui/src/app/builder/index.tsx`
```typescript
socket.on(WebsocketClientEvent.FLOW_RUN_PROGRESS, (data) => {
  // Updates run in real-time
});
```

---

## 2. What Needs to Be Built

### 2.1 Database Schema (NEW)

**Create Notification Entity:**

```typescript
// packages/server/api/src/app/notifications/notification-entity.ts
export const NotificationEntity = new EntitySchema<NotificationSchema>({
  name: 'notification',
  columns: {
    ...BaseColumnSchemaPart,
    userId: ApIdSchema, // User who should receive notification
    projectId: ApIdSchema,
    type: {
      type: String, // 'FLOW_RUN_FAILED', 'FLOW_RUN_SUCCEEDED', 'FLOW_RUN_PAUSED'
    },
    title: {
      type: String,
    },
    message: {
      type: String,
    },
    flowRunId: {
      ...ApIdSchema,
      nullable: true,
    },
    flowId: {
      ...ApIdSchema,
      nullable: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: TIMESTAMP_COLUMN_TYPE,
      nullable: true,
    },
    metadata: {
      type: JSONB_COLUMN_TYPE, // Store error details, failed step, etc.
      nullable: true,
    },
  },
  indices: [
    { name: 'idx_notification_user_id', columns: ['userId'] },
    { name: 'idx_notification_read', columns: ['userId', 'read'] },
    { name: 'idx_notification_created', columns: ['userId', 'created'] },
  ],
});
```

**Migration Required:**
- Create `notification` table
- Add indexes for performance

### 2.2 Backend API (NEW)

**Notification Service:** `packages/server/api/src/app/notifications/notification-service.ts`
```typescript
export const notificationService = {
  async create(notification: CreateNotificationRequest): Promise<Notification>,
  async list(userId: string, filters: { read?: boolean, limit?: number }): Promise<SeekPage<Notification>>,
  async markAsRead(notificationId: string, userId: string): Promise<void>,
  async markAllAsRead(userId: string): Promise<void>,
  async getUnreadCount(userId: string): Promise<number>,
};
```

**Notification Controller:** `packages/server/api/src/app/notifications/notification-controller.ts`
- `GET /v1/notifications` - List notifications
- `GET /v1/notifications/unread-count` - Get unread count
- `PATCH /v1/notifications/:id/read` - Mark as read
- `PATCH /v1/notifications/read-all` - Mark all as read

### 2.3 Flow Run Completion Integration (MODIFY)

**Modify:** `packages/server/api/src/app/flows/flow-run/flow-run-side-effects.ts`

```typescript
export const flowRunSideEffects = (log: FastifyBaseLogger) => ({
  async onFinish(flowRun: FlowRun): Promise<void> {
    // ... existing code ...
    
    // NEW: Create in-app notifications
    if (isFlowRunStateTerminal({ status: flowRun.status })) {
      await createFlowRunNotification(flowRun, log);
    }
  },
});

async function createFlowRunNotification(
  flowRun: FlowRun,
  log: FastifyBaseLogger,
): Promise<void> {
  // Get flow to get owner and notification settings
  const flow = await flowService.getOneOrThrow(flowRun.flowId);
  
  // Check if user wants notifications for this workflow
  // (per-workflow settings - can be stored in flow.metadata or separate table)
  
  // Create notification for flow owner
  const notification = await notificationService.create({
    userId: flow.ownerId,
    projectId: flowRun.projectId,
    type: getNotificationType(flowRun.status),
    title: getNotificationTitle(flowRun),
    message: getNotificationMessage(flowRun),
    flowRunId: flowRun.id,
    flowId: flowRun.flowId,
    metadata: {
      status: flowRun.status,
      failedStep: flowRun.failedStep,
      errorMessage: flowRun.failedStep?.message,
    },
  });
  
  // Emit WebSocket event to user
  await app.io.to(flowRun.projectId).emit(
    WebsocketClientEvent.FLOW_RUN_NOTIFICATION,
    notification,
  );
}
```

### 2.4 WebSocket Event (NEW)

**Add to:** `packages/shared/src/lib/websocket/index.ts`
```typescript
export enum WebsocketClientEvent {
  // ... existing events ...
  FLOW_RUN_NOTIFICATION = 'FLOW_RUN_NOTIFICATION', // NEW
  NOTIFICATION_COUNT_UPDATED = 'NOTIFICATION_COUNT_UPDATED', // NEW
}

export const FlowRunNotification = Type.Object({
  id: Type.String(),
  type: Type.String(),
  title: Type.String(),
  message: Type.String(),
  flowRunId: Type.String(),
  flowId: Type.String(),
  createdAt: Type.String(),
  read: Type.Boolean(),
});
```

### 2.5 Frontend Hooks (NEW)

**Notification Hooks:** `packages/react-ui/src/features/notifications/lib/notification-hooks.ts`
```typescript
export const notificationHooks = {
  useNotifications: (filters?: { read?: boolean }) => {
    // Fetch notifications with React Query
  },
  useUnreadCount: () => {
    // Fetch unread count, subscribe to WebSocket updates
  },
  useMarkAsRead: () => {
    // Mutation to mark notification as read
  },
};
```

### 2.6 Notification Bell Component (NEW)

**Location:** `packages/react-ui/src/features/notifications/components/notification-bell.tsx`

Features:
- Bell icon with badge showing unread count
- Dropdown showing recent notifications
- Click to open notification center
- Real-time updates via WebSocket

### 2.7 Notification Center Page (NEW)

**Location:** `packages/react-ui/src/app/routes/notifications/index.tsx`

Features:
- List all notifications (paginated)
- Filter by read/unread
- Mark as read / Mark all as read
- Click notification → Navigate to flow run
- Group by date/time

### 2.8 Per-Workflow Notification Settings (NEW)

**Option 1: Store in Flow Metadata**
```typescript
flow.metadata.notificationSettings = {
  notifyOnSuccess: boolean,
  notifyOnFailure: boolean,
  notifyOnPause: boolean,
};
```

**Option 2: Separate Table** (more scalable)
```typescript
flow_notification_settings {
  flowId: string,
  userId: string,
  notifyOnSuccess: boolean,
  notifyOnFailure: boolean,
  notifyOnPause: boolean,
}
```

**UI:** Add toggle switches in flow settings page

---

## 3. Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. ✅ Create notification entity and migration
2. ✅ Create notification service and controller
3. ✅ Add WebSocket events
4. ✅ Integrate with flow run completion hook

### Phase 2: Frontend Basics (Week 2)
1. ✅ Create notification hooks
2. ✅ Build notification bell component
3. ✅ Add to main navigation/header
4. ✅ Show toast notifications on WebSocket events

### Phase 3: Notification Center (Week 2-3)
1. ✅ Create notification center page
2. ✅ Add routing
3. ✅ Implement mark as read functionality
4. ✅ Add navigation from notifications to flow runs

### Phase 4: Per-Workflow Settings (Week 3)
1. ✅ Add notification settings to flow metadata/table
2. ✅ Create UI in flow settings
3. ✅ Respect settings when creating notifications

### Phase 5: Polish & Testing (Week 4)
1. ✅ Add loading states
2. ✅ Handle edge cases (deleted flows, etc.)
3. ✅ Performance optimization (indexes, pagination)
4. ✅ User testing

---

## 4. Technical Considerations

### 4.1 Performance
- **Database Indexes:** Critical for `userId + read` queries
- **Pagination:** Use cursor-based pagination (already pattern in codebase)
- **WebSocket Efficiency:** Only emit to users in project room
- **Caching:** Consider caching unread count

### 4.2 Scalability
- **Notification Cleanup:** Archive old notifications (e.g., > 30 days)
- **Batch Operations:** Mark all as read should be efficient
- **Rate Limiting:** Prevent notification spam

### 4.3 User Experience
- **Real-time Updates:** WebSocket ensures instant notifications
- **Toast + Bell:** Toast for immediate feedback, bell for persistent notifications
- **Navigation:** Click notification → Go to flow run details
- **Grouping:** Group notifications by flow/date

### 4.4 Edge Cases
- **Deleted Flows:** Handle gracefully (show "Flow deleted")
- **User Permissions:** Only show notifications user has access to
- **Multiple Projects:** Filter by current project context
- **Offline:** Queue notifications, sync when online

---

## 5. Code Examples

### 5.1 Backend: Create Notification on Flow Failure

```typescript
// packages/server/api/src/app/flows/flow-run/flow-run-side-effects.ts
import { notificationService } from '../../notifications/notification-service';

export const flowRunSideEffects = (log: FastifyBaseLogger) => ({
  async onFinish(flowRun: FlowRun): Promise<void> {
    if (!isFlowRunStateTerminal({ status: flowRun.status })) {
      return;
    }
    
    // Existing enterprise alerts
    await flowRunHooks(log).onFinish(flowRun);
    
    // NEW: In-app notifications
    if (shouldNotifyUser(flowRun)) {
      await createInAppNotification(flowRun, log);
    }
  },
});

async function createInAppNotification(
  flowRun: FlowRun,
  log: FastifyBaseLogger,
): Promise<void> {
  const flow = await flowService.getOneOrThrow(flowRun.flowId);
  
  // Check notification settings (per-workflow)
  const settings = flow.metadata?.notificationSettings || {
    notifyOnSuccess: true,
    notifyOnFailure: true,
    notifyOnPause: false,
  };
  
  const shouldNotify = 
    (flowRun.status === FlowRunStatus.SUCCEEDED && settings.notifyOnSuccess) ||
    (isFailedState(flowRun.status) && settings.notifyOnFailure) ||
    (flowRun.status === FlowRunStatus.PAUSED && settings.notifyOnPause);
  
  if (!shouldNotify) return;
  
  const notification = await notificationService.create({
    userId: flow.ownerId,
    projectId: flowRun.projectId,
    type: `FLOW_RUN_${flowRun.status}`,
    title: getNotificationTitle(flowRun),
    message: getNotificationMessage(flowRun),
    flowRunId: flowRun.id,
    flowId: flowRun.flowId,
    metadata: {
      status: flowRun.status,
      failedStep: flowRun.failedStep,
    },
  });
  
  // Emit WebSocket event
  await app.io.to(flowRun.projectId).emit(
    WebsocketClientEvent.FLOW_RUN_NOTIFICATION,
    notification,
  );
}
```

### 5.2 Frontend: Notification Bell Component

```typescript
// packages/react-ui/src/features/notifications/components/notification-bell.tsx
import { Bell } from 'lucide-react';
import { useSocket } from '@/components/socket-provider';
import { notificationHooks } from '../lib/notification-hooks';
import { WebsocketClientEvent } from '@activepieces/shared';
import { Badge } from '@/components/ui/badge';

export const NotificationBell = () => {
  const socket = useSocket();
  const { data: unreadCount } = notificationHooks.useUnreadCount();
  const { toast } = useToast();
  
  useEffect(() => {
    socket.on(WebsocketClientEvent.FLOW_RUN_NOTIFICATION, (notification) => {
      // Show toast
      toast({
        title: notification.title,
        description: notification.message,
        variant: notification.type.includes('FAILED') ? 'destructive' : 'default',
      });
      
      // Invalidate unread count query
      queryClient.invalidateQueries(['notifications', 'unread-count']);
    });
    
    return () => {
      socket.off(WebsocketClientEvent.FLOW_RUN_NOTIFICATION);
    };
  }, [socket]);
  
  return (
    <Button variant="ghost" size="icon" onClick={() => navigate('/notifications')}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
};
```

---

## 6. Acceptance Criteria Mapping

### User Story Requirement: "Real-time notifications for workflow events"

✅ **Can be implemented:**
- Flow run completion triggers notification
- WebSocket delivers notification instantly
- Toast shows immediate feedback
- Bell badge shows unread count

### Requirement: "In-app notifications when workflows succeed, fail, or require attention"

✅ **Can be implemented:**
- Success notifications ✅
- Failure notifications ✅ (with error details)
- Pause/attention notifications ✅

### Requirement: "Users should be able to opt into email notifications"

❌ **Cannot be implemented without deployment:**
- Requires SMTP server configuration
- Requires email service (SendGrid, AWS SES, etc.)
- Can be added later when deployed

### Requirement: "Notification settings should be customizable per workflow"

✅ **Can be implemented:**
- Store settings in flow metadata or separate table
- UI in flow settings page
- Respect settings when creating notifications

### Acceptance Criterion: "Given that a workflow fails, when the run completes, then I should receive an in-app notification with error details"

✅ **Can be implemented:**
- Flow run completion hook fires ✅
- Create notification with error details ✅
- Emit WebSocket event ✅
- Show toast notification ✅
- Update bell badge ✅
- Click to view flow run details ✅

---

## 7. Conclusion

**In-app notifications are FULLY IMPLEMENTABLE** without deployment. The codebase has:
- ✅ WebSocket infrastructure
- ✅ Toast system
- ✅ Flow run tracking
- ✅ Event system

**What needs to be built:**
1. Notification database entity (1-2 days)
2. Notification API endpoints (1-2 days)
3. WebSocket integration (1 day)
4. Frontend hooks and components (2-3 days)
5. Notification center UI (2-3 days)
6. Per-workflow settings (1-2 days)

**Total Estimated Time:** 8-13 days

**Email notifications** require deployment and SMTP configuration, but can be added later using the same notification infrastructure.

---

## 8. Next Steps

1. **Create database migration** for notification table
2. **Build notification service** and API endpoints
3. **Integrate with flow run completion** hook
4. **Create frontend hooks** and components
5. **Add notification bell** to navigation
6. **Build notification center** page
7. **Add per-workflow settings** UI

Would you like me to start implementing any of these components?

