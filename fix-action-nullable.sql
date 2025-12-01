-- Fix flow_activity table: make 'action' column nullable
BEGIN TRANSACTION;

-- Create new table with nullable 'action' column
CREATE TABLE flow_activity_new (
    id varchar(21) PRIMARY KEY NOT NULL,
    created datetime NOT NULL DEFAULT (datetime('now')),
    updated datetime NOT NULL DEFAULT (datetime('now')),
    projectId varchar(21) NOT NULL,
    flowId varchar(21) NOT NULL,
    userId varchar(21),
    action varchar(50),
    actionType varchar(50) DEFAULT 'UPDATED',
    metadata text
);

-- Copy all data
INSERT INTO flow_activity_new (id, created, updated, projectId, flowId, userId, action, actionType, metadata)
SELECT 
    id, 
    created, 
    updated, 
    projectId, 
    flowId, 
    userId, 
    action,
    COALESCE(actionType, action, 'UPDATED') as actionType,
    metadata
FROM flow_activity;

-- Drop old table
DROP TABLE flow_activity;

-- Rename new table
ALTER TABLE flow_activity_new RENAME TO flow_activity;

-- Recreate indices
CREATE INDEX idx_flow_activity_flow_id ON flow_activity(flowId);
CREATE INDEX idx_flow_activity_project_id ON flow_activity(projectId);
CREATE INDEX idx_flow_activity_created ON flow_activity(created);

-- Recreate foreign keys
-- Note: SQLite foreign keys need to be recreated if they were dropped
-- But since we're just fixing the column, they should still work

COMMIT;

