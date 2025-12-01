// Temporary migration script to add actionType column
// Run with: npx tsx add-actiontype-migration.ts

import { createSqlLiteDataSource } from './packages/server/api/src/app/database/sqlite-connection';

async function addActionTypeColumn() {
  const dataSource = createSqlLiteDataSource();
  
  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    
    const queryRunner = dataSource.createQueryRunner();
    
    // Check if column exists
    const tableInfo = await queryRunner.query('PRAGMA table_info(flow_activity)');
    const hasActionType = tableInfo.some((col: { name: string }) => col.name === 'actionType');
    
    if (!hasActionType) {
      console.log('Adding actionType column...');
      await queryRunner.query(`
        ALTER TABLE flow_activity ADD COLUMN actionType varchar(50) DEFAULT 'UPDATED';
      `);
      await queryRunner.query(`
        UPDATE flow_activity SET actionType = 'UPDATED' WHERE actionType IS NULL;
      `);
      console.log('✅ Column added successfully!');
    } else {
      console.log('✅ actionType column already exists!');
    }
    
    // Show final structure
    const finalInfo = await queryRunner.query('PRAGMA table_info(flow_activity)');
    console.log('\nFinal table structure:');
    finalInfo.forEach((col: { name: string; type: string }) => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    
    await queryRunner.release();
    await dataSource.destroy();
    console.log('\n🎉 Done! Please restart your server.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addActionTypeColumn();

