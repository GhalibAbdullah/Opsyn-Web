#!/bin/bash
cd /home/alien/dev/activepieces

DB_FILE="dev/config/database.sqlite"

# Make the old 'action' column nullable by recreating the table
sqlite3 "$DB_FILE" <<'SQL'
-- Create new table without the old 'action' column constraint
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

-- Copy data
INSERT INTO flow_activity_new (id, created, updated, projectId, flowId, userId, action, actionType, metadata)
SELECT id, created, updated, projectId, flowId, userId, action, COALESCE(actionType, action, 'UPDATED'), metadata
FROM flow_activity;

-- Drop old table and rename new one
DROP TABLE flow_activity;
ALTER TABLE flow_activity_new RENAME TO flow_activity;

-- Recreate indices
CREATE INDEX idx_flow_activity_flow_id ON flow_activity(flowId);
CREATE INDEX idx_flow_activity_project_id ON flow_activity(projectId);
CREATE INDEX idx_flow_activity_created ON flow_activity(created);
SQL

echo "✅ Fixed flow_activity table - action column is now nullable"

