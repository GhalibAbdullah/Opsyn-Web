#!/usr/bin/env ts-node

/**
 * Script to reset a user's password directly in the database
 * Usage: npx ts-node scripts/reset-password.ts <email> <newPassword>
 * 
 * Example: npx ts-node scripts/reset-password.ts user@example.com newpassword123
 */

import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { databaseConnection } from '../packages/server/api/src/app/database/database-connection';
import { userIdentityRepository } from '../packages/server/api/src/app/authentication/user-identity/user-identity-service';

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
    console.error('Usage: npx ts-node scripts/reset-password.ts <email> <newPassword>');
    console.error('Example: npx ts-node scripts/reset-password.ts user@example.com newpassword123');
    process.exit(1);
}

async function resetPassword() {
    try {
        const cleanedEmail = email.toLowerCase().trim();
        
        // Initialize database connection
        // databaseConnection() always returns a DataSource, never null
        const dataSource = databaseConnection()!;
        
        if (!dataSource.isInitialized) {
            await dataSource.initialize();
        }
        
        console.log('Database connection established');
        
        // Find user by email
        const userIdentity = await userIdentityRepository().findOneBy({ email: cleanedEmail });
        
        if (!userIdentity) {
            console.error(`User with email ${email} not found in database`);
            process.exit(1);
        }
        
        console.log(`Found user: ${userIdentity.email} (${userIdentity.firstName} ${userIdentity.lastName})`);
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log('Password hashed successfully');
        
        // Update password and token version
        await userIdentityRepository().update(userIdentity.id, {
            password: hashedPassword,
            tokenVersion: nanoid(),
        });
        
        // Also verify the user if not already verified
        if (!userIdentity.verified) {
            await userIdentityRepository().update(userIdentity.id, {
                verified: true,
            });
            console.log('User verified status updated');
        }
        
        console.log('\n✅ Password reset successfully!');
        console.log(`\nYou can now sign in with:`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${newPassword}\n`);
        
    } catch (error) {
        console.error('Error resetting password:', error);
        process.exit(1);
    } finally {
        // Note: We don't close the connection as it's a singleton
        // The process will exit anyway
    }
}

resetPassword();

