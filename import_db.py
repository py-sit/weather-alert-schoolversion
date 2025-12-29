#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库导入工具
支持从另一个相同格式的SQLite数据库导入数据到现有项目中
"""

import os
import sys
import sqlite3
import json
import shutil
import datetime
from typing import Dict, List, Tuple, Optional
import argparse
from pathlib import Path

class DatabaseImporter:
    """数据库导入工具类"""
    
    def __init__(self, target_db_path: str = 'instance/skyalert.db'):
        self.target_db_path = target_db_path
        self.backup_path = None
        self.source_conn = None
        self.target_conn = None
        
        # 数据表配置
        self.table_configs = {
            'personnel': {
                'name': '人员数据',
                'unique_fields': ['email'],
                'check_duplicates': True,
                'merge_strategy': 'ask'
            },
            'template': {
                'name': '模板数据',
                'unique_fields': ['name'],
                'check_duplicates': True,
                'merge_strategy': 'ask'
            },
            'alert_rule': {
                'name': '预警规则',
                'unique_fields': ['weather_type_id', 'condition'],
                'check_duplicates': True,
                'merge_strategy': 'ask'
            },
            'setting': {
                'name': '系统设置',
                'unique_fields': [],
                'check_duplicates': False,
                'merge_strategy': 'ask'
            },
            'weather_type': {
                'name': '天气类型',
                'unique_fields': ['name'],
                'check_duplicates': True,
                'merge_strategy': 'skip_existing'
            },
            'log': {
                'name': '日志数据',
                'unique_fields': [],
                'check_duplicates': False,
                'merge_strategy': 'append'
            },
            'notification': {
                'name': '通知数据',
                'unique_fields': ['notification_id'],
                'check_duplicates': True,
                'merge_strategy': 'skip_existing'
            },
            'weather': {
                'name': '天气数据',
                'unique_fields': [],
                'check_duplicates': False,
                'merge_strategy': 'append'
            },
            'forecast': {
                'name': '天气预报',
                'unique_fields': [],
                'check_duplicates': False,
                'merge_strategy': 'append'
            },
            'personnel_weather_types': {
                'name': '人员天气类型关联',
                'unique_fields': ['personnel_id', 'weather_type_id'],
                'check_duplicates': True,
                'merge_strategy': 'skip_existing'
            },
            'weather_cache': {
                'name': '天气缓存',
                'unique_fields': ['cache_key'],
                'check_duplicates': True,
                'merge_strategy': 'update_existing'
            }
        }
        
        # 统计信息
        self.import_stats = {
            'total_imported': 0,
            'total_skipped': 0,
            'total_updated': 0,
            'errors': []
        }
    
    def create_backup(self) -> bool:
        """创建目标数据库的备份"""
        try:
            if not os.path.exists(self.target_db_path):
                print(f"目标数据库不存在: {self.target_db_path}")
                return False
            
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_dir = os.path.join(os.path.dirname(self.target_db_path), 'backups')
            os.makedirs(backup_dir, exist_ok=True)
            
            self.backup_path = os.path.join(backup_dir, f'skyalert_backup_{timestamp}.db')
            shutil.copy2(self.target_db_path, self.backup_path)
            
            print(f"✓ 数据库备份已创建: {self.backup_path}")
            return True
        except Exception as e:
            print(f"✗ 创建备份失败: {str(e)}")
            return False
    
    def restore_backup(self) -> bool:
        """从备份恢复数据库"""
        try:
            if not self.backup_path or not os.path.exists(self.backup_path):
                print("✗ 备份文件不存在，无法恢复")
                return False
            
            shutil.copy2(self.backup_path, self.target_db_path)
            print(f"✓ 数据库已从备份恢复: {self.backup_path}")
            return True
        except Exception as e:
            print(f"✗ 恢复备份失败: {str(e)}")
            return False
    
    def validate_source_database(self, source_db_path: str, allow_partial: bool = False) -> bool:
        """验证源数据库格式是否兼容"""
        try:
            if not os.path.exists(source_db_path):
                print(f"✗ 源数据库文件不存在: {source_db_path}")
                return False
            
            conn = sqlite3.connect(source_db_path)
            cursor = conn.cursor()
            
            # 获取源数据库的表结构
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            source_tables = {row[0] for row in cursor.fetchall()}
            
            # 检查是否有可导入的表
            available_tables = source_tables & set(self.table_configs.keys())
            
            if not available_tables:
                print(f"✗ 源数据库中没有可导入的表")
                conn.close()
                return False
            
            print(f"✓ 发现可导入的表: {', '.join(available_tables)}")
            
            # 如果允许部分导入，检查缺少的重要业务表
            if allow_partial:
                missing_tables = set(self.table_configs.keys()) - source_tables
                if missing_tables:
                    print(f"⚠ 警告：源数据库缺少以下表: {', '.join(missing_tables)}")
                    print("  将只导入存在的表")
            
            # 检查表结构兼容性
            for table in available_tables:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                if not columns:
                    print(f"✗ 表 {table} 结构异常")
                    conn.close()
                    return False
            
            conn.close()
            print("✓ 源数据库格式验证通过")
            return True
            
        except Exception as e:
            print(f"✗ 验证源数据库失败: {str(e)}")
            return False
    
    def connect_databases(self, source_db_path: str) -> bool:
        """连接源数据库和目标数据库"""
        try:
            self.source_conn = sqlite3.connect(source_db_path)
            self.source_conn.row_factory = sqlite3.Row
            
            self.target_conn = sqlite3.connect(self.target_db_path)
            self.target_conn.row_factory = sqlite3.Row
            
            print("✓ 数据库连接成功")
            return True
        except Exception as e:
            print(f"✗ 连接数据库失败: {str(e)}")
            return False
    
    def close_connections(self):
        """关闭数据库连接"""
        if self.source_conn:
            self.source_conn.close()
        if self.target_conn:
            self.target_conn.close()
    
    def get_table_data(self, table_name: str, conn: sqlite3.Connection) -> List[sqlite3.Row]:
        """获取表中的所有数据"""
        try:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM {table_name}")
            return cursor.fetchall()
        except Exception as e:
            print(f"✗ 获取表 {table_name} 数据失败: {str(e)}")
            return []
    
    def check_duplicate(self, table_name: str, row: sqlite3.Row, target_data: List[sqlite3.Row]) -> Optional[sqlite3.Row]:
        """检查是否存在重复数据"""
        config = self.table_configs.get(table_name, {})
        unique_fields = config.get('unique_fields', [])
        
        if not unique_fields:
            return None
        
        for target_row in target_data:
            match = True
            for field in unique_fields:
                if field in row.keys() and field in target_row.keys():
                    if row[field] != target_row[field]:
                        match = False
                        break
            if match:
                return target_row
        
        return None
    
    def preview_import(self, source_db_path: str, selected_tables: List[str]) -> Dict:
        """预览导入操作"""
        preview_data = {}
        
        if not self.connect_databases(source_db_path):
            return preview_data
        
        try:
            for table_name in selected_tables:
                if table_name not in self.table_configs:
                    continue
                
                source_data = self.get_table_data(table_name, self.source_conn)
                # 对于目标数据库中不存在的表，设置为空列表
                try:
                    target_data = self.get_table_data(table_name, self.target_conn)
                except:
                    target_data = []
                
                config = self.table_configs[table_name]
                
                new_records = 0
                duplicate_records = 0
                
                if config['check_duplicates']:
                    for row in source_data:
                        if self.check_duplicate(table_name, row, target_data):
                            duplicate_records += 1
                        else:
                            new_records += 1
                else:
                    new_records = len(source_data)
                
                preview_data[table_name] = {
                    'name': config['name'],
                    'source_count': len(source_data),
                    'target_count': len(target_data),
                    'new_records': new_records,
                    'duplicate_records': duplicate_records
                }
        
        finally:
            self.close_connections()
        
        return preview_data
    
    def import_table_data(self, table_name: str, merge_strategy: str = 'ask') -> bool:
        """导入单个表的数据"""
        try:
            config = self.table_configs.get(table_name, {})
            source_data = self.get_table_data(table_name, self.source_conn)
            target_data = self.get_table_data(table_name, self.target_conn)
            
            if not source_data:
                print(f"  - {config.get('name', table_name)}: 源数据为空，跳过")
                return True
            
            imported = 0
            skipped = 0
            updated = 0
            
            cursor = self.target_conn.cursor()
            
            for row in source_data:
                try:
                    # 检查重复
                    duplicate_row = None
                    if config.get('check_duplicates', False):
                        duplicate_row = self.check_duplicate(table_name, row, target_data)
                    
                    if duplicate_row:
                        # 处理重复数据
                        if merge_strategy == 'skip':
                            skipped += 1
                            continue
                        elif merge_strategy == 'update':
                            # 更新现有记录
                            self._update_record(cursor, table_name, row, duplicate_row)
                            updated += 1
                        elif merge_strategy == 'ask':
                            # 交互式处理
                            action = self._ask_duplicate_action(table_name, row, duplicate_row)
                            if action == 'skip':
                                skipped += 1
                                continue
                            elif action == 'update':
                                self._update_record(cursor, table_name, row, duplicate_row)
                                updated += 1
                    else:
                        # 插入新记录
                        self._insert_record(cursor, table_name, row)
                        imported += 1
                
                except Exception as e:
                    error_msg = f"处理 {table_name} 表记录时出错: {str(e)}"
                    print(f"    ✗ {error_msg}")
                    self.import_stats['errors'].append(error_msg)
            
            self.target_conn.commit()
            
            print(f"  - {config.get('name', table_name)}: 导入 {imported}, 更新 {updated}, 跳过 {skipped}")
            
            self.import_stats['total_imported'] += imported
            self.import_stats['total_updated'] += updated
            self.import_stats['total_skipped'] += skipped
            
            return True
            
        except Exception as e:
            error_msg = f"导入表 {table_name} 失败: {str(e)}"
            print(f"  ✗ {error_msg}")
            self.import_stats['errors'].append(error_msg)
            self.target_conn.rollback()
            return False
    
    def _insert_record(self, cursor: sqlite3.Cursor, table_name: str, row: sqlite3.Row):
        """插入新记录"""
        columns = list(row.keys())
        # 排除主键ID字段
        if 'id' in columns:
            columns.remove('id')
        
        placeholders = ', '.join(['?' for _ in columns])
        column_names = ', '.join(columns)
        values = [row[col] for col in columns]
        
        sql = f"INSERT INTO {table_name} ({column_names}) VALUES ({placeholders})"
        cursor.execute(sql, values)
    
    def _update_record(self, cursor: sqlite3.Cursor, table_name: str, new_row: sqlite3.Row, existing_row: sqlite3.Row):
        """更新现有记录"""
        columns = list(new_row.keys())
        if 'id' in columns:
            columns.remove('id')
        
        set_clause = ', '.join([f"{col} = ?" for col in columns])
        values = [new_row[col] for col in columns]
        values.append(existing_row['id'])
        
        sql = f"UPDATE {table_name} SET {set_clause} WHERE id = ?"
        cursor.execute(sql, values)
    
    def _ask_duplicate_action(self, table_name: str, new_row: sqlite3.Row, existing_row: sqlite3.Row) -> str:
        """询问用户如何处理重复数据"""
        config = self.table_configs.get(table_name, {})
        print(f"\n发现重复的{config.get('name', table_name)}:")
        
        # 显示重复记录的关键信息
        unique_fields = config.get('unique_fields', [])
        for field in unique_fields:
            if field in new_row.keys():
                print(f"  {field}: {new_row[field]}")
        
        while True:
            choice = input("请选择操作 (s=跳过, u=更新, a=全部跳过, A=全部更新): ").lower()
            if choice in ['s', 'skip']:
                return 'skip'
            elif choice in ['u', 'update']:
                return 'update'
            elif choice in ['a', 'all_skip']:
                return 'skip_all'
            elif choice in ['A', 'all_update']:
                return 'update_all'
            else:
                print("无效选择，请重新输入")
    
    def import_data(self, source_db_path: str, selected_tables: List[str], merge_strategies: Dict[str, str] = None) -> bool:
        """执行数据导入"""
        if merge_strategies is None:
            merge_strategies = {}
        
        print(f"\n开始导入数据...")
        print(f"源数据库: {source_db_path}")
        print(f"目标数据库: {self.target_db_path}")
        print(f"选择的表: {', '.join([self.table_configs.get(t, {}).get('name', t) for t in selected_tables])}")
        
        if not self.connect_databases(source_db_path):
            return False
        
        try:
            # 按依赖顺序导入表
            import_order = [
                'weather_type',
                'personnel', 
                'template',
                'alert_rule',
                'setting',
                'personnel_weather_types',
                'weather',
                'forecast',
                'log',
                'notification',
                'weather_cache'  # 添加 weather_cache 表到导入顺序
            ]
            
            for table_name in import_order:
                if table_name in selected_tables:
                    strategy = merge_strategies.get(table_name, self.table_configs[table_name]['merge_strategy'])
                    self.import_table_data(table_name, strategy)
            
            print(f"\n导入完成!")
            print(f"总计导入: {self.import_stats['total_imported']} 条记录")
            print(f"总计更新: {self.import_stats['total_updated']} 条记录")
            print(f"总计跳过: {self.import_stats['total_skipped']} 条记录")
            
            if self.import_stats['errors']:
                print(f"错误数量: {len(self.import_stats['errors'])}")
                for error in self.import_stats['errors']:
                    print(f"  - {error}")
            
            return len(self.import_stats['errors']) == 0
            
        except Exception as e:
            print(f"✗ 导入过程中发生错误: {str(e)}")
            return False
        finally:
            self.close_connections()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='数据库导入工具')
    parser.add_argument('source_db', help='源数据库文件路径')
    parser.add_argument('--target-db', default='instance/skyalert.db', help='目标数据库文件路径')
    parser.add_argument('--tables', nargs='+', help='要导入的表名')
    parser.add_argument('--preview', action='store_true', help='仅预览，不执行导入')
    parser.add_argument('--auto-skip', action='store_true', help='自动跳过重复数据')
    parser.add_argument('--auto-update', action='store_true', help='自动更新重复数据')
    parser.add_argument('--no-backup', action='store_true', help='不创建备份')
    parser.add_argument('--allow-partial', action='store_true', help='允许导入部分表（即使缺少某些业务表）')
    
    args = parser.parse_args()
    
    # 创建导入器实例
    importer = DatabaseImporter(args.target_db)
    
    # 验证源数据库
    if not importer.validate_source_database(args.source_db, args.allow_partial):
        return 1
    
    # 连接数据库获取实际可用的表
    if not importer.connect_databases(args.source_db):
        return 1
    
    # 获取源数据库中实际存在的表
    cursor = importer.source_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    source_tables = {row[0] for row in cursor.fetchall()}
    
    # 获取可导入的表（既在配置中又在源数据库中存在的表）
    available_tables = list(set(importer.table_configs.keys()) & source_tables)
    selected_tables = args.tables if args.tables else available_tables
    
    # 验证选择的表
    invalid_tables = set(selected_tables) - set(available_tables)
    if invalid_tables:
        print(f"✗ 无效的表名: {', '.join(invalid_tables)}")
        print(f"可用的表: {', '.join(available_tables)}")
        return 1
    
    # 预览模式
    if args.preview:
        print("=== 导入预览 ===")
        preview_data = importer.preview_import(args.source_db, selected_tables)
        
        for table_name, info in preview_data.items():
            print(f"\n{info['name']} ({table_name}):")
            print(f"  源数据库记录数: {info['source_count']}")
            print(f"  目标数据库记录数: {info['target_count']}")
            print(f"  新记录数: {info['new_records']}")
            print(f"  重复记录数: {info['duplicate_records']}")
        
        return 0
    
    # 创建备份
    if not args.no_backup:
        if not importer.create_backup():
            if input("无法创建备份，是否继续? (y/N): ").lower() != 'y':
                return 1
    
    # 设置合并策略
    merge_strategies = {}
    if args.auto_skip:
        for table in selected_tables:
            if importer.table_configs[table]['check_duplicates']:
                merge_strategies[table] = 'skip'
    elif args.auto_update:
        for table in selected_tables:
            if importer.table_configs[table]['check_duplicates']:
                merge_strategies[table] = 'update'
    
    # 执行导入
    success = importer.import_data(args.source_db, selected_tables, merge_strategies)
    
    if not success:
        print("\n导入失败!")
        if not args.no_backup and importer.backup_path:
            if input("是否恢复备份? (y/N): ").lower() == 'y':
                importer.restore_backup()
        return 1
    
    print("\n导入成功!")
    return 0


if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n操作被用户取消")
        sys.exit(1)
    except Exception as e:
        print(f"\n程序异常退出: {str(e)}")
        sys.exit(1)