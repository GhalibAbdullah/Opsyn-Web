-- Add missing actionType column to flow_activity table
-- Run this with: sqlite3 packages/server/api/database.sqlite < add-actiontype-column.sql

-- Check if column exists first
-- If it doesn't exist, add it
ALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED';

-- Update any NULL values (shouldn't be any, but just in case)
UPDATE flow_activity SET actionType = 'UPDATED' WHERE actionType IS NULL;

-- Verify the column was added
.schema flow_activity

