import { databaseConnection } from './database-connection'
import { databaseSeeds } from './seeds'
import { system } from '../helper/system/system'

export async function initializeDatabase({ runMigrations }: { runMigrations: boolean }   ) {
    const log = system.globalLogger()
    const dataSource = databaseConnection()
    
    // Log the actual database path being used
    if (dataSource.options.type === 'sqlite') {
        log.info({ databasePath: dataSource.options.database }, 'SQLite database path')
    }
    
    log.info('Initializing database connection...')
    await dataSource.initialize()
    log.info('Database connection initialized')
    
    if (runMigrations) {
        // Check if database has any tables to determine if it's a new database
        let tableCount = 0
        try {
            if (dataSource.options.type === 'sqlite') {
                const result = await dataSource.query("SELECT name FROM sqlite_master WHERE type='table'")
                tableCount = result.length
            } else if (dataSource.options.type === 'postgres') {
                const result = await dataSource.query(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
                tableCount = result.length
            }
        } catch (error) {
            log.warn({ error }, 'Error checking table count, will attempt to run migrations anyway')
        }
        
        log.info({ tableCount, databaseType: dataSource.options.type }, `Database has ${tableCount} tables`)
        
        // Always run migrations if explicitly requested, especially on new/empty databases
        // showMigrations() can return false on empty databases because migrations table doesn't exist yet
        const hasPendingMigrations = await dataSource.showMigrations()
        log.info({ hasPendingMigrations, tableCount }, `Has pending migrations: ${hasPendingMigrations}, Table count: ${tableCount}`)
        
        // Run migrations if there are pending ones, OR if database is empty (new database)
        if (hasPendingMigrations || tableCount === 0) {
            log.info('Running migrations...')
            try {
                // Get list of all migrations that should run
                const allMigrations = dataSource.migrations || []
                log.info({ migrationCount: allMigrations.length }, `Found ${allMigrations.length} migrations in configuration`)
                
                const executedMigrations = await dataSource.runMigrations()
                log.info({ executedCount: executedMigrations.length }, `Executed ${executedMigrations.length} migrations`)
                
                if (executedMigrations.length === 0) {
                    log.warn('No migrations were executed! This might indicate a problem.')
                    log.warn('Attempting to verify database state...')
                    
                    // Check table count again after migrations
                    let newTableCount = 0
                    try {
                        if (dataSource.options.type === 'sqlite') {
                            const result = await dataSource.query("SELECT name FROM sqlite_master WHERE type='table'")
                            newTableCount = result.length
                        } else if (dataSource.options.type === 'postgres') {
                            const result = await dataSource.query(
                                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                            )
                            newTableCount = result.length
                        }
                        log.info({ newTableCount }, `Database now has ${newTableCount} tables after migration attempt`)
                    } catch (error) {
                        log.error({ error }, 'Error checking table count after migrations')
                    }
                } else {
                    executedMigrations.forEach(migration => {
                        log.info({ migration: migration.name }, `Executed migration: ${migration.name}`)
                    })
                }
            } catch (error) {
                log.error({ error, errorMessage: error instanceof Error ? error.message : String(error) }, 'Error running migrations')
                throw error
            }
        } else {
            log.info('No pending migrations to run (database already has tables and no pending migrations)')
        }
    }
    
    await databaseSeeds.run()
}