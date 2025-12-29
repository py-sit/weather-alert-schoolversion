import os
import json
import datetime
import shutil

# 日志备份目录与健康状态文件常量
LOG_BACKUP_DIR = os.path.join('logs', 'json_backups')
HEALTH_STATUS_FILE = 'health_status.json'
MAX_HEALTH_HISTORY = 50


def _ensure_directory(path):
    """确保目录存在，便于后续写入"""
    if path and not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def backup_json_file(file_path, prefix):
    """备份JSON文件，返回备份路径"""
    if not os.path.exists(file_path):
        return None
    _ensure_directory(LOG_BACKUP_DIR)
    timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    backup_name = f"{prefix}_{timestamp}.json"
    backup_path = os.path.join(LOG_BACKUP_DIR, backup_name)
    shutil.copy(file_path, backup_path)
    return backup_path


def backup_if_has_data(file_path, prefix):
    """仅在文件存在有效数据时进行备份，避免空文件占用空间"""
    if not os.path.exists(file_path):
        return
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = None
    if isinstance(data, list) and len(data) == 0:
        return
    if data in (None, {}, []):
        return
    backup_json_file(file_path, prefix)


def trim_json_file(file_path, prefix, max_entries=2000):
    """裁剪JSON数组文件，超过阈值时备份并仅保留最新记录"""
    if not os.path.exists(file_path):
        return
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        backup_json_file(file_path, prefix)
        return
    if not isinstance(data, list):
        return
    if len(data) <= max_entries:
        return
    backup_json_file(file_path, prefix)
    trimmed = data[-max_entries:]
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(trimmed, f, ensure_ascii=False, indent=4)


def log_health(service_name, success, message):
    """记录外部依赖健康状况，方便前端或运维查看"""
    _ensure_directory(os.path.dirname(HEALTH_STATUS_FILE) or '.')
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    data = {}
    if os.path.exists(HEALTH_STATUS_FILE):
        try:
            with open(HEALTH_STATUS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError:
            data = {}
    service_entry = data.get(service_name, {'history': []})
    service_entry['last_check'] = timestamp
    if success:
        service_entry['last_success'] = timestamp
    else:
        service_entry['last_error'] = timestamp
    service_entry['last_message'] = message
    service_entry['status'] = 'ok' if success else 'error'
    history = service_entry.get('history', [])
    history.append({
        'timestamp': timestamp,
        'success': success,
        'message': message
    })
    service_entry['history'] = history[-MAX_HEALTH_HISTORY:]
    data[service_name] = service_entry
    with open(HEALTH_STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

