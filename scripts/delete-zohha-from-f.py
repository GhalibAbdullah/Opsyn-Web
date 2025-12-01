#!/usr/bin/env python3
"""
Script to delete Zohha from project f
"""

import sqlite3
import os
import sys

# Find database path
dev_config_path = os.path.join(os.getcwd(), 'dev', 'config', 'database.sqlite')
home_config_path = os.path.join(os.path.expanduser('~'), '.activepieces', 'database.sqlite')

if os.path.exists(dev_config_path):
    db_path = dev_config_path
elif os.path.exists(home_config_path):
    db_path = home_config_path
else:
    print(f"❌ SQLite database not found at:")
    print(f"   {dev_config_path}")
    print(f"   {home_config_path}")
    sys.exit(1)

print(f"📁 Using SQLite database at: {db_path}\n")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find project "f"
    cursor.execute("SELECT id, displayName, ownerId FROM project WHERE displayName = ?", ('f',))
    project_f = cursor.fetchone()
    
    if not project_f:
        print("❌ Project 'f' not found")
        sys.exit(1)
    
    project_f_id = project_f[0]
    print(f"📁 Project 'f':")
    print(f"   ID: {project_f_id}")
    print(f"   Owner ID: {project_f[2]}\n")
    
    # Find Zohha's user ID
    cursor.execute("""
        SELECT u.id, ui.email
        FROM user u
        JOIN user_identity ui ON u.identityId = ui.id
        WHERE LOWER(TRIM(ui.email)) = ?
    """, ('zohhazhar13@gmail.com',))
    zohha_user = cursor.fetchone()
    
    if not zohha_user:
        print("❌ Zohha user not found")
        sys.exit(1)
    
    zohha_user_id = zohha_user[0]
    print(f"👤 Zohha:")
    print(f"   User ID: {zohha_user_id}")
    print(f"   Email: {zohha_user[1]}\n")
    
    # Check if Zohha has a project_member record in project f
    cursor.execute("""
        SELECT pm.id, pm.role, p.displayName, ui.email
        FROM project_member pm
        JOIN project p ON pm.projectId = p.id
        JOIN user u ON pm.userId = u.id
        JOIN user_identity ui ON u.identityId = ui.id
        WHERE p.displayName = ? AND LOWER(TRIM(ui.email)) = ?
    """, ('f', 'zohhazhar13@gmail.com'))
    existing_member = cursor.fetchone()
    
    if existing_member:
        member_id = existing_member[0]
        print(f"🔍 Found ProjectMember record for Zohha in project f:")
        print(f"   Member ID: {member_id}")
        print(f"   Role: {existing_member[1]}\n")
        
        # Delete the record
        print("🗑️  Deleting ProjectMember record...")
        cursor.execute("DELETE FROM project_member WHERE id = ?", (member_id,))
        deleted_count = cursor.rowcount
        conn.commit()
        
        print(f"   Deleted {deleted_count} row(s)\n")
        print("✅ Deleted successfully\n")
    else:
        print("ℹ️  No ProjectMember record found for Zohha in project f\n")
        print("   This means Zohha is not an explicit member of project f.")
        print("   If she appears in the UI, it might be due to:")
        print("   1. Virtual member logic (if project.ownerId is wrong)")
        print("   2. Frontend caching")
        print("   3. Backend logic issue\n")
    
    # Verify deletion
    cursor.execute("""
        SELECT pm.id FROM project_member pm
        JOIN project p ON pm.projectId = p.id
        WHERE p.displayName = ? AND pm.userId = ?
    """, ('f', zohha_user_id))
    verify_member = cursor.fetchone()
    
    if verify_member:
        print("❌ ERROR: ProjectMember record still exists after deletion!")
        sys.exit(1)
    else:
        print("✅ Verification: Zohha no longer has a ProjectMember record in project f\n")
    
    print("=" * 80)
    print("✅ SUCCESS: Zohha has been removed from project f")
    print("=" * 80)
    print(f"\n📋 Next steps:")
    print("   1. Restart your backend server")
    print("   2. Test the API endpoints to verify the fix")
    print(f"   3. Project f ID: {project_f_id}")
    
    conn.close()
    
except sqlite3.Error as e:
    print(f"❌ SQLite error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

