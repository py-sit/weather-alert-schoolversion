import sqlite3
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'skyalert.db')

def migrate_database():
    # 检查数据库文件是否存在
    db_path = DB_PATH
    if not os.path.exists(db_path):
        print("数据库文件不存在，请先运行应用程序以创建数据库。")
        return False
    
    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 检查template表中是否已存在target_role列
        cursor.execute("PRAGMA table_info(template)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]
        
        if 'target_role' not in column_names:
            print("正在向template表添加target_role列...")
            # 添加target_role列，默认值为'all'（适用所有人）
            cursor.execute("ALTER TABLE template ADD COLUMN target_role VARCHAR(20) DEFAULT 'all'")
            conn.commit()
            print("成功添加target_role列！")
        else:
            print("target_role列已存在于template表中。")

        # 检查 setting 表 first_alert_time 列
        cursor.execute("PRAGMA table_info(setting)")
        setting_columns = cursor.fetchall()
        setting_column_names = [column[1] for column in setting_columns]
        if 'first_alert_time' not in setting_column_names:
            print("正在向setting表添加first_alert_time列...")
            cursor.execute("ALTER TABLE setting ADD COLUMN first_alert_time VARCHAR(5)")
            cursor.execute("UPDATE setting SET first_alert_time = printf('%02d:00', COALESCE(first_alert, 6)) WHERE first_alert_time IS NULL")
            conn.commit()
            print("成功添加first_alert_time列！")
        else:
            print("first_alert_time列已存在于setting表中。")

        # 检查 mail_task 表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mail_task'")
        has_mail_task = cursor.fetchone()
        if not has_mail_task:
            print("正在创建 mail_task 表...")
            cursor.execute(
                """
                CREATE TABLE mail_task (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id VARCHAR(100) UNIQUE NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    payload TEXT,
                    is_test BOOLEAN DEFAULT 0,
                    attempts INTEGER DEFAULT 0,
                    error TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.commit()
            print("成功创建 mail_task 表！")
        else:
            print("mail_task 表已存在。")
        
        return True
    except Exception as e:
        print(f"迁移数据库时发生错误: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("开始数据库迁移...")
    success = migrate_database()
    
    if success:
        print("数据库迁移成功完成！")
    else:
        print("数据库迁移失败。") 
