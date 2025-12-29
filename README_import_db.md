# 数据库导入工具使用说明

## 概述

`import_db.py` 是一个专门为天气预警系统设计的数据库导入工具，支持从另一个相同格式的SQLite数据库导入数据到现有项目中。该工具提供了完整的数据合并策略、安全措施和用户交互功能。

## 功能特性

### 🔄 数据合并策略
- **人员数据**: 基于邮箱检查重复，支持更新或跳过
- **模板数据**: 基于名称检查重复，支持更新或跳过  
- **预警规则**: 基于天气类型和条件检查重复
- **系统设置**: 提供选择是否覆盖现有设置
- **日志数据**: 直接导入（不检查重复）
- **天气数据**: 直接追加导入

### 🛡️ 安全措施
- **自动备份**: 导入前自动创建目标数据库备份
- **回滚功能**: 导入失败时可恢复到备份状态
- **事务处理**: 确保数据一致性，失败时自动回滚
- **数据验证**: 检查源数据库格式兼容性

### 📊 数据验证
- 检查源数据库是否存在必要的表结构
- 验证表结构兼容性
- 提供导入前预览功能
- 显示详细的导入统计信息

## 安装要求

该工具使用Python标准库，无需额外安装依赖包：
- Python 3.6+
- sqlite3 (标准库)
- argparse (标准库)
- shutil (标准库)

## 使用方法

### 基本语法

```bash
python import_db.py <源数据库路径> [选项]
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `source_db` | 源数据库文件路径（必需） | - |
| `--target-db` | 目标数据库文件路径 | `instance/skyalert.db` |
| `--tables` | 要导入的表名（空格分隔） | 所有表 |
| `--preview` | 仅预览，不执行导入 | False |
| `--auto-skip` | 自动跳过重复数据 | False |
| `--auto-update` | 自动更新重复数据 | False |
| `--no-backup` | 不创建备份 | False |

### 使用示例

#### 1. 预览导入操作
```bash
python import_db.py source_database.db --preview
```

#### 2. 导入所有数据（交互式处理重复）
```bash
python import_db.py source_database.db
```

#### 3. 只导入特定表
```bash
python import_db.py source_database.db --tables personnel template alert_rule
```

#### 4. 自动跳过重复数据
```bash
python import_db.py source_database.db --auto-skip
```

#### 5. 自动更新重复数据
```bash
python import_db.py source_database.db --auto-update
```

#### 6. 指定目标数据库
```bash
python import_db.py source_database.db --target-db custom/path/target.db
```

#### 7. 不创建备份（谨慎使用）
```bash
python import_db.py source_database.db --no-backup
```

## 支持的数据表

| 表名 | 中文名称 | 重复检查字段 | 默认策略 |
|------|----------|--------------|----------|
| `personnel` | 人员数据 | email | 询问用户 |
| `template` | 模板数据 | name | 询问用户 |
| `alert_rule` | 预警规则 | weather_type_id, condition | 询问用户 |
| `setting` | 系统设置 | - | 询问用户 |
| `weather_type` | 天气类型 | name | 跳过已存在 |
| `log` | 日志数据 | - | 直接追加 |
| `notification` | 通知数据 | notification_id | 跳过已存在 |
| `weather` | 天气数据 | - | 直接追加 |
| `forecast` | 天气预报 | - | 直接追加 |
| `personnel_weather_types` | 人员天气类型关联 | personnel_id, weather_type_id | 跳过已存在 |

## 交互式操作

当遇到重复数据时，工具会提示用户选择处理方式：

```
发现重复的人员数据:
  email: 示例邮箱
请选择操作 (s=跳过, u=更新, a=全部跳过, A=全部更新):
```

选项说明：
- `s` 或 `skip`: 跳过当前重复记录
- `u` 或 `update`: 更新当前重复记录
- `a` 或 `all_skip`: 对所有重复记录都跳过
- `A` 或 `all_update`: 对所有重复记录都更新

## 输出示例

### 预览模式输出
```
=== 导入预览 ===

人员数据 (personnel):
  源数据库记录数: 25
  目标数据库记录数: 10
  新记录数: 20
  重复记录数: 5

模板数据 (template):
  源数据库记录数: 15
  目标数据库记录数: 8
  新记录数: 12
  重复记录数: 3
```

### 导入完成输出
```
开始导入数据...
源数据库: source_database.db
目标数据库: instance/skyalert.db
选择的表: 人员数据, 模板数据, 预警规则

✓ 数据库备份已创建: instance/backups/skyalert_backup_20241223_143022.db
✓ 数据库连接成功

  - 天气类型: 导入 2, 更新 0, 跳过 3
  - 人员数据: 导入 20, 更新 3, 跳过 2
  - 模板数据: 导入 12, 更新 2, 跳过 1

导入完成!
总计导入: 34 条记录
总计更新: 5 条记录
总计跳过: 6 条记录

导入成功!
```

## 错误处理

### 常见错误及解决方案

1. **源数据库文件不存在**
   ```
   ✗ 源数据库文件不存在: path/to/source.db
   ```
   解决：检查源数据库文件路径是否正确

2. **源数据库格式不兼容**
   ```
   ✗ 源数据库缺少必要的表: personnel, template
   ```
   解决：确保源数据库包含必要的表结构

3. **目标数据库不存在**
   ```
   目标数据库不存在: instance/skyalert.db
   ```
   解决：先运行主应用程序初始化数据库

4. **权限问题**
   ```
   ✗ 创建备份失败: Permission denied
   ```
   解决：检查文件和目录的读写权限

## 最佳实践

### 1. 导入前准备
- 确保目标数据库已存在且可访问
- 检查磁盘空间是否足够（备份需要额外空间）
- 建议先使用 `--preview` 参数预览导入操作

### 2. 安全建议
- 不要使用 `--no-backup` 参数，除非你确定不需要备份
- 重要数据导入前，手动创建额外备份
- 在测试环境中先验证导入操作

### 3. 性能优化
- 大量数据导入时，考虑分批导入特定表
- 使用 `--auto-skip` 或 `--auto-update` 避免交互式操作

### 4. 故障恢复
- 如果导入失败，工具会询问是否恢复备份
- 备份文件保存在 `instance/backups/` 目录中
- 可以手动使用备份文件恢复数据库

## 技术细节

### 数据导入顺序
工具按照以下顺序导入数据，确保外键约束正确：
1. weather_type (天气类型)
2. personnel (人员)
3. template (模板)
4. alert_rule (预警规则)
5. setting (系统设置)
6. personnel_weather_types (人员天气类型关联)
7. weather (天气数据)
8. forecast (天气预报)
9. log (日志)
10. notification (通知)

### 事务处理
- 每个表的导入操作都在独立事务中执行
- 单个表导入失败不会影响其他表
- 记录级别的错误会记录但不会中断整个导入过程

### 备份机制
- 备份文件命名格式: `skyalert_backup_YYYYMMDD_HHMMSS.db`
- 备份保存在 `instance/backups/` 目录
- 工具不会自动清理旧备份，需要手动管理

## 故障排除

如果遇到问题，请检查：

1. **Python版本**: 确保使用Python 3.6或更高版本
2. **文件权限**: 确保对源数据库、目标数据库和备份目录有适当权限
3. **磁盘空间**: 确保有足够空间创建备份
4. **数据库锁定**: 确保目标数据库没有被其他程序占用
5. **路径格式**: 在Windows系统中使用正确的路径分隔符

如需更多帮助，请查看工具输出的详细错误信息。
