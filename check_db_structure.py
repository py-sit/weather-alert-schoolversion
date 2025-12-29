#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查数据库结构的脚本
"""

import sqlite3
import os

def check_database_structure(db_path):
    """检查数据库结构"""
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return
    
    print(f"\n=== {db_path} 数据库结构 ===")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 获取所有表名
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        if not tables:
            print("  数据库中没有表")
            return
        
        print(f"  共有 {len(tables)} 个表:")
        
        for table in tables:
            table_name = table[0]
            print(f"\n  表: {table_name}")
            
            # 获取表结构
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            if columns:
                print("    字段:")
                for col in columns:
                    col_id, col_name, col_type, not_null, default_val, is_pk = col
                    pk_str = " (主键)" if is_pk else ""
                    null_str = " NOT NULL" if not_null else ""
                    default_str = f" DEFAULT {default_val}" if default_val is not None else ""
                    print(f"      - {col_name}: {col_type}{pk_str}{null_str}{default_str}")
            
            # 获取记录数
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f"    记录数: {count}")
            except Exception as e:
                print(f"    记录数: 无法获取 ({e})")
        
        conn.close()
        
    except Exception as e:
        print(f"  检查数据库时出错: {e}")

def main():
    """主函数"""
    # 检查所有数据库文件
    db_files = [
        'weather_alert.db',
        'instance/skyalert.db', 
        'instance/weather_cache.db'
    ]
    
    for db_file in db_files:
        check_database_structure(db_file)

if __name__ == '__main__':
    main()