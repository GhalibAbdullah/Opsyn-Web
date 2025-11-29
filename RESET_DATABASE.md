# Reset Database for Clean Start

Since we've made significant architecture changes (no default projects, strict project access, etc.), it's best to start with a fresh database.

## For SQLite (Development)

1. **Stop the server** if it's running (Ctrl+C)

2. **Delete the SQLite database file(s)**:
   ```bash
   # Find and delete all SQLite database files
   rm -f dev/config/database.sqlite
   rm -f packages/server/api/database.sqlite
   rm -f *.sqlite
   ```

3. **Restart the server**:
   ```bash
   npm run dev
   # or however you start your server
   ```

4. **Create a new account**:
   - The database will be recreated automatically
   - Go to sign-up page and create a new user
   - **Important**: Users now start with **zero projects** by default
   - You'll need to create your first project manually

5. **Test the new architecture**:
   - No projects should exist until you create one
   - Create a project manually
   - Invite users to projects
   - Test user removal (should work now with clean data)

## Why Reset?

The old database had:
- Default projects created on signup (we removed this)
- Users with invalid projectIds in their tokens
- Memberships that might not align with the new architecture

Starting fresh ensures:
- Clean project membership data
- No orphaned projectIds in tokens
- Proper testing of the new architecture

