import sqlite3
import os

db_path = 'instance/skyalert.db'
print('数据库文件存在:', os.path.exists(db_path))

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有表名
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print('数据库中的表:', tables)
    
    # 检查setting表的结构
    if ('setting',) in tables:
        cursor.execute("PRAGMA table_info(setting);")
        columns = cursor.fetchall()
        print('setting表的列:', columns)
        
        # 检查是否已有auto_approval列
        column_names = [col[1] for col in columns]
        if 'auto_approval' not in column_names:
            print('需要添加auto_approval列')
            try:
                cursor.execute('ALTER TABLE setting ADD COLUMN auto_approval BOOLEAN DEFAULT 0')
                conn.commit()
                print('成功添加auto_approval列')
            except Exception as e:
                print('添加列失败:', e)
        else:
            print('auto_approval列已存在')
    
    conn.close()
else:
    print('数据库文件不存在，需要创建')