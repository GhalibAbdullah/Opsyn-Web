#!/usr/bin/env python3
"""Simple script to enable projects in Activepieces Community Edition"""
import sqlite3
import os
import sys

# Try to find the database file
db_paths = [
    'packages/server/api/database.sqlite',
    'database.sqlite',
    os.path.join(os.path.dirname(__file__), 'packages/server/api/database.sqlite'),
]

db_file = None
for path in db_paths:
    if os.path.exists(path):
        db_file = path
        print(f'✅ Found database: {db_file}')
        break

if not db_file:
    print('❌ Could not find database.sqlite file')
    print('\n💡 Make sure you\'re running this from the activepieces root directory')
    print('   Or specify the path: python3 enable-projects.py /path/to/database.sqlite')
    sys.exit(1)

try:
    # Connect to database
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Enable projects for all platforms
    cursor.execute('UPDATE platform_plan SET manageProjectsEnabled = 1;')
    affected = cursor.rowcount
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print(f'✅ Updated {affected} platform(s)')
    print('✅ Project management enabled!')
    print('\n🎉 Next steps:')
    print('   1. Restart your Activepieces server')
    print('   2. Refresh your browser')
    print('   3. Go to Platform Settings → Projects')
    print('   4. You should see the "New Project" button!')
    
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)

