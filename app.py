import os
from flask import Flask, request, jsonify, send_from_directory
from sqlalchemy import text
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import datetime
import pytz
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
import requests
from threading import Thread
import time
import re
from werkzeug.utils import secure_filename
import random
import sqlite3
from maintenance_utils import backup_if_has_data, trim_json_file

# 初始化Flask应用
app = Flask(__name__, static_folder='.', static_url_path='')

# 启用CORS跨域资源共享
CORS(app)


USER_FILE = 'user.json'
if not os.path.exists(USER_FILE):
    with open(USER_FILE, 'w') as f:
        # 初始化管理员账号
        json.dump([
            {"username": "admin", "password": "admin", "role": "admin"}
        ], f)



# 配置数据库：使用项目根目录下的绝对路径，避免自动落到 instance 目录
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'skyalert.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 日志与缓存文件控制阈值
DATA_LOG_MAX_ENTRIES = 2000
PENDING_EMAIL_MAX_ENTRIES = 1000
PENDING_NOTIFICATION_MAX_ENTRIES = 500

# 初始化数据库
db = SQLAlchemy(app)

# 人员数据JSON文件路径
CUSTOMERS_JSON_FILE = 'customers_data.json'
# 设置数据JSON文件路径
SETTINGS_JSON_FILE = 'settings.json'

# 导入邮件发送API
from send_email_api import register_routes

# 注册邮件发送API路由
register_routes(app)

# 定义数据模型
class Personnel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(20))
    company = db.Column(db.String(200))
    region = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    category = db.Column(db.String(20), default='客户')  # 新增字段：类别，默认为"客户"
    last_updated = db.Column(db.DateTime, default=datetime.datetime.now)
    
    # 与WeatherType的多对多关系
    weather_types = db.relationship('WeatherType', secondary='personnel_weather_types')

# 天气类型模型
class WeatherType(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)

# 人员与天气类型的关联表
personnel_weather_types = db.Table('personnel_weather_types',
    db.Column('personnel_id', db.Integer, db.ForeignKey('personnel.id'), primary_key=True),
    db.Column('weather_type_id', db.Integer, db.ForeignKey('weather_type.id'), primary_key=True)
)

# 模板模型
class Template(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    last_modified = db.Column(db.Date, default=datetime.date.today)
    weather_type_id = db.Column(db.Integer, db.ForeignKey('weather_type.id'))
    is_active = db.Column(db.Boolean, default=True)
    attachments = db.Column(db.Text)  # 存储附件文件名的JSON字符串，例如 ["file1.pdf", "file2.docx"]
    target_role = db.Column(db.String(20), default='all')  # 新增字段：适用对象，可选值：'all'(所有人), 'customer'(客户专用), 'engineer'(工程师专用)
    
    weather_type = db.relationship('WeatherType')

# 预警规则模型
class AlertRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    weather_type_id = db.Column(db.Integer, db.ForeignKey('weather_type.id'))
    condition = db.Column(db.String(200), nullable=False)
    advance_time = db.Column(db.String(50))
    status = db.Column(db.String(20), default='活跃')
    created_at = db.Column(db.Date, default=datetime.date.today)
    
    weather_type = db.relationship('WeatherType')

# 天气数据模型
class Weather(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(100), nullable=False)
    temperature = db.Column(db.Float)
    condition = db.Column(db.String(50))
    humidity = db.Column(db.Integer)
    wind_speed = db.Column(db.Float)
    rain_probability = db.Column(db.Integer)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.now)

# 天气预报模型
class Forecast(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    weather_id = db.Column(db.Integer, db.ForeignKey('weather.id'))
    day = db.Column(db.String(20))
    high = db.Column(db.Float)
    low = db.Column(db.Float)
    condition = db.Column(db.String(50))
    
    weather = db.relationship('Weather', backref=db.backref('forecasts', lazy=True))

# 日志模型
class Log(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.now)
    recipient = db.Column(db.String(200))
    weather_type_id = db.Column(db.Integer, db.ForeignKey('weather_type.id'))
    template_id = db.Column(db.Integer, db.ForeignKey('template.id'))
    status = db.Column(db.String(20))
    region = db.Column(db.String(100))
    notification_id = db.Column(db.String(50))  # 用于跟踪通知
    email_data = db.Column(db.Text)  # 存储邮件数据的JSON字符串
    is_test = db.Column(db.Boolean, default=False)  # 标记是否为测试预警
    
    weather_type = db.relationship('WeatherType')
    template = db.relationship('Template')

# 系统设置模型
class Setting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email_sender = db.Column(db.String(100))
    email_name = db.Column(db.String(100))
    smtp_server = db.Column(db.String(100))
    smtp_port = db.Column(db.Integer)
    smtp_username = db.Column(db.String(100))
    smtp_password = db.Column(db.String(100))
    weather_api_key = db.Column(db.String(100))
    retry_count = db.Column(db.Integer, default=3)
    auto_retry = db.Column(db.Boolean, default=True)
    admin_notifications = db.Column(db.Boolean, default=True)
    send_summary = db.Column(db.Boolean, default=True)
    alert_advance_time = db.Column(db.Integer, default=24)
    refresh_interval = db.Column(db.Integer, default=12)
    first_alert = db.Column(db.Integer, default=6)
    first_alert_time = db.Column(db.String(5))  # HH:MM
    auto_approval = db.Column(db.Boolean, default=False)  # 新增自动审批字段
    last_updated = db.Column(db.DateTime, default=datetime.datetime.now)
    last_tested = db.Column(db.DateTime)
    test_result = db.Column(db.String(20), default='未测试')

# 通知模型
class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    notification_id = db.Column(db.String(50), unique=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.now)
    recipient = db.Column(db.String(200))
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    email_data = db.Column(db.Text)  # 存储邮件数据的JSON字符串
    is_test = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'notification_id': self.notification_id,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'recipient': self.recipient,
            'title': self.title,
            'content': self.content,
            'status': self.status,
            'is_test': self.is_test
        }

# 邮件任务表，用于重启后恢复未发送任务
class MailTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(100), unique=True, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, processing, sent, failed
    payload = db.Column(db.Text)  # 邮件数据JSON字符串
    is_test = db.Column(db.Boolean, default=False)
    attempts = db.Column(db.Integer, default=0)
    error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.now)

# ===== 设置时间工具 =====
# ===== 设置时间工具 =====

def _get_db_path():
    """获取当前配置的数据库路径"""
    uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if uri.startswith('sqlite:///'):
        path = uri.replace('sqlite:///', '')
        return path or DB_PATH
    return DB_PATH

def ensure_first_alert_time_column():
    """确保 setting 表存在 first_alert_time 列，兼容老库"""
    db_path = _get_db_path()
    if not db_path or not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(setting)")
        cols = [row[1] for row in cursor.fetchall()]
        if 'first_alert_time' not in cols:
            cursor.execute("ALTER TABLE setting ADD COLUMN first_alert_time VARCHAR(5)")
            # 用现有 first_alert 补齐初始值
            cursor.execute(
                "UPDATE setting SET first_alert_time = printf('%02d:00', COALESCE(first_alert, 6)) WHERE first_alert_time IS NULL"
            )
            conn.commit()
            print("已添加 first_alert_time 列并初始化")
        conn.close()
    except Exception as e:
        print(f"确保 first_alert_time 列存在时出错: {e}")
    # 确保邮件任务表存在
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS mail_task (
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
        conn.close()
    except Exception as e:
        print(f"确保 mail_task 表存在时出错: {e}")

def normalize_first_alert_time(value, fallback_hour=6):
    """将输入转换为 HH:MM 格式字符串"""
    if isinstance(value, str):
        parts = value.split(':')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            h = int(parts[0])
            m = int(parts[1])
            if 0 <= h < 24 and 0 <= m < 60:
                return f"{h:02d}:{m:02d}"
    try:
        if value is not None:
            h = int(value)
            if 0 <= h < 24:
                return f"{h:02d}:00"
    except Exception:
        pass
    # fallback
    try:
        h = int(fallback_hour)
        if 0 <= h < 24:
            return f"{h:02d}:00"
    except Exception:
        pass
    return "06:00"

def parse_first_alert_time_to_hour(time_str):
    """从 HH:MM 提取小时用于兼容旧字段"""
    try:
        if isinstance(time_str, str) and ':' in time_str:
            return int(time_str.split(':')[0])
    except Exception:
        pass
    return None

# ===== 邮件任务工具 =====

def claim_mail_tasks(is_test=None, limit=None):
    """获取待处理的邮件任务，标记为processing并返回"""
    query = MailTask.query.filter_by(status='pending')
    if is_test is not None:
        query = query.filter_by(is_test=is_test)
    if limit:
        tasks = query.order_by(MailTask.created_at).limit(limit).all()
    else:
        tasks = query.order_by(MailTask.created_at).all()
    now = datetime.datetime.now()
    for t in tasks:
        t.status = 'processing'
        t.attempts = (t.attempts or 0) + 1
        t.updated_at = now
    if tasks:
        db.session.commit()
    return tasks

def update_mail_task_status(task_id, status, error=None):
    """更新任务状态"""
    task = MailTask.query.filter_by(task_id=task_id).first()
    if not task:
        return
    task.status = status
    task.error = error
    task.updated_at = datetime.datetime.now()
    db.session.commit()


# 人员API
# 保存人员数据到JSON文件
def save_customers_to_json(customers_data):
    try:
        with open(CUSTOMERS_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(customers_data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"保存人员数据到JSON文件时出错: {e}")

# 启动时从 customers_data.json 覆盖人员表
def import_personnel_from_json(json_path=CUSTOMERS_JSON_FILE):
    if not os.path.exists(json_path):
        print(f"  - {json_path} 文件不存在，跳过人员初始化")
        return
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"  - 读取 {json_path} 失败: {e}")
        return
    
    if not isinstance(data, list):
        print(f"  - {json_path} 格式错误，期望数组，已跳过人员初始化")
        return
    
    try:
        # 先清空关联表和人员表，避免旧数据残留
        db.session.execute(personnel_weather_types.delete())
        Personnel.query.delete()
        db.session.commit()
        imported = 0
        
        for row in data:
            p = Personnel(
                name=row.get('name'),
                title=row.get('title'),
                company=row.get('company'),
                region=row.get('region'),
                email=row.get('email'),
                phone=row.get('phone'),
                category=row.get('category', '客户')
            )
            
            # 关联天气类型，不存在则创建
            for wt_name in row.get('weatherTypes', []):
                if not wt_name:
                    continue
                wt = WeatherType.query.filter_by(name=wt_name).first()
                if not wt:
                    wt = WeatherType(name=wt_name)
                    db.session.add(wt)
                    db.session.flush()
                p.weather_types.append(wt)
            
            db.session.add(p)
            imported += 1
        
        db.session.commit()
        print(f"  - 已从 {json_path} 导入 {imported} 条人员数据并覆盖旧记录")
    except Exception as e:
        db.session.rollback()
        print(f"  - 导入人员数据失败: {e}")

# 启动时从 settings.json 同步系统设置到数据库
def import_settings_from_json(json_path=SETTINGS_JSON_FILE):
    if not os.path.exists(json_path):
        print(f"  - {json_path} 文件不存在，跳过设置同步")
        return
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"  - 读取 {json_path} 失败: {e}")
        return
    
    if not isinstance(data, dict):
        print(f"  - {json_path} 格式错误，期望对象，已跳过设置同步")
        return
    
    try:
        setting = Setting.query.first() or Setting()
        
        setting.email_sender = data.get('emailSender', '') or ''
        setting.email_name = data.get('emailName', '') or ''
        setting.smtp_server = data.get('smtpServer', '') or ''
        setting.smtp_port = data.get('smtpPort', 587)
        setting.smtp_username = data.get('smtpUsername', '') or ''
        setting.smtp_password = data.get('smtpPassword', '') or ''
        setting.weather_api_key = data.get('weatherApiKey', '') or ''
        setting.retry_count = data.get('retryCount', 3)
        
        # intervalPrediction 与 autoRetry 兼容
        setting.auto_retry = data.get('intervalPrediction', data.get('autoRetry', True))
        setting.admin_notifications = data.get('adminNotifications', True)
        setting.send_summary = data.get('sendSummary', True)
        setting.alert_advance_time = data.get('alertAdvanceTime', 24)
        setting.refresh_interval = data.get('refreshInterval', data.get('warningInterval', 12))
        
        # 处理初次预警时间
        first_alert_time_str = data.get('firstAlertTime') or data.get('firstalert')
        normalized_first_time = normalize_first_alert_time(first_alert_time_str, fallback_hour=data.get('firstalert', 6))
        setting.first_alert_time = normalized_first_time
        parsed_hour = parse_first_alert_time_to_hour(normalized_first_time)
        setting.first_alert = parsed_hour if parsed_hour is not None else data.get('firstalert', 6)
        
        setting.auto_approval = data.get('autoApproval', False)
        setting.last_updated = datetime.datetime.now()
        
        # 可选字段
        if data.get('lastTested'):
            try:
                setting.last_tested = datetime.datetime.fromisoformat(data['lastTested'])
            except Exception:
                pass
        if data.get('testResult'):
            setting.test_result = data.get('testResult')
        
        db.session.add(setting)
        db.session.commit()
        print(f"  - 已从 {json_path} 同步系统设置到数据库")
    except Exception as e:
        db.session.rollback()
        print(f"  - 同步系统设置失败: {e}")

@app.route('/api/personnel', methods=['GET'])
def get_personnel():
    # 从数据库获取人员数据
    personnel = Personnel.query.all()
    result = []
    
    # 将结果转换为JSON格式
    for person in personnel:
        weather_types = [wt.name for wt in person.weather_types]
        person_data = {
            'id': person.id,
            'name': person.name,
            'title': person.title,
            'company': person.company,
            'region': person.region,
            'email': person.email,
            'phone': person.phone,
            'category': person.category,  # 添加类别字段到JSON输出
            'weatherTypes': weather_types,
            'lastUpdated': person.last_updated.strftime('%Y-%m-%d %H:%M:%S')
        }
        result.append(person_data)
    
    # 保存到JSON文件
    save_customers_to_json(result)
    
    return jsonify(result)

@app.route('/api/personnel', methods=['POST'])
def add_personnel():
    data = request.get_json()
    
    # 创建新人员
    new_person = Personnel(
        name=data.get('name'),
        title=data.get('title'),
        company=data.get('company'),
        region=data.get('region'),
        email=data.get('email'),
        phone=data.get('phone'),
        category=data.get('category', '客户')  # 添加类别字段，默认为"客户"
    )
    
    # 添加关联的天气类型
    weather_types = data.get('weatherTypes', [])
    for wt_name in weather_types:
        wt = WeatherType.query.filter_by(name=wt_name).first()
        if not wt:
            wt = WeatherType(name=wt_name)
            db.session.add(wt)
        new_person.weather_types.append(wt)
    
    # 保存到数据库
    db.session.add(new_person)
    db.session.commit()
    
    # 保存到JSON
    personnel = get_personnel()
    
    return jsonify({'success': True, 'message': '人员添加成功'})

@app.route('/api/personnel/<int:id>', methods=['PUT'])
def update_personnel(id):
    person = Personnel.query.get(id)
    if not person:
        return jsonify({'success': False, 'message': '人员不存在'}), 404
    
    data = request.get_json()
    
    # 更新基本信息
    person.name = data.get('name', person.name)
    person.title = data.get('title', person.title)
    person.company = data.get('company', person.company)
    person.region = data.get('region', person.region)
    person.email = data.get('email', person.email)
    person.phone = data.get('phone', person.phone)
    person.category = data.get('category', person.category)  # 更新类别字段
    person.last_updated = datetime.datetime.now()
    
    # 更新天气类型关系
    person.weather_types = []
    weather_types = data.get('weatherTypes', [])
    for wt_name in weather_types:
        wt = WeatherType.query.filter_by(name=wt_name).first()
        if not wt:
            wt = WeatherType(name=wt_name)
            db.session.add(wt)
        person.weather_types.append(wt)
    
    # 保存到数据库
    db.session.commit()
    
    # 保存到JSON
    personnel = get_personnel()
    
    return jsonify({'success': True, 'message': '人员更新成功'})

@app.route('/api/personnel/<int:id>', methods=['DELETE'])
def delete_personnel(id):
    person = Personnel.query.get(id)
    if not person:
        return jsonify({'success': False, 'message': '人员不存在'}), 404
    
    # 从数据库删除
    db.session.delete(person)
    db.session.commit()
    
    # 获取最新数据并保存到JSON
    all_personnel = Personnel.query.all()
    result = []
    for p in all_personnel:
        weather_types = [wt.name for wt in p.weather_types]
        result.append({
            'id': p.id,
            'name': p.name,
            'title': p.title,
            'company': p.company,
            'region': p.region,
            'email': p.email,
            'phone': p.phone,
            'category': p.category,
            'weatherTypes': weather_types,
            'lastUpdated': p.last_updated.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    # 确保数据保存到JSON文件
    save_customers_to_json(result)
    
    return jsonify({'success': True, 'message': '人员删除成功'})

# 天气类型API
@app.route('/api/weather-types', methods=['GET'])
def get_weather_types():
    types = WeatherType.query.all()
    return jsonify([{'id': t.id, 'name': t.name} for t in types])

# 模板API
@app.route('/api/templates', methods=['GET'])
def get_templates():
    templates = Template.query.all()
    result = []
    for template in templates:
        template_data = {
            'id': template.id,
            'name': template.name,
            'subject': template.subject,
            'content': template.content,
            'lastModified': template.last_modified.strftime('%Y-%m-%d'),
            'type': template.weather_type.name if template.weather_type else '',
            'isActive': template.is_active,
            'targetRole': template.target_role
        }
        
        # 添加附件信息
        if template.attachments:
            try:
                attachments = json.loads(template.attachments)
                template_data['attachments'] = attachments
            except:
                template_data['attachments'] = []
        else:
            template_data['attachments'] = []
            
        result.append(template_data)
    return jsonify(result)

@app.route('/api/templates', methods=['POST'])
def add_template():
    data = request.json
    
    # 检查必要的字段
    if not data.get('name') or not data.get('subject'):
        return jsonify({'error': '模板名称和邮件主题为必填字段'}), 400
    
    # 创建新模板
    new_template = Template(
        name=data.get('name'),
        subject=data.get('subject'),
        content=data.get('content', ''),
        is_active=data.get('isActive', True),
        target_role=data.get('targetRole', 'all')  # 添加target_role字段
    )
    
    # 处理附件
    if 'attachments' in data and data['attachments']:
        try:
            if isinstance(data['attachments'], list):
                new_template.attachments = json.dumps(data['attachments'])
            elif isinstance(data['attachments'], str):
                # 尝试解析字符串，确保是有效的JSON
                try:
                    json_data = json.loads(data['attachments'])
                    if not isinstance(json_data, list):
                        json_data = []
                    new_template.attachments = json.dumps(json_data)
                except:
                    # 如果解析失败，保存为空数组
                    new_template.attachments = "[]"
            else:
                # 如果不是列表也不是字符串，则设置为空数组
                new_template.attachments = "[]"
        except Exception as e:
            print(f"处理附件时出错: {e}")
            new_template.attachments = "[]"
    else:
        # 确保没有附件时设置为空数组
        new_template.attachments = "[]"
    
    # 设置关联的天气类型
    if data.get('type'):
        print(f"收到预警类型: {data.get('type')}")
        weather_type = WeatherType.query.filter_by(name=data.get('type')).first()
        if weather_type:
            new_template.weather_type_id = weather_type.id
            print(f"找到匹配的天气类型ID: {weather_type.id}")
        else:
            print(f"未找到匹配的天气类型: {data.get('type')}, 正在创建...")
            # 如果天气类型不存在，则创建新的天气类型
            new_weather_type = WeatherType(name=data.get('type'))
            db.session.add(new_weather_type)
            db.session.flush()  # 获取新创建的ID
            new_template.weather_type_id = new_weather_type.id
            print(f"已创建新的天气类型，ID: {new_weather_type.id}")
    else:
        print("未提供预警类型")
    
    # 保存到数据库
    db.session.add(new_template)
    db.session.commit()
    
    # 导出模板数据到JSON
    export_templates()
    
    # 返回创建的模板
    template_data = {
        'id': new_template.id,
        'name': new_template.name,
        'subject': new_template.subject,
        'content': new_template.content,
        'lastModified': new_template.last_modified.strftime('%Y-%m-%d'),
        'type': new_template.weather_type.name if new_template.weather_type else '',
        'isActive': new_template.is_active,
        'targetRole': new_template.target_role
    }
    
    # 添加附件信息
    if new_template.attachments:
        try:
            attachments = json.loads(new_template.attachments)
            template_data['attachments'] = attachments
        except:
            template_data['attachments'] = []
    else:
        template_data['attachments'] = []
    
    return jsonify(template_data), 201

@app.route('/api/templates/<int:template_id>', methods=['GET'])
def get_template(template_id):
    template = Template.query.get_or_404(template_id)
    
    template_data = {
        'id': template.id,
        'name': template.name,
        'subject': template.subject,
        'content': template.content,
        'lastModified': template.last_modified.strftime('%Y-%m-%d'),
        'type': template.weather_type.name if template.weather_type else '',
        'isActive': template.is_active,
        'targetRole': template.target_role
    }
    
    # 添加附件信息
    if template.attachments:
        try:
            attachments = json.loads(template.attachments)
            template_data['attachments'] = attachments
        except:
            template_data['attachments'] = []
    else:
        template_data['attachments'] = []
    
    return jsonify(template_data)

@app.route('/api/templates/<int:template_id>', methods=['PUT'])
def update_template(template_id):
    template = Template.query.get_or_404(template_id)
    data = request.json
    
    print(f"更新模板 ID: {template_id}, 数据: {data}")
    
    # 更新模板字段
    if 'name' in data:
        template.name = data['name']
    if 'subject' in data:
        template.subject = data['subject']
    if 'content' in data:
        template.content = data['content']
    if 'isActive' in data:
        template.is_active = data['isActive']
    if 'targetRole' in data:
        template.target_role = data['targetRole']
    
    # 处理附件
    if 'attachments' in data:
        try:
            if isinstance(data['attachments'], list):
                template.attachments = json.dumps(data['attachments'])
            elif isinstance(data['attachments'], str):
                # 尝试解析字符串，确保是有效的JSON
                try:
                    json_data = json.loads(data['attachments'])
                    if not isinstance(json_data, list):
                        json_data = []
                    template.attachments = json.dumps(json_data)
                except:
                    # 如果解析失败，保存为空数组
                    template.attachments = "[]"
            else:
                # 如果不是列表也不是字符串，则设置为空数组
                template.attachments = "[]"
        except Exception as e:
            print(f"处理附件时出错: {e}")
            template.attachments = "[]"
    
    # 更新关联的天气类型
    if 'type' in data:
        if data['type']:
            print(f"更新预警类型: {data['type']}")
            weather_type = WeatherType.query.filter_by(name=data['type']).first()
            if weather_type:
                template.weather_type_id = weather_type.id
                print(f"找到匹配的天气类型ID: {weather_type.id}")
            else:
                print(f"未找到匹配的天气类型: {data['type']}, 正在创建...")
                # 如果天气类型不存在，则创建新的天气类型
                new_weather_type = WeatherType(name=data['type'])
                db.session.add(new_weather_type)
                db.session.flush()  # 获取新创建的ID
                template.weather_type_id = new_weather_type.id
                print(f"已创建新的天气类型，ID: {new_weather_type.id}")
        else:
            print("清除预警类型")
            template.weather_type_id = None
    
    # 更新修改时间
    template.last_modified = datetime.date.today()
    
    # 保存到数据库
    db.session.commit()
    
    # 导出模板数据到JSON
    export_templates()
    
    # 返回更新后的模板
    template_data = {
        'id': template.id,
        'name': template.name,
        'subject': template.subject,
        'content': template.content,
        'lastModified': template.last_modified.strftime('%Y-%m-%d'),
        'type': template.weather_type.name if template.weather_type else '',
        'isActive': template.is_active,
        'targetRole': template.target_role
    }
    
    # 添加附件信息
    if template.attachments:
        try:
            attachments = json.loads(template.attachments)
            template_data['attachments'] = attachments
        except:
            template_data['attachments'] = []
    else:
        template_data['attachments'] = []
    
    return jsonify(template_data)

@app.route('/api/templates/<int:template_id>', methods=['DELETE'])
def delete_template(template_id):
    template = Template.query.get_or_404(template_id)
    
    # 删除模板
    db.session.delete(template)
    db.session.commit()
    
    # 导出模板数据到JSON
    export_templates()
    
    return jsonify({'success': True, 'message': f'模板 ID {template_id} 已成功删除'})

# 创建JSON文件备份
@app.route('/api/templates/export', methods=['GET'])
def export_templates():
    templates = Template.query.all()
    result = []
    
    for template in templates:
        template_data = {
            'id': template.id,
            'name': template.name,
            'subject': template.subject,
            'content': template.content,
            'lastModified': template.last_modified.strftime('%Y-%m-%d'),
            'type': template.weather_type.name if template.weather_type else '',
            'isActive': template.is_active,
            'targetRole': template.target_role
        }
        
        # 处理附件信息，确保格式一致
        if template.attachments:
            try:
                attachments = json.loads(template.attachments)
                template_data['attachments'] = attachments
            except:
                template_data['attachments'] = []
        else:
            template_data['attachments'] = []
            
        result.append(template_data)
    
    # 保存到JSON文件
    try:
        with open('templates_data.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"成功导出 {len(result)} 个模板到 templates_data.json")
        return jsonify({'success': True, 'message': f'成功导出 {len(result)} 个模板到JSON文件'})
    except Exception as e:
        print(f"导出模板数据时出错: {str(e)}")
        return jsonify({'success': False, 'message': f'导出模板失败: {str(e)}'}), 500

# 附件上传API
@app.route('/api/templates/upload-attachment', methods=['POST'])
def upload_attachment():
    # 检查是否有文件
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未找到上传的文件'}), 400
    
    file = request.files['file']
    template_id = request.form.get('templateId', 'new')
    
    # 检查文件名是否为空
    if file.filename == '':
        return jsonify({'success': False, 'message': '未选择文件'}), 400
    
    try:
        # 确保附件文件夹存在
        attachments_dir = os.path.join(os.getcwd(), 'templates')
        if not os.path.exists(attachments_dir):
            os.makedirs(attachments_dir)
        
        # 保留原始文件名中的中文，使用日期时间格式(MMDDHHMISS)作为时间戳，避免文件名冲突
        original_filename = file.filename
        base_name, ext = os.path.splitext(original_filename)
        current_time = datetime.datetime.now()
        time_suffix = current_time.strftime("%m%d%H%M%S") # 格式: MMDDHHMISS
        unique_filename = f"{base_name}_{time_suffix}{ext}"
        
        # 保存文件
        file_path = os.path.join(attachments_dir, unique_filename)
        file.save(file_path)
        
        print(f"文件已保存: {file_path}")
        
        # 如果是更新已有模板，也更新模板的附件字段
        if template_id != 'new' and template_id.isdigit():
            template = Template.query.get(int(template_id))
            if template:
                attachments = []
                if template.attachments:
                    try:
                        attachments = json.loads(template.attachments)
                    except:
                        attachments = []
                
                # 确保attachments是数组
                if not isinstance(attachments, list):
                    attachments = []
                
                # 添加新附件
                attachments.append(unique_filename)
                template.attachments = json.dumps(attachments)
                db.session.commit()
                print(f"模板 {template_id} 的附件已更新")
        
        return jsonify({
            'success': True, 
            'message': '文件上传成功',
            'filename': unique_filename,
            'path': file_path
        })
        
    except Exception as e:
        print(f"上传附件时出错: {str(e)}")
        return jsonify({'success': False, 'message': f'上传附件失败: {str(e)}'}), 500

@app.route('/api/templates/delete-attachment', methods=['POST'])
def delete_attachment():
    data = request.json
    filename = data.get('filename')
    template_id = data.get('templateId')
    
    if not filename:
        return jsonify({'success': False, 'message': '未提供文件名'}), 400
    
    try:
        # 1. 附件文件路径
        file_path = os.path.join(os.getcwd(), 'templates', filename)
        file_deleted = False
        
        # 如果文件存在，删除它
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                file_deleted = True
                print(f"已删除文件: {file_path}")
            except Exception as e:
                print(f"删除文件 {file_path} 时出错: {str(e)}")
                return jsonify({'success': False, 'message': f'无法删除文件: {str(e)}'}), 500
        else:
            print(f"警告: 文件不存在: {file_path}")
        
        # 2. 如果提供了模板ID，也从模板的附件列表中移除
        template_updated = False
        if template_id:
            # 检查template_id类型并正确处理
            template_id_int = None
            if isinstance(template_id, int):
                template_id_int = template_id
            elif isinstance(template_id, str) and template_id.isdigit():
                template_id_int = int(template_id)
                
            if template_id_int is not None:
                template = Template.query.get(template_id_int)
                if template and template.attachments:
                    try:
                        attachments = json.loads(template.attachments)
                        if filename in attachments:
                            attachments.remove(filename)
                            template.attachments = json.dumps(attachments)
                            db.session.commit()
                            template_updated = True
                            print(f"已从模板 {template_id} 中移除附件 {filename}")
                        else:
                            print(f"警告: 附件 {filename} 不在模板 {template_id} 的附件列表中")
                    except Exception as e:
                        print(f"从模板中移除附件时出错: {str(e)}")
                        return jsonify({'success': False, 'message': f'无法更新模板: {str(e)}'}), 500
                else:
                    print(f"警告: 未找到模板或模板没有附件: {template_id}")
        
        # 3. 返回操作结果
        if file_deleted or template_updated:
            return jsonify({'success': True, 'message': '附件已成功删除'})
        else:
            return jsonify({'success': True, 'message': '操作完成，但没有实际删除任何内容'})
        
    except Exception as e:
        print(f"删除附件时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'删除附件失败: {str(e)}'}), 500

# 预警规则API
@app.route('/api/alert-rules', methods=['GET'])
def get_alert_rules():
    # 尝试从 JSON 文件读取预警规则数据
    try:
        with open('alert_rules.json', 'r', encoding='utf-8') as f:
            rules = json.load(f)
        print(f"成功读取预警规则数据: {len(rules)} 条规则")
        return jsonify(rules)
    except FileNotFoundError:
        print("预警规则文件不存在")
        return jsonify([])
    except json.JSONDecodeError as e:
        print(f"预警规则文件格式错误: {str(e)}")
        return jsonify([])
    except Exception as e:
        print(f"读取预警规则时发生错误: {str(e)}")
        return jsonify([]), 500

@app.route('/api/alert-rules', methods=['POST'])
def add_alert_rule():
    # 获取请求数据
    rule_data = request.json
    
    # 验证必要字段
    if not all(key in rule_data for key in ['type', 'condition']):
        return jsonify({'error': '缺少必要字段'}), 400
    
    # 读取现有规则
    try:
        with open('alert_rules.json', 'r', encoding='utf-8') as f:
            rules = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        rules = []
    
    # 生成新ID
    new_id = 1
    if rules:
        new_id = max(rule['id'] for rule in rules) + 1
    
    # 确保规则包含所有必要字段
    rule_data['id'] = new_id
    if 'createdAt' not in rule_data:
        rule_data['createdAt'] = datetime.datetime.now().strftime('%Y-%m-%d')
    if 'status' not in rule_data:
        rule_data['status'] = '活跃'
    
    # 添加新规则
    rules.append(rule_data)
    
    # 保存到文件
    with open('alert_rules.json', 'w', encoding='utf-8') as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)
    
    return jsonify(rule_data), 201

@app.route('/api/alert-rules/<int:rule_id>', methods=['PUT'])
def update_alert_rule(rule_id):
    # 获取请求数据
    rule_data = request.json
    
    # 记录请求数据，便于调试
    print(f"收到更新预警规则请求，ID: {rule_id}, 数据: {rule_data}")
    
    # 验证必要字段
    if not rule_data:
        print(f"请求数据为空，ID: {rule_id}")
        return jsonify({'error': '请求数据为空'}), 400
        
    if not all(key in rule_data for key in ['type', 'condition']):
        missing_keys = [key for key in ['type', 'condition'] if key not in rule_data]
        print(f"缺少必要字段: {missing_keys}, ID: {rule_id}")
        return jsonify({'error': f'缺少必要字段: {missing_keys}'}), 400
    
    # 读取现有规则
    try:
        with open('alert_rules.json', 'r', encoding='utf-8') as f:
            rules = json.load(f)
        print(f"成功读取预警规则文件，共 {len(rules)} 条规则")
    except FileNotFoundError:
        print("预警规则文件不存在")
        return jsonify({'error': '找不到预警规则文件'}), 404
    except json.JSONDecodeError as e:
        print(f"预警规则文件格式错误: {str(e)}")
        return jsonify({'error': f'预警规则文件格式错误: {str(e)}'}), 500
    except Exception as e:
        print(f"读取预警规则时发生错误: {str(e)}")
        return jsonify({'error': f'读取预警规则时发生错误: {str(e)}'}), 500
    
    # 查找要更新的规则
    rule_index = None
    for i, rule in enumerate(rules):
        if rule.get('id') == rule_id:
            rule_index = i
            break
    
    if rule_index is None:
        print(f"找不到ID为 {rule_id} 的预警规则")
        return jsonify({'error': f'找不到ID为{rule_id}的预警规则'}), 404
    
    # 更新规则，保留原有ID和创建日期
    rule_data['id'] = rule_id
    if 'createdAt' not in rule_data and 'createdAt' in rules[rule_index]:
        rule_data['createdAt'] = rules[rule_index]['createdAt']
    
    # 确保所有必要字段都存在
    if 'status' not in rule_data:
        rule_data['status'] = rules[rule_index].get('status', '活跃')
    if 'alertType' not in rule_data:
        rule_data['alertType'] = rules[rule_index].get('alertType', 'parameter')
    
    # 如果原规则中有advanceTime字段且用户提交的数据中没有，保留原有值
    if 'advanceTime' in rules[rule_index] and 'advanceTime' not in rule_data:
        rule_data['advanceTime'] = rules[rule_index]['advanceTime']
    
    # 更新规则
    old_rule = rules[rule_index].copy()
    rules[rule_index] = rule_data
    
    print(f"更新预警规则，ID: {rule_id}")
    print(f"旧数据: {old_rule}")
    print(f"新数据: {rule_data}")
    
    # 保存到文件
    try:
        with open('alert_rules.json', 'w', encoding='utf-8') as f:
            json.dump(rules, f, ensure_ascii=False, indent=2)
        print(f"成功保存预警规则文件，共 {len(rules)} 条规则")
    except Exception as e:
        print(f"保存预警规则时发生错误: {str(e)}")
        return jsonify({'error': f'保存预警规则时发生错误: {str(e)}'}), 500
    
    return jsonify(rule_data)

@app.route('/api/alert-rules/<int:rule_id>', methods=['DELETE'])
def delete_alert_rule(rule_id):
    # 读取现有规则
    try:
        with open('alert_rules.json', 'r', encoding='utf-8') as f:
            rules = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return jsonify({'error': '找不到预警规则'}), 404
    
    # 查找要删除的规则
    rule_index = None
    for i, rule in enumerate(rules):
        if rule.get('id') == rule_id:
            rule_index = i
            break
    
    if rule_index is None:
        return jsonify({'error': '找不到指定ID的预警规则'}), 404
    
    # 删除规则
    deleted_rule = rules.pop(rule_index)
    
    # 保存到文件
    with open('alert_rules.json', 'w', encoding='utf-8') as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)
    
    return jsonify({'message': '预警规则删除成功', 'deleted': deleted_rule})

# 天气数据API
@app.route('/api/weather', methods=['GET'])
def get_weather():
    weather_data = Weather.query.all()
    result = []
    for weather in weather_data:
        forecasts = []
        for forecast in weather.forecasts:
            forecasts.append({
                'day': forecast.day,
                'high': forecast.high,
                'low': forecast.low,
                'condition': forecast.condition
            })
        
        result.append({
            'id': weather.id,
            'city': weather.city,
            'temperature': weather.temperature,
            'condition': weather.condition,
            'humidity': weather.humidity,
            'windSpeed': weather.wind_speed,
            'rainProbability': weather.rain_probability,
            'forecast': forecasts
        })
    return jsonify(result)

# 日志API
@app.route('/api/logs', methods=['GET'])
def get_logs():
    """获取日志数据，从 data.json 中读取"""
    # 获取查询参数
    show_test = request.args.get('show_test', 'false').lower() == 'true'
    
    try:
        # 从 data.json 读取日志数据
        with open('data.json', 'r', encoding='utf-8') as f:
            logs = json.load(f)
        
        # 如果不显示测试记录，则过滤掉测试记录
        if not show_test:
            logs = [log for log in logs if not log.get('is_test', False)]
        
        # 按时间戳降序排序
        logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify(logs)
    except FileNotFoundError:
        # 如果文件不存在，返回空列表
        return jsonify([])
    except json.JSONDecodeError as e:
        print(f"读取 data.json 失败: {str(e)}")
        return jsonify([])
    except Exception as e:
        print(f"处理日志数据时出错: {str(e)}")
        return jsonify([])

@app.route('/api/logs/<int:log_id>', methods=['DELETE'])
def delete_log(log_id):
    """删除指定的日志记录"""
    try:
        # 读取日志数据
        with open('data.json', 'r', encoding='utf-8') as f:
            logs = json.load(f)
        
        # 查找并删除指定ID的日志
        found = False
        for i, log in enumerate(logs):
            if log['id'] == log_id:
                logs.pop(i)
                found = True
                break
        
        if not found:
            return jsonify({'success': False, 'message': '未找到指定日志记录'}), 404
        
        # 保存更新后的日志数据
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(logs, f, ensure_ascii=False, indent=4)
        trim_json_file('data.json', 'data_log', max_entries=DATA_LOG_MAX_ENTRIES)
        
        return jsonify({'success': True, 'message': '日志记录已删除'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'删除日志失败: {str(e)}'}), 500

# 系统设置API
@app.route('/api/settings', methods=['GET'])
def get_settings():
    ensure_first_alert_time_column()
    # 首先尝试从数据库获取设置
    setting = Setting.query.first()
    settings_data = {}
    
    if setting:
        first_alert_time = setting.first_alert_time or normalize_first_alert_time(setting.first_alert)
        first_alert_int = parse_first_alert_time_to_hour(first_alert_time) or setting.first_alert
        settings_data = {
            'emailSender': setting.email_sender,
            'emailName': setting.email_name,
            'smtpServer': setting.smtp_server,
            'smtpPort': setting.smtp_port,
            'smtpUsername': setting.smtp_username,
            'smtpPassword': setting.smtp_password,
            'weatherApiKey': setting.weather_api_key,
            'retryCount': setting.retry_count,
            'autoRetry': setting.auto_retry,
            'adminNotifications': setting.admin_notifications,
            'sendSummary': setting.send_summary,
            'alertAdvanceTime': setting.alert_advance_time,
            'warningInterval': setting.refresh_interval,
            'firstalert': first_alert_int,
            'firstAlertTime': first_alert_time,
            'autoApproval': setting.auto_approval,  # 添加自动审批字段
            'lastUpdated': setting.last_updated.isoformat() if setting.last_updated else None,
            'lastTested': setting.last_tested.isoformat() if setting.last_tested else None,
            'testResult': setting.test_result
        }
    
    # 如果数据库中没有数据，则尝试从JSON文件加载
    if not setting or not any(settings_data.values()):
        try:
            with open(SETTINGS_JSON_FILE, 'r', encoding='utf-8') as f:
                settings_data = json.load(f)
            # 兼容老字段，填充 firstAlertTime
            if 'firstAlertTime' not in settings_data:
                fallback_first = settings_data.get('firstalert', 6)
                settings_data['firstAlertTime'] = normalize_first_alert_time(fallback_first)
            print(f"从JSON文件加载了设置数据")
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"无法从JSON文件加载设置: {e}")
    
    return jsonify(settings_data)

@app.route('/api/settings', methods=['POST'])
def update_settings():
    ensure_first_alert_time_column()
    data = request.json
    setting = Setting.query.first()
    
    if not setting:
        setting = Setting()
    
    # 记录旧的时间设置
    old_interval = setting.refresh_interval
    old_first_alert = setting.first_alert
    old_first_alert_time = setting.first_alert_time or normalize_first_alert_time(setting.first_alert)
    old_alert_advance = setting.alert_advance_time
    
    # 更新数据库中的设置
    setting.email_sender = data.get('emailSender', '')
    setting.email_name = data.get('emailName', '')
    setting.smtp_server = data.get('smtpServer', '')
    setting.smtp_port = data.get('smtpPort', 587)
    setting.smtp_username = data.get('smtpUsername', '')
    setting.smtp_password = data.get('smtpPassword', '')
    setting.weather_api_key = data.get('weatherApiKey', '')
    setting.retry_count = data.get('retryCount', 3)
    
    # 修改autoRetry为intervalPrediction
    if 'intervalPrediction' in data:
        setting.auto_retry = data.get('intervalPrediction', True)
    elif 'autoRetry' in data:
        setting.auto_retry = data.get('autoRetry', True)
    
    setting.admin_notifications = data.get('adminNotifications', True)
    setting.send_summary = data.get('sendSummary', True)
    setting.alert_advance_time = data.get('alertAdvanceTime', 24)
    setting.refresh_interval = data.get('warningInterval', 12)
    
    # 处理初次预警时间（时:分）
    first_alert_time_str = data.get('firstAlertTime')
    if not first_alert_time_str:
        first_alert_time_str = data.get('firstalert')
    normalized_first_time = normalize_first_alert_time(first_alert_time_str, fallback_hour=data.get('firstalert', 6))
    setting.first_alert_time = normalized_first_time
    # 兼容旧字段：仅保存小时部分
    parsed_hour = parse_first_alert_time_to_hour(normalized_first_time)
    setting.first_alert = parsed_hour if parsed_hour is not None else 6
    setting.auto_approval = data.get('autoApproval', False)  # 处理自动审批字段
    setting.last_updated = datetime.datetime.now()
    
    db.session.add(setting)
    db.session.commit()
    
    # 同时保存到JSON文件
    try:
        # 添加最后更新时间
        data['lastUpdated'] = datetime.datetime.now().isoformat()
        data['firstAlertTime'] = normalized_first_time
        data['firstalert'] = parsed_hour if parsed_hour is not None else setting.first_alert
        
        with open(SETTINGS_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"设置已保存到JSON文件")
    except Exception as e:
        print(f"保存设置到JSON文件时出错: {e}")
    
    # 如果预警时间相关设置发生变化，重启预警系统以立即生效
    if (
        old_interval != setting.refresh_interval
        or old_first_alert != setting.first_alert
        or old_first_alert_time != setting.first_alert_time
        or old_alert_advance != setting.alert_advance_time
    ):
        try:
            # 停止当前的预警系统
            global stop_weather_alert, weather_alert_thread
            if weather_alert_thread and weather_alert_thread.is_alive():
                print("正在停止旧的预警线程...")
                stop_weather_alert = True
                
                # 等待线程停止，最多等待10秒
                wait_time = 0
                while weather_alert_thread.is_alive() and wait_time < 10:
                    time.sleep(1)
                    wait_time += 1
                    print(f"等待线程停止: {wait_time}秒...")
                
                if weather_alert_thread.is_alive():
                    print("警告：旧线程在10秒内未能停止")
                else:
                    print("旧线程已成功停止")
            else:
                print("没有找到活动的预警线程，或线程已经停止")
            
            # 确保停止标志被重置
            stop_weather_alert = False
            
            # 启动新的预警系统
            print("正在启动新的预警线程...")
            weather_alert_thread = Thread(target=run_weather_alert_background)
            weather_alert_thread.daemon = True
            weather_alert_thread.start()
            print("预警系统已重启")
            
            return jsonify({
                'message': '设置已更新，预警系统已重启',
                'success': True,
                'systemRestarted': True
            })
        except Exception as e:
            print(f"重启预警系统时出错: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'message': '设置已更新，但重启预警系统失败',
                'success': True,
                'systemRestarted': False,
                'error': str(e)
            })
    
    return jsonify({'message': '设置已更新', 'success': True, 'systemRestarted': False})

@app.route('/api/settings/test-email', methods=['POST'])
def test_email_connection():
    data = request.json
    
    # 获取测试所需的邮件服务器信息
    sender = data.get('emailSender', '')
    name = data.get('emailName', '')
    server = data.get('smtpServer', '')
    port = data.get('smtpPort', 587)
    username = data.get('smtpUsername', '')
    password = data.get('smtpPassword', '')
    
    # 验证必要的字段
    if not all([sender, server, port]):
        return jsonify({
            'success': False,
            'message': '请填写所有必要的邮件服务器信息'
        })
    
    try:
        print(f"正在测试SMTP连接: {server}:{port}")
        
        # 根据端口选择不同的连接方式
        if port == 465:
            # 端口465使用SSL连接
            print("使用SSL连接 (端口465)")
            import ssl
            context = ssl.create_default_context()
            smtp = smtplib.SMTP_SSL(server, port, context=context, timeout=30)
        else:
            # 端口25和587使用普通连接
            print(f"使用普通连接 (端口{port})")
            smtp = smtplib.SMTP(server, port, timeout=30)
            smtp.ehlo()
            
            # 只有端口587才启动STARTTLS
            if port == 587:
                print("启动STARTTLS加密")
                smtp.starttls()
                smtp.ehlo()
            elif port == 25:
                print("端口25使用明文连接，不启动TLS")
        
        # 尝试登录（如果服务器支持认证）
        try:
            if username and password:
                print(f"尝试使用用户名登录: {username}")
                smtp.login(username, password)
                print("登录成功")
            else:
                print("未提供用户名密码，跳过认证")
        except smtplib.SMTPNotSupportedError:
            print("服务器不支持认证，继续执行")
            # 如果服务器不支持认证，继续执行
            pass
        except Exception as login_error:
            print(f"登录失败: {str(login_error)}")
            raise
        
        # 发送测试邮件
        message = MIMEMultipart()
        # 使用formataddr正确处理中文名称和邮件地址
        message['From'] = formataddr((name, sender))
        message['To'] = sender
        message['Subject'] = "SMTP连接测试"
        message.attach(MIMEText("这是一封测试邮件，确认SMTP服务器连接正常。", "plain"))
        
        # 尝试发送测试邮件
        smtp.sendmail(sender, [sender], message.as_string())
        
        # 关闭连接
        smtp.quit()
        
        # 获取当前时间
        current_time = datetime.datetime.now()
        formatted_time = current_time.strftime('%Y-%m-%d %H:%M')
        
        # 更新数据库中的最后测试时间
        setting = Setting.query.first()
        if setting:
            setting.last_tested = current_time
            setting.test_result = '成功'
            db.session.commit()
            print(f"数据库中的最后测试时间已更新: {formatted_time}")
        
        # 更新JSON文件中的最后测试时间
        try:
            with open(SETTINGS_JSON_FILE, 'r', encoding='utf-8') as f:
                settings_data = json.load(f)
            
            settings_data['lastTested'] = current_time.isoformat()
            settings_data['testResult'] = '成功'
            
            with open(SETTINGS_JSON_FILE, 'w', encoding='utf-8') as f:
                json.dump(settings_data, f, ensure_ascii=False, indent=2)
            print(f"JSON文件中的最后测试时间已更新: {formatted_time}")
        except Exception as e:
            print(f"更新JSON文件中的最后测试时间失败: {e}")
        
        # 返回成功消息，包含更新的时间
        return jsonify({
            'success': True,
            'message': '邮件服务器连接测试成功',
            'lastTested': formatted_time
        })
        
    except Exception as e:
        # 获取当前时间
        current_time = datetime.datetime.now()
        
        # 记录失败状态到数据库
        setting = Setting.query.first()
        if setting:
            setting.last_tested = current_time
            setting.test_result = '失败'
            db.session.commit()
        
        # 记录失败状态到JSON文件
        try:
            with open(SETTINGS_JSON_FILE, 'r', encoding='utf-8') as f:
                settings_data = json.load(f)
            
            settings_data['lastTested'] = current_time.isoformat()
            settings_data['testResult'] = '失败'
            
            with open(SETTINGS_JSON_FILE, 'w', encoding='utf-8') as f:
                json.dump(settings_data, f, ensure_ascii=False, indent=2)
        except Exception as json_e:
            print(f"更新JSON文件中的测试结果失败: {json_e}")
        
        # 返回错误信息
        return jsonify({
            'success': False,
            'message': f'连接失败: {str(e)}'
        })

# 天气API部分
# 和风天气API配置
WEATHER_API_KEY = "a497cf5a4f624c8e882b0b0ed34e20da"  # 这里应该使用系统设置中的API Key
WEATHER_CITY_API = "https://geoapi.qweather.com/v2/city/lookup"
WEATHER_DAILY_API = "https://api.qweather.com/v7/weather/3d"
WEATHER_HOURLY_API = "https://api.qweather.com/v7/weather/24h"
HTTP_TIMEOUT = 15  # 外部HTTP请求超时时间（秒）

# 常用城市列表
POPULAR_CITIES = ["北京", "上海", "广州", "深圳", "成都", "杭州", "重庆", "西安", "武汉", "南京"]

# 用户收藏的城市 (实际应用中应该存储在数据库中)
user_favorite_cities = ["北京", "上海", "广州"]

@app.route('/api/weather/search', methods=['GET'])
def search_weather():
    """根据城市名称搜索天气信息"""
    start_time = datetime.datetime.now()
    city = request.args.get('city', '')
    print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] 正在请求天气API | 城市: {city}")
    
    try:
        if not city:
            return jsonify({"code": "400", "message": "城市名称不能为空"}), 400
        
        # 首先获取城市ID
        city_info = get_city_info(city)
        response_time = datetime.datetime.now()
        duration = (response_time - start_time).total_seconds()
        
        print(f"[{response_time.strftime('%H:%M:%S')}] 城市查询完成 | 耗时: {duration:.2f}秒")
        
        if not city_info:
            return jsonify({"code": "404", "message": f"未找到城市: {city}"}), 404
        
        # 获取城市ID
        city_id = city_info[0].get('id')
        city_name = city_info[0].get('name')
        
        # 获取天气数据
        weather_data = get_weather_data(city_id, city_name)
        
        end_time = datetime.datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        print(f"[{end_time.strftime('%H:%M:%S')}] 请求完成 | 总耗时: {total_duration:.2f}秒")
        
        return jsonify(weather_data)
    except Exception as e:
        error_time = datetime.datetime.now()
        print(f"[{error_time.strftime('%H:%M:%S')}] 异常发生 | 错误: {str(e)}")
        app.logger.error(f"搜索天气时出错: {str(e)}")
        return jsonify({"code": "500", "message": f"服务器错误: {str(e)}"}), 500

@app.route('/api/weather/default', methods=['GET'])
def get_default_weather():
    """获取默认城市的天气信息（默认为北京）"""
    try:
        default_city = "北京"
        
        # 获取城市ID
        city_info = get_city_info(default_city)
        if not city_info:
            return jsonify({"code": "404", "message": f"未找到默认城市数据"}), 404
        
        city_id = city_info[0].get('id')
        city_name = city_info[0].get('name')
        
        # 获取天气数据
        weather_data = get_weather_data(city_id, city_name)
        
        return jsonify(weather_data)
    except Exception as e:
        app.logger.error(f"获取默认天气时出错: {str(e)}")
        return jsonify({"code": "500", "message": f"服务器错误: {str(e)}"}), 500

@app.route('/api/weather/my-cities', methods=['GET'])
def get_my_cities_weather():
    """获取我的城市的天气信息"""
    try:
        result = {"code": "200", "cities": []}
        start_time = datetime.datetime.now()
        print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] 开始获取收藏城市天气数据")
        
        # 从JSON文件加载收藏的城市列表
        favorite_cities = load_favorite_cities()
        
        # 获取每个收藏城市的天气数据
        for city in favorite_cities:
            # 获取城市ID
            city_info = get_city_info(city)
            if city_info:
                city_id = city_info[0].get('id')
                city_name = city_info[0].get('name')
                
                # 获取天气数据
                weather_data = get_weather_data(city_id, city_name)
                if weather_data.get("code") == "200":
                    result["cities"].append(weather_data)
        
        end_time = datetime.datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        print(f"[{end_time.strftime('%H:%M:%S')}] 收藏城市天气数据获取完成 | 总耗时: {total_duration:.2f}秒")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"获取我的城市天气时出错: {str(e)}")
        return jsonify({"code": "500", "message": f"服务器错误: {str(e)}"}), 500

@app.route('/api/weather/popular-cities', methods=['GET'])
def get_popular_cities_weather():
    """获取常用城市的天气信息"""
    try:
        result = {"code": "200", "cities": []}
        start_time = datetime.datetime.now()
        print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] 开始获取热门城市天气数据")
        
        for city in POPULAR_CITIES[:5]:  # 只获取前5个城市，避免请求过多
            # 获取城市ID
            city_info = get_city_info(city)
            if city_info:
                city_id = city_info[0].get('id')
                city_name = city_info[0].get('name')
                
                # 获取天气数据
                weather_data = get_weather_data(city_id, city_name)
                if weather_data.get("code") == "200":
                    result["cities"].append(weather_data)
        
        end_time = datetime.datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        print(f"[{end_time.strftime('%H:%M:%S')}] 热门城市天气数据获取完成 | 总耗时: {total_duration:.2f}秒")
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"获取常用城市天气时出错: {str(e)}")
        return jsonify({"code": "500", "message": f"服务器错误: {str(e)}"}), 500

import json
import os

def load_favorite_cities():
    try:
        with open('favorite_cities.json', 'r') as f:
            data = json.load(f)
            return data.get('favorite_cities', [])
    except FileNotFoundError:
        return []

def save_favorite_cities(cities):
    with open('favorite_cities.json', 'w') as f:
        json.dump({'favorite_cities': cities}, f, indent=2)

@app.route('/api/weather/add-favorite', methods=['POST'])
def add_favorite_city():
    """添加城市到收藏列表"""
    try:
        data = request.json
        city = data.get('city')
        
        if not city:
            return jsonify({"success": False, "message": "城市名称不能为空"}), 400
        
        # 检查城市是否存在
        city_info = get_city_info(city)
        if not city_info:
            return jsonify({"success": False, "message": f"未找到城市: {city}"}), 404
        
        # 添加到收藏列表（如果不存在）
        favorite_cities = load_favorite_cities()
        if city not in favorite_cities:
            favorite_cities.append(city)
            save_favorite_cities(favorite_cities)
        
        return jsonify({"success": True, "message": "添加成功"})
    except Exception as e:
        app.logger.error(f"添加收藏城市时出错: {str(e)}")
        return jsonify({"success": False, "message": f"服务器错误: {str(e)}"}), 500

@app.route('/api/weather/remove-favorite', methods=['POST'])
def remove_favorite_city():
    """从收藏列表中移除城市"""
    try:
        data = request.json
        city = data.get('city')
        
        if not city:
            return jsonify({"success": False, "message": "城市名称不能为空"}), 400
        
        # 从收藏列表中移除
        favorite_cities = load_favorite_cities()
        if city in favorite_cities:
            favorite_cities.remove(city)
            save_favorite_cities(favorite_cities)
            return jsonify({"success": True, "message": "移除成功"})
        else:
            return jsonify({"success": False, "message": "该城市未在收藏列表中"}), 404
    except Exception as e:
        app.logger.error(f"移除收藏城市时出错: {str(e)}")
        return jsonify({"success": False, "message": f"服务器错误: {str(e)}"}), 500

@app.route('/api/weather/get-favorites', methods=['GET'])
def get_favorite_cities():
    """获取收藏的城市列表"""
    try:
        favorite_cities = load_favorite_cities()
        return jsonify({"success": True, "cities": favorite_cities})
    except Exception as e:
        app.logger.error(f"获取收藏城市列表时出错: {str(e)}")
        return jsonify({"success": False, "message": f"服务器错误: {str(e)}"}), 500

@app.route('/api/weather/clear-cache', methods=['POST'])
def clear_weather_cache():
    """清除天气数据缓存"""
    try:
        # 获取请求参数
        data = request.json or {}
        city = data.get('city')
        
        if city:
            # 清除指定城市的缓存
            city_cache_key = f"city_{city}"
            weather_cache.clear(city_cache_key)
            
            # 获取城市ID并清除对应的天气缓存
            city_info = get_city_info(city)
            if city_info:
                city_id = city_info[0].get('id')
                weather_cache_key = f"weather_{city_id}"
                weather_cache.clear(weather_cache_key)
            
            return jsonify({"success": True, "message": f"已清除城市 {city} 的缓存"})
        else:
            # 清除所有缓存
            weather_cache.clear()
            return jsonify({"success": True, "message": "已清除所有天气缓存"})
    except Exception as e:
        app.logger.error(f"清除天气缓存时出错: {str(e)}")
        return jsonify({"success": False, "message": f"服务器错误: {str(e)}"}), 500

def get_city_info(city_name):
    """根据城市名称获取城市ID等信息，优先从缓存获取"""
    try:
        # 生成缓存键名
        cache_key = f"city_{city_name}"
        
        # 尝试从缓存获取数据
        cached_data = weather_cache.get(cache_key)
        if cached_data:
            print(f"从缓存获取城市信息 | 城市: {city_name}")
            return cached_data
        
        # 缓存中没有数据，从API获取
        print(f"请求城市信息API | 城市: {city_name}")
        
        # 请求参数
        params = {
            "location": city_name,
            "key": WEATHER_API_KEY
        }
        
        # 发送GET请求
        response = requests.get(WEATHER_CITY_API, params=params, timeout=HTTP_TIMEOUT)
        
        # 检查响应状态
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "200":
                location_data = data.get("location", [])
                # 将结果存入缓存
                weather_cache.set(cache_key, location_data)
                return location_data
        
        return []
    except Exception as e:
        app.logger.error(f"获取城市信息时出错: {str(e)}")
        return []

# 导入天气缓存模块
from weather_cache import WeatherCache

# 初始化天气缓存
weather_cache = WeatherCache(cache_duration=7200)  # 缓存2小时

def get_weather_data(city_id, city_name):
    """获取指定城市的天气数据，优先从缓存获取"""
    start_time = datetime.datetime.now()
    
    # 生成缓存键名
    cache_key = f"weather_{city_id}"
    
    # 尝试从缓存获取数据
    cached_data = weather_cache.get(cache_key)
    if cached_data:
        print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] 从缓存获取天气数据 | 城市: {city_name} | ID: {city_id}")
        return cached_data
    
    # 缓存中没有数据，从API获取
    print(f"[{start_time.strftime('%Y-%m-%d %H:%M:%S')}] 正在请求天气API | 城市: {city_name} | ID: {city_id}")
    
    try:
        # 获取每日天气预报
        daily_params = {
            "location": city_id,
            "key": WEATHER_API_KEY
        }
        daily_response = requests.get(WEATHER_DAILY_API, params=daily_params, timeout=HTTP_TIMEOUT)
        
        # 获取每小时天气预报
        hourly_params = {
            "location": city_id,
            "key": WEATHER_API_KEY
        }
        hourly_response = requests.get(WEATHER_HOURLY_API, params=hourly_params, timeout=HTTP_TIMEOUT)
        
        # 检查响应
        response_time = datetime.datetime.now()
        duration = (response_time - start_time).total_seconds()
        
        if daily_response.status_code != 200 or hourly_response.status_code != 200:
            print(f"[{response_time.strftime('%H:%M:%S')}] API请求失败 | 城市: {city_name} | 耗时: {duration:.2f}秒")
            return {"code": "500", "message": "获取天气数据失败"}
        
        daily_data = daily_response.json()
        hourly_data = hourly_response.json()
        
        if daily_data.get("code") != "200" or hourly_data.get("code") != "200":
            print(f"[{response_time.strftime('%H:%M:%S')}] API返回错误 | 城市: {city_name} | 耗时: {duration:.2f}秒")
            return {"code": "500", "message": "天气API返回错误"}
        
        # 组合数据
        result = {
            "code": "200",
            "city": city_name,
            "cityId": city_id,
            "updateTime": daily_data.get("updateTime"),
            "daily": daily_data.get("daily", []),
            "hourly": hourly_data.get("hourly", [])
        }
        
        # 将结果存入缓存
        weather_cache.set(cache_key, result)
        
        end_time = datetime.datetime.now()
        total_duration = (end_time - start_time).total_seconds()
        print(f"[{end_time.strftime('%H:%M:%S')}] 天气数据获取成功并缓存 | 城市: {city_name} | 总耗时: {total_duration:.2f}秒")
        return result
    except Exception as e:
        app.logger.error(f"获取天气数据时出错: {str(e)}")
        return {"code": "500", "message": f"获取天气数据出错: {str(e)}"}

# 定期清理过期缓存的函数
def clean_expired_cache():
    """清理过期的天气缓存数据"""
    try:
        weather_cache.clear_expired()
        print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 已清理过期的天气缓存")
    except Exception as e:
        app.logger.error(f"清理过期缓存时出错: {str(e)}")

# 初始化数据库和添加示例数据
def init_db():
    """初始化数据库"""
    # 清理过期缓存
    clean_expired_cache()
    ensure_first_alert_time_column()
    
    # 删除旧的数据库文件
    # try:
    #     db_path = 'instance/skyalert.db'
    #     if os.path.exists(db_path):
    #         try:
    #             os.remove(db_path)
    #             print("已删除旧的数据库文件")
    #         except PermissionError:
    #             print("无法删除数据库文件，它可能正在被使用。将尝试直接使用现有数据库。")
    # except Exception as e:
    #     print(f"处理数据库文件时出错: {str(e)}")
    
    with app.app_context():
        # 创建新的数据库表
        try:
            db.create_all()
            print("已创建/更新数据库表")
        except Exception as e:
            print(f"创建数据库表时出错: {str(e)}")
            print("尝试继续使用现有数据库...")
        
        # 初始化天气类型数据
        weather_types = [
            '暴雨', '高温', '台风', '雷电', '大雾', '大风',
            '寒潮', '霜冻', '冰雹', '沙尘暴', '雪灾', '干旱', '低温'
        ]
        
        # 检查是否已存在天气类型
        existing_types = WeatherType.query.all()
        if not existing_types:
            for type_name in weather_types:
                db.session.add(WeatherType(name=type_name))
            db.session.commit()
            print("已初始化天气类型数据")
        else:
            # 检查是否需要添加新的天气类型
            existing_type_names = [et.name for et in existing_types]
            for type_name in weather_types:
                if type_name not in existing_type_names:
                    db.session.add(WeatherType(name=type_name))
                    print(f"添加新的天气类型: {type_name}")
            
            if any(type_name not in existing_type_names for type_name in weather_types):
                db.session.commit()
        
        # 从 JSON 覆盖人员表
        print("\n3. 初始化人员数据...")
        import_personnel_from_json()
        
        # 初始化模板数据
        print("\n4. 初始化模板数据...")
        try:
            # 读取templates_data.json
            with open('templates_data.json', 'r', encoding='utf-8') as f:
                templates_data = json.load(f)
            
            # 导入模板数据
            for template_data in templates_data:
                # 检查是否已存在相同名称的模板
                existing = Template.query.filter_by(name=template_data['name']).first()
                if existing:
                    print(f"  - 模板 '{template_data['name']}' 已存在，更新...")
                    
                    # 更新现有模板
                    existing.subject = template_data['subject']
                    existing.content = template_data['content']
                    existing.is_active = template_data.get('isActive', True)
                    
                    # 更新附件
                    if 'attachments' in template_data:
                        existing.attachments = template_data['attachments'] if isinstance(template_data['attachments'], str) else json.dumps(template_data['attachments'])
                    
                    # 更新关联的天气类型
                    if 'type' in template_data and template_data['type']:
                        # 查找或创建天气类型
                        weather_type = WeatherType.query.filter_by(name=template_data['type']).first()
                        if not weather_type:
                            weather_type = WeatherType(name=template_data['type'])
                            db.session.add(weather_type)
                            db.session.flush()
                        
                        existing.weather_type_id = weather_type.id
                else:
                    print(f"  - 创建新模板 '{template_data['name']}'")
                    
                    # 处理天气类型
                    weather_type_id = None
                    if 'type' in template_data and template_data['type']:
                        # 查找或创建天气类型
                        weather_type = WeatherType.query.filter_by(name=template_data['type']).first()
                        if not weather_type:
                            weather_type = WeatherType(name=template_data['type'])
                            db.session.add(weather_type)
                            db.session.flush()
                            weather_type_id = weather_type.id
                        else:
                            weather_type_id = weather_type.id
                    
                    # 处理附件字段
                    attachments = None
                    if 'attachments' in template_data:
                        attachments = template_data['attachments'] if isinstance(template_data['attachments'], str) else json.dumps(template_data['attachments'])
                    
                    # 创建新模板
                    new_template = Template(
                        name=template_data['name'],
                        subject=template_data['subject'],
                        content=template_data['content'],
                        weather_type_id=weather_type_id,
                        is_active=template_data.get('isActive', True),
                        attachments=attachments
                    )
                    db.session.add(new_template)
            
            # 提交更改
            db.session.commit()
            print(f"  - 成功导入 {len(templates_data)} 个模板")
        except FileNotFoundError:
            print("  - templates_data.json 文件不存在，跳过模板初始化")
        except Exception as e:
            print(f"  - 导入模板数据时出错: {str(e)}")
            db.session.rollback()
        
        # 同步系统设置
        print("\n5. 同步系统设置...")
        import_settings_from_json()
        if not Setting.query.first():
            # 如果同步失败且数据库为空，写入默认值，避免后续读取为空
            setting = Setting(
                email_sender="alert@weathersystem.com",
                email_name="气象预警系统",
                smtp_server="smtp.example.com",
                smtp_port=587,
                smtp_username="alert@weathersystem.com",
                smtp_password="yourpassword",
                weather_api_key="yourapikey",
                retry_count=3,
                auto_retry=True,
                admin_notifications=True,
                send_summary=True,
                alert_advance_time=24,
                refresh_interval=12,
                first_alert_time="06:00",
                first_alert=6
            )
            db.session.add(setting)
            db.session.commit()
            print("  - 设置同步失败，已写入默认设置")

# 通知相关API
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    """获取所有待处理的通知"""
    notifications = Notification.query.filter_by(status='pending').order_by(Notification.timestamp.desc()).all()
    return jsonify([n.to_dict() for n in notifications])

@app.route('/api/notifications/<notification_id>/approve', methods=['POST'])
def approve_notification(notification_id):
    try:
        # 首先从数据库中获取通知详情
        notification = Notification.query.filter_by(notification_id=notification_id).first()
        if not notification:
            return jsonify({'success': False, 'message': '找不到对应的通知'}), 404
        
        # 从通知中获取邮件数据
        try:
            email_data = json.loads(notification.email_data)
        except:
            return jsonify({'success': False, 'message': '通知数据格式错误'}), 500
        
        print(f"从通知中获取到的邮件数据: {json.dumps(email_data, ensure_ascii=False)}")
        
        # 构建发送请求
        send_data = {
            'to': email_data.get('to_email', ''),
            'subject': email_data.get('subject', ''),
            'content': email_data.get('content', '')
        }
        
        # 验证必要字段
        if not send_data['to'] or not send_data['subject'] or not send_data['content']:
            print(f"邮件数据不完整: to={send_data['to']}, subject={send_data['subject']}, content长度={len(send_data['content']) if send_data['content'] else 0}")
            
            # 尝试补全数据
            if not send_data['content']:
                default_content = f"""
尊敬的{email_data.get('to_name', '客户')}：

我们检测到您所在的{email_data.get('region', '未知地区')}地区将在{email_data.get('alert_date', '近期')}出现{email_data.get('weather_type', '异常')}天气情况。

具体情况：{email_data.get('condition', '未知条件')}

请注意防范，确保安全。

此致
天气预警系统
                """
                send_data['content'] = default_content
                print(f"已添加默认内容: {default_content}")
            
            if not send_data['subject']:
                default_subject = f"{email_data.get('region', '未知地区')}地区{email_data.get('weather_type', '异常')}天气预警通知"
                send_data['subject'] = default_subject
                print(f"已添加默认主题: {default_subject}")
            
            # 再次验证
            if not send_data['to'] or not send_data['subject'] or not send_data['content']:
                return jsonify({'success': False, 'message': '邮件数据不完整，缺少收件人、主题或内容'}), 400
        
        # 添加附件信息
        if 'attachments' in email_data and email_data['attachments']:
            send_data['attachments'] = email_data['attachments']
            print(f"发送邮件包含附件: {email_data['attachments']}")
        
        # 导入邮件发送函数
        from send_email_api import prepare_email_content
        
        # 尝试直接发送邮件
        try:
            # 从设置中读取邮件配置
            with open(SETTINGS_JSON_FILE, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            
            sender = settings.get('emailSender', '')
            name = settings.get('emailName', '')
            server = settings.get('smtpServer', '')
            port = settings.get('smtpPort', 587)
            username = settings.get('smtpUsername', '')
            password = settings.get('smtpPassword', '')
            
            # 验证邮件配置
            if not all([sender, server, port]):
                return jsonify({
                    'success': False,
                    'message': '邮件服务器配置不完整，请检查设置'
                })
            
            # 创建邮件
            import smtplib
            import mimetypes
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            from email.mime.application import MIMEApplication
            from email.utils import formataddr
            import email.utils
            
            message = MIMEMultipart('mixed')
            message['From'] = formataddr((name, sender))
            message['To'] = send_data['to']
            message['Subject'] = send_data['subject']
            message['Date'] = email.utils.formatdate(localtime=True)
            message['Message-ID'] = email.utils.make_msgid()
            
            # 处理内容
            email_content = prepare_email_content(send_data['content'], is_html=True)
            msg = MIMEText(email_content, 'html', 'utf-8')
            message.attach(msg)
            
            # 处理附件
            attachments = send_data.get('attachments', [])
            if attachments:
                # 如果附件是字符串，尝试解析它
                if isinstance(attachments, str):
                    try:
                        if attachments.lower() != "null":
                            attachments = json.loads(attachments)
                        else:
                            attachments = []
                    except Exception as e:
                        print(f"解析附件字符串失败: {str(e)}")
                        attachments = []
                
                # 确保attachments是列表
                if not isinstance(attachments, list):
                    attachments = [attachments]
                
                print(f"邮件包含 {len(attachments)} 个附件")
                
                # 遍历附件列表，添加到邮件中
                for attachment_name in attachments:
                    # 附件完整路径
                    attachment_path = os.path.join(os.getcwd(), 'templates', attachment_name)
                    
                    if os.path.exists(attachment_path):
                        try:
                            # 获取文件MIME类型
                            content_type, encoding = mimetypes.guess_type(attachment_path)
                            if content_type is None or encoding is not None:
                                content_type = 'application/octet-stream'
                            
                            # 读取文件内容并创建附件部分
                            with open(attachment_path, 'rb') as f:
                                file_data = f.read()
                                
                                if content_type.startswith('image/'):
                                    # 对于图片，使用MIMEImage
                                    from email.mime.image import MIMEImage
                                    attachment = MIMEImage(file_data, _subtype=content_type.split('/')[-1])
                                else:
                                    # 对于其他类型，使用MIMEApplication
                                    attachment = MIMEApplication(file_data, _subtype=content_type.split('/')[-1])
                            
                            # 设置附件名，使用文件名编码保护中文名
                            try:
                                attachment.add_header('Content-Disposition', 'attachment', 
                                                     filename=('utf-8', '', attachment_name))
                            except:
                                # 如果编码方式不支持，使用普通方式
                                attachment.add_header('Content-Disposition', 'attachment', 
                                                     filename=attachment_name)
                            
                            # 确保添加Content-ID，这对嵌入图片很重要
                            attachment.add_header('Content-ID', f'<{attachment_name}>')
                            
                            # 添加到邮件中
                            message.attach(attachment)
                            print(f"  - 已添加附件: {attachment_name}")
                            
                        except Exception as e:
                            print(f"  - 添加附件 {attachment_name} 时出错: {str(e)}")
                    else:
                        print(f"  - 警告：附件文件不存在: {attachment_path}")
            
            # 连接到SMTP服务器并发送邮件
            print(f"正在连接SMTP服务器: {server}:{port}")
            
            # 根据端口选择不同的连接方式
            if port == 465:
                # 端口465使用SSL连接
                print("使用SSL连接 (端口465)")
                import ssl
                context = ssl.create_default_context()
                smtp = smtplib.SMTP_SSL(server, port, context=context, timeout=30)
            else:
                # 端口25和587使用普通连接
                print(f"使用普通连接 (端口{port})")
                smtp = smtplib.SMTP(server, port, timeout=30)
                smtp.ehlo()
                
                # 只有端口587才启动STARTTLS
                if port == 587:
                    print("启动STARTTLS加密")
                    smtp.starttls()
                    smtp.ehlo()
                elif port == 25:
                    print("端口25使用明文连接，不启动TLS")
            
            # 尝试登录（如果服务器支持认证）
            try:
                if username and password:
                    print(f"尝试使用用户名登录: {username}")
                    smtp.login(username, password)
                    print("登录成功")
                else:
                    print("未提供用户名密码，跳过认证")
            except smtplib.SMTPNotSupportedError:
                print("服务器不支持认证，继续执行")
                # 如果服务器不支持认证，继续执行
                pass
            except Exception as login_error:
                print(f"登录失败: {str(login_error)}")
                raise
            
            # 发送邮件
            print(f"正在发送邮件到 {send_data['to']}...")
            smtp.sendmail(sender, [send_data['to']], message.as_string())
            print(f"邮件发送成功")
            
            # 关闭连接
            smtp.quit()
            
            result = {'success': True, 'message': '邮件发送成功'}
        except Exception as e:
            print(f"发送邮件失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'message': f'发送失败: {str(e)}'}), 500
        
        if result.get('success'):
            # 更新通知状态
            notification.status = 'approved'
            db.session.commit()
            
            # 生成新的日志ID
            try:
                with open('data.json', 'r', encoding='utf-8') as f:
                    log_data = json.load(f)
                new_id = max([log['id'] for log in log_data]) + 1 if log_data else 1
            except (FileNotFoundError, json.JSONDecodeError):
                log_data = []
                new_id = 1
            
            # 创建新的日志记录
            log_entry = {
                'id': new_id,
                'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'recipient': email_data['to_email'],
                'to_name': email_data.get('to_name', ''),
                'weather_type': email_data.get('weather_type', ''),
                'region': email_data.get('region', ''),
                'subject': email_data['subject'],
                'content': email_data['content'],
                'alert_date': email_data.get('alert_date', ''),
                'condition': email_data.get('condition', ''),
                'category': email_data.get('category', ''),
                'status': '已发送',
                'is_test': notification.is_test
            }
            
            # 添加新的日志记录
            log_data.append(log_entry)
            
            # 保存更新后的日志数据
            try:
                with open('data.json', 'w', encoding='utf-8') as f:
                    json.dump(log_data, f, ensure_ascii=False, indent=4)
                trim_json_file('data.json', 'data_log', max_entries=DATA_LOG_MAX_ENTRIES)
            except Exception as e:
                print(f"保存日志到 data.json 失败: {str(e)}")
                return jsonify({'success': False, 'message': f'邮件已发送，但保存日志失败: {str(e)}'}), 500
            
            # 从 re-Emile.json 中移除已发送的邮件
            try:
                # 读取当前的邮件列表
                with open('re-Emile.json', 'r', encoding='utf-8') as f:
                    emails = json.load(f)
                
                # 根据邮件地址和内容精确匹配要删除的邮件
                updated_emails = []
                for e in emails:
                    # 比较关键字段以确定是否为同一封邮件
                    if (e['to_email'] == email_data['to_email'] and 
                        e['subject'] == email_data['subject'] and
                        e['region'] == email_data.get('region', '') and
                        e['weather_type'] == email_data.get('weather_type', '')):
                        # 这是要删除的邮件，跳过它
                        continue
                    updated_emails.append(e)
                
                # 保存更新后的文件
                with open('re-Emile.json', 'w', encoding='utf-8') as f:
                    json.dump(updated_emails, f, ensure_ascii=False, indent=4)
                trim_json_file('re-Emile.json', 're_emile', max_entries=PENDING_EMAIL_MAX_ENTRIES)

                print(f"已从 re-Emile.json 中移除邮件: {email_data['to_email']}")
            except Exception as e:
                print(f"更新 re-Emile.json 失败: {str(e)}")
            
            return jsonify({'success': True, 'message': '邮件已发送并记录'})
        else:
            return jsonify({'success': False, 'message': f'发送失败: {result.get("message", "未知错误")}'}), 500
            
    except Exception as e:
        print(f"处理通知时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'发送失败: {str(e)}'}), 500

@app.route('/api/notifications/<notification_id>/reject', methods=['POST'])
def reject_notification(notification_id):
    """拒绝发送通知对应的邮件"""
    notification = Notification.query.filter_by(notification_id=notification_id).first()
    if not notification:
        return jsonify({'success': False, 'message': '通知不存在'}), 404
    
    try:
        # 解析邮件数据
        email_data = json.loads(notification.email_data)
        
        # 更新通知状态
        notification.status = 'rejected'
        db.session.commit()
        
        # 从 re-Emile.json 中移除已拒绝的邮件
        try:
            with open('re-Emile.json', 'r', encoding='utf-8') as f:
                emails = json.load(f)
            
            # 根据邮件地址和内容精确匹配要删除的邮件
            updated_emails = []
            for e in emails:
                # 比较关键字段以确定是否为同一封邮件
                if (e['to_email'] == email_data['to_email'] and 
                    e['subject'] == email_data['subject'] and
                    e['region'] == email_data.get('region', '') and
                    e['weather_type'] == email_data.get('weather_type', '')):
                    # 这是要删除的邮件，跳过它
                    continue
                updated_emails.append(e)
            
            # 保存更新后的文件
            with open('re-Emile.json', 'w', encoding='utf-8') as f:
                json.dump(updated_emails, f, ensure_ascii=False, indent=4)
            trim_json_file('re-Emile.json', 're_emile', max_entries=PENDING_EMAIL_MAX_ENTRIES)

            print(f"已从 re-Emile.json 中移除已拒绝的邮件: {email_data['to_email']}")
        except Exception as e:
            print(f"更新 re-Emile.json 失败: {str(e)}")
        
        return jsonify({'success': True, 'message': '已拒绝发送邮件'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'操作失败: {str(e)}'}), 500


@app.route('/api/queues/clear', methods=['POST', 'GET', 'DELETE', 'OPTIONS'])
def clear_queues():
    """
    清空待发送队列（数据库任务表/通知表）并清理本地兜底文件。
    影响范围：mail_task、Notification、re-Emile.json、pending_notifications.json。
    """
    try:
        # 仅处理实际清理请求；OPTIONS 预检直接返回
        if request.method == 'OPTIONS':
            return jsonify({'success': True})

        removed_tasks = MailTask.query.delete()
        removed_notifications = Notification.query.delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'清理数据库队列失败: {str(e)}'}), 500

    file_errors = []
    cleared_files = []

    def _clear_json_file(path):
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=4)
            cleared_files.append(path)
        except Exception as err:
            file_errors.append(f"{path}: {err}")

    for fname in ['re-Emile.json', 'pending_notifications.json']:
        _clear_json_file(fname)

    response = {
        'success': True,
        'message': '已清空发送队列与通知',
        'removed_tasks': removed_tasks,
        'removed_notifications': removed_notifications,
        'cleared_files': cleared_files
    }
    if file_errors:
        response['file_errors'] = file_errors
    return jsonify(response)

@app.route('/api/weather-alert/test', methods=['POST'])
def run_weather_alert_test():
    """运行天气预警测试"""
    try:
        # 导入天气预警主程序
        from weather_alert_main import get_customer_regions, fetch_weather_data, check_alert_conditions, send_alerts
        
        # 获取客户地区
        with app.app_context():
            regions = get_customer_regions()
            if not regions:
                return jsonify({'success': False, 'message': '没有找到客户地区数据'}), 400
            
            # 获取天气数据
            weather_data = fetch_weather_data(regions)
            if not weather_data:
                return jsonify({'success': False, 'message': '获取天气数据失败'}), 500
            
            # 获取设置中的预警提前时间（天数）
            setting = Setting.query.first()
            alert_advance_days = setting.alert_advance_time if setting else 1
            
            # 将天数转换为小时数
            forecast_hours = alert_advance_days * 24
            print(f"根据配置的提前预警天数: {alert_advance_days}天，系统将检查{forecast_hours}小时预报")
            
            try:
                # 检查预警条件，传入预报时间范围
                alerts = check_alert_conditions(weather_data, forecast_hours)
                if not alerts:
                    print("\n=== 预警检测结果 ===")
                    print("没有发现需要预警的天气情况")
                    print("====================")
                    return jsonify({'success': True, 'message': '没有发现需要预警的天气情况'})
            except Exception as e:
                print(f"检查预警条件时出错: {str(e)}")
                return jsonify({'success': False, 'message': f'检查预警条件时出错: {str(e)}'}), 500
            
            # 准备发送预警
            try:
                if send_alerts(alerts, is_test=True):
                    ensure_first_alert_time_column()
                    # 读取待处理邮件用于展示/通知
                    try:
                        with open('re-Emile.json', 'r', encoding='utf-8') as f:
                            emails = json.load(f)
                    except Exception:
                        emails = []

                    if emails:
                        # 按地区分组显示预警信息
                        print("\n=== 预警检测结果 ===")
                        regions_alerts = {}
                        for email in emails:
                            region = email.get('region', 'unknown')
                            regions_alerts.setdefault(region, []).append(email)
                        
                        # 按地区输出预警信息
                        for region, region_alerts in regions_alerts.items():
                            print(f"\n地区: {region}")
                            for alert in region_alerts:
                                print(f"  - 日期: {alert.get('alert_date', 'unknown')} | 类型: {alert.get('weather_type', '')} | 条件: {alert.get('condition', '')} | 收件人: {alert.get('to_name', '')}({alert.get('to_email', '')})")
                        print("\n====================")
                    else:
                        print("\n=== 预警检测结果 ===")
                        print("没有需要发送的预警邮件")
                        print("====================")
                        return jsonify({'success': True, 'message': '没有需要发送的预警邮件'})

                    # 检查是否启用自动审批
                    auto_approval = setting.auto_approval if setting else False
                    
                    if auto_approval:
                        # 自动审批模式：从邮件任务队列中直接发送
                        print("\n=== 自动审批模式已启用，直接发送队列任务（测试） ===")
                        process_mail_tasks_and_send(is_test=True, auto_mode_label="自动审批（测试）")
                    else:
                        # 传统模式：创建通知等待审批
                        print("\n=== 传统审批模式，创建通知等待审批 ===")
                        
                        new_notifications = []
                        for email in emails:
                            # 增加微秒级精度的时间戳以确保ID唯一
                            # 添加随机数以进一步确保唯一性
                            random_suffix = random.randint(1000, 9999)
                            notification_id = f"test_{datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')}_{random_suffix}_{email.get('to_email', '')}"
                            
                            # 检查是否是重复预警，添加重复标记
                            duplicate_prefix = "【已重复】" if email.get('is_duplicate', False) else ""
                            
                            notification = Notification(
                                notification_id=notification_id,
                                recipient=f"{email.get('to_name', '')} ({email.get('to_email', '')})",
                                title=f"{duplicate_prefix}天气预警: {email.get('weather_type', '')} - {email.get('region', '')}",
                                content=f"检测到{email.get('region', '')}地区可能出现{email.get('weather_type', '')}天气情况，是否发送预警邮件？",
                                email_data=json.dumps(email),
                                is_test=True
                            )
                            db.session.add(notification)
                            new_notifications.append(notification)
                        
                        db.session.commit()
                    
                    # 检查是否需要发送管理员通知
                    setting = Setting.query.first()
                    if setting and setting.admin_notifications:
                        try:
                            admin_email = setting.email_sender
                            admin_subject = f"【测试模式】【系统通知】检测到{len(emails)}个预警情况"
                            admin_content = f"""
                            <h2>预警系统测试通知</h2>
                            <p>系统测试模式下检测到{len(emails)}个预警情况，等待审核。</p>
                            <h3>预警列表：</h3>
                            <ul>
                            """
                            for email in emails:
                                admin_content += f"""
                                <li>
                                    <strong>地区:</strong> {email.get('region', '')}<br>
                                    <strong>预警类型:</strong> {email.get('weather_type', '')}<br>
                                    <strong>接收人:</strong> {email.get('to_name', '')} ({email.get('to_email', '')})<br>
                                    <strong>重复预警:</strong> {'是' if email.get('is_duplicate', False) else '否'}<br>
                                </li>
                                """
                            admin_content += """
                            </ul>
                            <p>请登录系统查看详情并进行处理。</p>
                            <p><i>此邮件由测试模式触发，仅用于测试目的。</i></p>
                            """
                            with app.test_client() as client:
                                admin_data = {
                                    'to': admin_email,
                                    'subject': admin_subject,
                                    'content': admin_content
                                }
                                result = client.post('/api/send-email', json=admin_data).get_json()
                                if result and result.get('success'):
                                    print(f"\n已向管理员 {admin_email} 发送测试通知邮件")
                                else:
                                    print(f"\n向管理员发送测试通知邮件失败: {result.get('message') if result else '未知'}")
                        except Exception as e:
                            print(f"\n发送管理员测试通知时出错: {str(e)}")
                                
                return jsonify({
                    'success': True,
                    'message': f"发现{len(emails)}个预警情况，已自动处理" if auto_approval else f'发现{len(emails)}个预警情况，已创建通知'
                })
            except Exception as e:
                print(f"处理预警邮件时出错: {str(e)}")
                return jsonify({'success': False, 'message': f'处理预警邮件时出错: {str(e)}'}), 500
            else:
                print("\n=== 预警检测结果 ===")
                print("没有需要发送的预警邮件")
                print("====================")
                return jsonify({'success': True, 'message': '没有需要发送的预警邮件'})
    except Exception as e:
        print(f"发送预警时出错: {str(e)}")
        return jsonify({'success': False, 'message': f'发送预警时出错: {str(e)}'}), 500

def check_duplicate_alert_in_7_days(recipient_email, region, weather_type, condition=None, alert_date=None, category=None):
    """
    检查7天内是否已发送过相同的预警邮件（同邮箱+地区+类型+条件+类别）。
    注意：不使用 alert_date（预警日期）参与去重，避免每天预报日期滚动/区间预测导致重复发送。
    """
    try:
        seven_days_ago = datetime.datetime.now() - datetime.timedelta(days=7)
        
        try:
            with open('data.json', 'r', encoding='utf-8') as f:
                log_data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return False  # 没有历史记录，不是重复预警
        
        for log in log_data:
            try:
                log_time = datetime.datetime.strptime(log.get('timestamp', ''), '%Y-%m-%d %H:%M:%S')
            except Exception:
                continue
            if log_time < seven_days_ago:
                continue
            
            if log.get('recipient', '') != recipient_email:
                continue
            if log.get('region', '') != region:
                continue
            if log.get('weather_type', '') != weather_type:
                continue
            # 条件/类别如果任一方缺失则不作为阻断条件（兼容旧日志）
            log_condition = (log.get('condition', '') or '').strip()
            current_condition = (condition or '').strip()
            if log_condition and current_condition and log_condition != current_condition:
                continue
            log_category = (log.get('category', '') or '').strip()
            current_category = (category or '').strip()
            if log_category and current_category and log_category != current_category:
                continue
            
            if log.get('status', '').startswith('已发送') or log.get('status', '').startswith('已记录（重复预警'):
                print(f"  发现7天内重复预警: {recipient_email} - {region} - {weather_type} (上次发送时间: {log.get('timestamp')})")
                return True
        return False
    except Exception as e:
        print(f"检查重复预警时出错: {str(e)}")
        return False  # 出错时默认不是重复预警，允许发送

# 自动审批发送辅助：从任务表或旧文件消费待发邮件
def process_mail_tasks_and_send(is_test, auto_mode_label="自动审批"):
    """
    读取 mail_task 中 pending 任务发送邮件，状态更新并写日志。
    兼容旧的 re-Emile.json（仅在没有任务时兜底）。
    """
    # 生成新的日志ID
    try:
        with open('data.json', 'r', encoding='utf-8') as f:
            log_data = json.load(f)
        new_id = max([log['id'] for log in log_data]) + 1 if log_data else 1
    except (FileNotFoundError, json.JSONDecodeError):
        log_data = []
        new_id = 1

    tasks = claim_mail_tasks(is_test=is_test)
    processed_from_tasks = bool(tasks)
    legacy_emails = []
    if not tasks:
        try:
            with open('re-Emile.json', 'r', encoding='utf-8') as f:
                legacy_emails = json.load(f)
        except Exception:
            legacy_emails = []

    sent_count = 0
    failed_count = 0
    duplicate_count = 0

    def handle_email(email, task_id=None):
        nonlocal new_id, sent_count, failed_count, duplicate_count, log_data
        try:
            is_duplicate_in_7_days = check_duplicate_alert_in_7_days(
                email.get('to_email'), 
                email.get('region', ''), 
                email.get('weather_type', ''),
                email.get('condition', ''),
                email.get('alert_date', ''),
                email.get('category', '')
            )
            
            if is_duplicate_in_7_days:
                log_entry = {
                    'id': new_id,
                    'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'recipient': email.get('to_email'),
                    'to_name': email.get('to_name', ''),
                    'weather_type': email.get('weather_type', ''),
                    'region': email.get('region', ''),
                    'subject': email.get('subject'),
                    'content': email.get('content'),
                    'alert_date': email.get('alert_date', ''),
                    'condition': email.get('condition', ''),
                    'category': email.get('category', ''),
                    'status': '已记录（重复预警）',
                    'is_test': is_test
                }
                log_data.append(log_entry)
                new_id += 1
                duplicate_count += 1
                if task_id:
                    update_mail_task_status(task_id, 'failed', error='duplicate')
                print(f"  ⚠ 7天内重复预警，已记录但未发送: {email.get('to_name', '')} ({email.get('to_email', '')})")
                return
            
            send_data = {
                'to': email.get('to_email'),
                'subject': email.get('subject'),
                'content': email.get('content')
            }
            
            with app.test_client() as client:
                response = client.post('/api/send-email', 
                                     data=json.dumps(send_data),
                                     content_type='application/json')
                result = response.get_json()
            
            if result and result.get('success'):
                log_entry = {
                    'id': new_id,
                    'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'recipient': email.get('to_email'),
                    'to_name': email.get('to_name', ''),
                    'weather_type': email.get('weather_type', ''),
                    'region': email.get('region', ''),
                    'subject': email.get('subject'),
                    'content': email.get('content'),
                    'alert_date': email.get('alert_date', ''),
                    'condition': email.get('condition', ''),
                    'category': email.get('category', ''),
                    'status': '已发送',
                    'is_test': is_test
                }
                log_data.append(log_entry)
                new_id += 1
                sent_count += 1
                if task_id:
                    update_mail_task_status(task_id, 'sent')
                print(f"  ✓ 已发送邮件到: {email.get('to_name', '')} ({email.get('to_email', '')})")
            else:
                failed_count += 1
                if task_id:
                    update_mail_task_status(task_id, 'failed', error=result.get('message') if result else '未知错误')
                print(f"  ✗ 发送失败: {email.get('to_name', '')} ({email.get('to_email', '')}) - {result.get('message', '未知错误')}")
        except Exception as e:
            failed_count += 1
            if task_id:
                update_mail_task_status(task_id, 'failed', error=str(e))
            print(f"  ✗ 发送邮件到 {email.get('to_name', '')} ({email.get('to_email', '')}) 时出错: {str(e)}")

    if tasks:
        for task in tasks:
            try:
                email = json.loads(task.payload)
            except Exception as e:
                update_mail_task_status(task.task_id, 'failed', error=str(e))
                continue
            handle_email(email, task.task_id)
    elif legacy_emails:
        for email in legacy_emails:
            handle_email(email, None)

    # 保存日志数据
    try:
        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(log_data, f, ensure_ascii=False, indent=4)
        trim_json_file('data.json', 'data_log', max_entries=DATA_LOG_MAX_ENTRIES)
    except Exception as e:
        print(f"保存日志到 data.json 失败: {str(e)}")

    # 如果使用了队列任务，处理完后清空旧的文件缓存，避免下次重复发送
    if processed_from_tasks:
        try:
            backup_if_has_data('re-Emile.json', 're_emile')
            with open('re-Emile.json', 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=4)
            print("已清空 re-Emile.json（以 mail_task 队列为准）")
        except Exception as e:
            print(f"清空 re-Emile.json 失败: {str(e)}")
    
    print(f"\n{auto_mode_label}发送完成: 成功 {sent_count} 封，失败 {failed_count} 封，重复预警 {duplicate_count} 封")
    print("======================================")
# 全局变量用于控制后台任务
weather_alert_thread = None
stop_weather_alert = False

def run_weather_alert_background():
    """后台运行天气预警主程序"""
    global stop_weather_alert
    
    # 导入天气预警主程序
    from weather_alert_main import (
        get_customer_regions,
        fetch_weather_data,
        check_alert_conditions,
        send_alerts,
        calculate_next_alert_time
    )
    
    print("=== 天气预警系统后台任务启动 ===\n")
    
    # 创建应用上下文
    with app.app_context():
        # 检查数据库权限并尝试修复
        try:
            # 获取数据库文件路径
            db_path = app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')
            if not db_path:
                db_path = 'instance/skyalert.db'  # 默认路径
                
            print(f"检查数据库路径: {db_path}")
            
            # 确保数据库目录存在且有正确权限
            db_dir = os.path.dirname(db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, mode=0o777, exist_ok=True)
                print(f"创建数据库目录: {db_dir}")
            
            # 如果数据库文件存在，确保权限正确
            if os.path.exists(db_path):
                try:
                    # 设置数据库文件为全局可读写
                    os.chmod(db_path, 0o666)
                    print(f"已设置数据库文件权限: {db_path}")
                    
                    # 测试数据库连接
                    db.session.execute(text("PRAGMA journal_mode=WAL"))  # 使用WAL模式减少锁定问题
                    db.session.commit()
                except Exception as perm_err:
                    print(f"设置数据库文件权限失败: {str(perm_err)}")
            
            # 测试数据库写入权限
            test_notification = Notification(
                notification_id=f"test_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}",
                recipient="测试",
                title="权限测试",
                content="测试数据库写入权限",
                is_test=True
            )
            db.session.add(test_notification)
            db.session.commit()
            db.session.delete(test_notification)
            db.session.commit()
            print("数据库写入权限正常")
            
        except Exception as e:
            print(f"警告: 数据库权限异常，尝试修复: {str(e)}")
            
            # 尝试重新连接数据库
            try:
                db.session.remove()  # 关闭当前会话
                
                # 检查数据库文件是否存在并设置权限
                db_path = app.config.get('SQLALCHEMY_DATABASE_URI', '').replace('sqlite:///', '')
                if not db_path:
                    db_path = 'instance/skyalert.db'
                
                # 确保数据库目录权限正确
                db_dir = os.path.dirname(db_path)
                if db_dir:
                    os.makedirs(db_dir, mode=0o777, exist_ok=True)
                
                # 如果数据库文件存在，设置为可读写
                if os.path.exists(db_path):
                    os.chmod(db_path, 0o666)
                    print(f"已重新设置数据库文件权限: {db_path}")
                    
                # 需要重新初始化数据库连接
                app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
                db.init_app(app)
                
                print("已尝试重新连接数据库")
            except Exception as reinit_err:
                print(f"重新初始化数据库失败: {str(reinit_err)}")
                print("将改为使用JSON文件存储通知")
        
        while not stop_weather_alert:
            try:
                ensure_first_alert_time_column()
                # 加载配置
                setting = Setting.query.first()
                if not setting:
                    print("Error: 无法加载配置")
                    break
                
                # 计算下一次预警时间
                next_alert_time = calculate_next_alert_time({
                    'firstalert': setting.first_alert,
                    'firstAlertTime': setting.first_alert_time,
                    'warningInterval': setting.refresh_interval
                })
                current_time = datetime.datetime.now()
                
                # 如果还没到预警时间，等待
                if current_time < next_alert_time:
                    wait_seconds = (next_alert_time - current_time).total_seconds()
                    print(f"下次预警时间: {next_alert_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"等待 {int(wait_seconds/3600)} 小时 {int((wait_seconds%3600)/60)} 分钟...\n")
                    
                    # 每10秒检查一次是否需要停止，提高响应性
                    while not stop_weather_alert and datetime.datetime.now() < next_alert_time:
                        time.sleep(10)  # 减少检查间隔从60秒到10秒
                        if stop_weather_alert:
                            print("收到停止信号，预警线程即将退出...")
                            return  # 立即退出函数
                    
                    if stop_weather_alert:
                        print("等待期间收到停止信号，预警线程即将退出...")
                        break
                
                # 再次检查停止标志，防止在计算等待时间期间收到停止信号
                if stop_weather_alert:
                    print("执行预警前收到停止信号，预警线程即将退出...")
                    break
                    
                print("=== 开始执行预警检查 ===\n")
                
                # 根据预警提前时间自动判断预报时间范围
                alert_advance_days = setting.alert_advance_time
                forecast_hours = alert_advance_days * 24
                print(f"根据配置的提前预警天数: {alert_advance_days}天，系统将检查{forecast_hours}小时预报")
                
                # 执行预警检查
                regions = get_customer_regions()
                weather_data = fetch_weather_data(regions)
                if weather_data:
                    # 传递forecast_hours参数到check_alert_conditions函数
                    alerts = check_alert_conditions(weather_data, forecast_hours)
                    if send_alerts(alerts, is_test=False):
                        # 读取待发送的邮件并创建通知
                        try:
                            with open('re-Emile.json', 'r', encoding='utf-8') as f:
                                emails = json.load(f)
                            
                            # 创建通知前先清除之前可能失败的事务
                            db.session.rollback()
                            
                            # 记录已处理的通知ID，防止重复
                            processed_ids = set()
                            
                            # 在正式操作前，先打印预警汇总信息
                            print("\n=== 检测到的预警条件汇总 ===")
                            regions_alerts = {}
                            for email in emails:
                                region = email['region']
                                if region not in regions_alerts:
                                    regions_alerts[region] = []
                                regions_alerts[region].append(email)
                            
                            # 按地区输出预警信息
                            for region, alerts in regions_alerts.items():
                                print(f"\n地区: {region}")
                                for alert in alerts:
                                    print(f"  - 日期: {alert.get('alert_date', 'unknown')} | 类型: {alert['weather_type']} | 条件: {alert.get('condition', '')} | 收件人: {alert['to_name']}({alert['to_email']})")
                            print("\n====================")
                            
                            # 检查是否启用自动审批
                            auto_approval = setting.auto_approval if setting else False

                            if auto_approval:
                                # 自动审批模式：使用邮件任务队列直接发送，不进入通知中心
                                print("\n=== 自动审批模式已启用，使用邮件任务队列直接发送 ===")
                                process_mail_tasks_and_send(is_test=False, auto_mode_label="自动审批")

                            else:
                                # 手动审批模式：创建通知供前端审批使用
                                for email in emails:
                                    # 检查停止标志
                                    if stop_weather_alert:
                                        print("处理通知过程中收到停止信号，预警线程即将退出...")
                                        return

                                    # 重复预警不进入通知中心
                                    is_duplicate_in_7_days = check_duplicate_alert_in_7_days(
                                        email['to_email'],
                                        email.get('region', ''),
                                        email.get('weather_type', ''),
                                        email.get('condition', ''),
                                        email.get('alert_date', ''),
                                        email.get('category', '')
                                    )
                                    if is_duplicate_in_7_days or email.get('is_duplicate'):
                                        print(f"跳过重复预警，不创建通知: {email['to_name']} ({email['to_email']})")
                                        continue

                                    # 生成唯一ID
                                    random_suffix = random.randint(1000, 9999)
                                    notification_id = f"alert_{datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')}_{random_suffix}_{email['to_email']}"

                                    # 检查是否已处理此通知
                                    if notification_id in processed_ids:
                                        print(f"跳过重复通知: {notification_id}")
                                        continue

                                    # 检查是否是重复预警，添加重复标记
                                    duplicate_prefix = "【已重复】" if email.get('is_duplicate', False) else ""

                                    try:
                                        notification = Notification(
                                            notification_id=notification_id,
                                            recipient=f"{email['to_name']} ({email['to_email']})",
                                            title=f"{duplicate_prefix}天气预警: {email['weather_type']} - {email['region']}",
                                            content=f"检测到{email['region']}地区可能出现{email['weather_type']}天气情况，是否发送预警邮件？",
                                            email_data=json.dumps(email),
                                            is_test=False
                                        )
                                        db.session.add(notification)
                                        db.session.commit()
                                        processed_ids.add(notification_id)
                                        print(f"已创建通知: {notification_id}")
                                    except Exception as notify_err:
                                        print(f"创建通知失败: {str(notify_err)}")
                                        db.session.rollback()  # 回滚失败的事务
                                        # 备用方案：将通知存储到JSON文件
                                        try:
                                            notifications_file = 'pending_notifications.json'

                                            # 读取现有通知
                                            notifications = []
                                            if os.path.exists(notifications_file):
                                                try:
                                                    with open(notifications_file, 'r', encoding='utf-8') as f:
                                                        notifications = json.load(f)
                                                except json.JSONDecodeError:
                                                    notifications = []

                                            # 添加新通知
                                            notifications.append({
                                                'notification_id': notification_id,
                                                'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                                'recipient': f"{email['to_name']} ({email['to_email']})",
                                                'title': f"{duplicate_prefix}天气预警: {email['weather_type']} - {email['region']}",
                                                'content': f"检测到{email['region']}地区可能出现{email['weather_type']}天气情况，是否发送预警邮件？",
                                                'email_data': email,
                                                'is_test': False,
                                                'status': 'pending'
                                            })

                                            # 保存到文件
                                            with open(notifications_file, 'w', encoding='utf-8') as f:
                                                json.dump(notifications, f, ensure_ascii=False, indent=2)
                                            trim_json_file(
                                                notifications_file,
                                                'pending_notifications',
                                                max_entries=PENDING_NOTIFICATION_MAX_ENTRIES
                                            )

                                            processed_ids.add(notification_id)
                                            print(f"已将通知保存到文件: {notification_id}")
                                        except Exception as file_err:
                                            print(f"保存通知到文件失败: {str(file_err)}")

                                        # 短暂等待后继续
                                        time.sleep(2)

                                print(f"\n已创建 {len(processed_ids)} 个预警通知。")
                            
                            # 检查是否需要发送管理员通知（仅在非自动审批模式下发送）
                            if setting.admin_notifications and not stop_weather_alert and not auto_approval:
                                try:
                                    # 获取管理员邮箱（使用配置的发件人邮箱）
                                    admin_email = setting.email_sender
                                    
                                    # 构建管理员通知邮件内容
                                    admin_subject = f"【系统通知】检测到{len(processed_ids)}个预警情况"
                                    admin_content = f"""
                                    <h2>预警系统通知</h2>
                                    <p>系统检测到{len(processed_ids)}个预警情况，等待审核。</p>
                                    <h3>预警列表：</h3>
                                    <ul>
                                    """
                                    
                                    # 添加每个预警的详细信息
                                    for email in emails:
                                        admin_content += f"""
                                        <li>
                                            <strong>地区:</strong> {email['region']}<br>
                                            <strong>预警类型:</strong> {email['weather_type']}<br>
                                            <strong>接收人:</strong> {email['to_name']} ({email['to_email']})<br>
                                            <strong>重复预警:</strong> {'是' if email.get('is_duplicate', False) else '否'}<br>
                                        </li>
                                        """
                                    
                                    admin_content += """
                                    </ul>
                                    <p>请登录系统查看详情并进行处理。</p>
                                    """
                                    
                                    # 使用测试客户端发送请求
                                    with app.test_client() as client:
                                        admin_data = {
                                            'to': admin_email,
                                            'subject': admin_subject,
                                            'content': admin_content
                                        }
                                        response = client.post('/api/send-email', json=admin_data)
                                        result = response.get_json()
                                        
                                        if result['success']:
                                            print(f"\n已向管理员 {admin_email} 发送通知邮件")
                                        else:
                                            print(f"\n向管理员发送通知邮件失败: {result['message']}")
                                except Exception as e:
                                    print(f"\n发送管理员通知时出错: {str(e)}")
                        except Exception as e:
                            print(f"\n处理预警邮件时出错: {str(e)}")
                
                print("\n=== 预警检查完成 ===\n")
                
            except Exception as e:
                print(f"\n发生错误: {str(e)}")
                # 发生错误时，回滚任何未完成的事务
                try:
                    db.session.rollback()
                except:
                    pass
                time.sleep(60)  # 发生错误时等待1分钟后重试
            
            # 最后检查一次停止标志
            if stop_weather_alert:
                print("预警周期结束，检测到停止信号，预警线程即将退出...")
                break
                
        print("预警线程已退出")

@app.route('/api/weather-alert/start', methods=['POST'])
def start_weather_alert():
    """启动天气预警后台任务"""
    global weather_alert_thread, stop_weather_alert
    
    if weather_alert_thread and weather_alert_thread.is_alive():
        return jsonify({'success': False, 'message': '天气预警系统已在运行中'})
    
    stop_weather_alert = False
    weather_alert_thread = Thread(target=run_weather_alert_background)
    weather_alert_thread.daemon = True
    weather_alert_thread.start()
    
    return jsonify({'success': True, 'message': '天气预警系统已启动'})

@app.route('/api/weather-alert/stop', methods=['POST'])
def stop_weather_alert():
    """停止天气预警后台任务"""
    global stop_weather_alert
    
    stop_weather_alert = True
    return jsonify({'success': True, 'message': '正在停止天气预警系统'})

@app.route('/api/weather/refresh-cache', methods=['GET'])
def refresh_weather_cache():
    try:
        # 清除现有缓存 - 使用已有的clear方法而不是clear_all
        weather_cache.clear()
        
        # 获取用户收藏的城市
        favorite_cities = load_favorite_cities()
        
        # 重新获取这些城市的天气数据
        for city in favorite_cities:
            # 获取城市ID
            city_info = get_city_info(city)
            if city_info:
                city_id = city_info[0].get('id')
                city_name = city_info[0].get('name')
                # 强制刷新天气数据
                get_weather_data(city_id, city_name)
        
        return jsonify({"code": "200", "message": "天气数据已更新"})
    except Exception as e:
        return jsonify({"code": "500", "message": f"刷新缓存失败: {str(e)}"})


def replace_template_variables(template_content, customer_data, weather_data):
    """
    替换模板中的所有变量
    
    参数:
    - template_content: 模板内容字符串
    - customer_data: 客户数据字典
    - weather_data: 天气数据字典
    
    返回:
    - 替换变量后的内容
    """
    import re
    
    # 获取当前日期
    current_date = datetime.datetime.now().strftime('%Y-%m-%d')
    alert_date = weather_data.get('alert_date', current_date)
    
    # 创建变量映射字典
    variables = {
        '{{name}}': customer_data.get('name', ''),
        '{{title}}': customer_data.get('title', ''),
        '{{company}}': customer_data.get('company', ''),
        '{{region}}': customer_data.get('region', ''),
        '{{date}}': alert_date,
        '{{weather_type}}': weather_data.get('weather_type', ''),
        '{{phone}}': customer_data.get('phone', ''),
        '{{email}}': customer_data.get('email', ''),
        '{{地区}}': customer_data.get('region', ''),  # 增加中文变量支持
        '{{日期}}': alert_date,
        '{{天气类型}}': weather_data.get('weather_type', ''),
        '{{公司}}': customer_data.get('company', ''),
    }
    
    # 替换内容中的所有变量
    content = template_content
    for var, value in variables.items():
        content = content.replace(var, str(value) if value is not None else '')
    
    # 使用正则表达式查找并替换任何剩余的 {{变量名}} 格式的内容
    content = re.sub(r'{{.*?}}', '', content)
    
    return content
####################

# 读取用户数据
def read_users():
    try:
        with open(USER_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

# 保存用户数据
def save_users(users):
    with open(USER_FILE, 'w') as f:
        json.dump(users, f)

# 静态文件路由
@app.route('/')
def index():
    return send_from_directory('./', 'login.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('./', path)

# API路由：登录
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    users = read_users()
    user = next((u for u in users if u['username'] == username and u['password'] == password), None)
    
    if user:
        return jsonify({
            'success': True,
            'user': {
                'username': user['username'],
                'role': user['role']
            }
        })
    else:
        return jsonify({
            'success': False,
            'message': '用户名或密码错误'
        }), 401

# API路由：获取所有用户
@app.route('/api/users', methods=['GET'])
def get_users():
    users = read_users()
    # 返回用户信息但不包括密码
    safe_users = [{k:v for k,v in user.items() if k != 'password'} for user in users]
    return jsonify(safe_users)

# API路由：添加用户
@app.route('/api/users', methods=['POST'])
def add_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    
    users = read_users()
    
    # 检查用户名是否已存在
    if any(u['username'] == username for u in users):
        return jsonify({
            'success': False,
            'message': '用户名已存在'
        }), 400
    
    users.append({
        'username': username,
        'password': password,
        'role': role
    })
    
    save_users(users)
    
    return jsonify({
        'success': True,
        'message': '用户添加成功'
    })

# API路由：更新用户
@app.route('/api/users/<username>', methods=['PUT'])
def update_user(username):
    data = request.json
    new_username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    
    users = read_users()
    
    # 查找要更新的用户
    user_index = next((i for i, u in enumerate(users) if u['username'] == username), None)
    
    if user_index is None:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    # 检查新用户名是否与其他用户冲突
    if new_username != username and any(u['username'] == new_username for u in users):
        return jsonify({
            'success': False,
            'message': '用户名已存在'
        }), 400
    
    users[user_index]['username'] = new_username
    if password:
        users[user_index]['password'] = password
    if role:
        users[user_index]['role'] = role
    
    save_users(users)
    
    return jsonify({
        'success': True,
        'message': '用户更新成功'
    })

# API路由：删除用户
@app.route('/api/users/<username>', methods=['DELETE'])
def delete_user(username):
    users = read_users()
    
    # 检查是否是唯一的管理员
    admin_users = [u for u in users if u['role'] == 'admin']
    user_to_delete = next((u for u in users if u['username'] == username), None)
    
    if not user_to_delete:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    if user_to_delete['role'] == 'admin' and len(admin_users) <= 1:
        return jsonify({
            'success': False,
            'message': '系统中必须至少保留一个管理员账号'
        }), 400
    
    users = [u for u in users if u['username'] != username]
    save_users(users)
    
    return jsonify({
        'success': True,
        'message': '用户删除成功'
    })

# API路由：修改密码
@app.route('/api/change-password', methods=['POST'])
def change_password():
    data = request.json
    username = data.get('username')
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    users = read_users()
    user = next((u for u in users if u['username'] == username), None)
    
    if not user or user['password'] != current_password:
        return jsonify({
            'success': False,
            'message': '当前密码不正确'
        }), 401
    
    user['password'] = new_password
    save_users(users)
    
    return jsonify({
        'success': True,
        'message': '密码修改成功'
    })

####################

# 如果直接运行此文件，则初始化数据库并启动应用
if __name__ == '__main__':
    # 确保数据库目录有写入权限
    try:
        db_path = 'instance/skyalert.db'
        db_dir = os.path.dirname(db_path)
        
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            print(f"创建数据库目录: {db_dir}")
        
        # 确保数据库文件有正确权限
        if os.path.exists(db_path):
            try:
                os.chmod(db_path, 0o666)  # 确保数据库是可读写的
                print(f"已设置数据库文件权限: {db_path}")
            except Exception as perm_err:
                print(f"设置数据库文件权限失败: {str(perm_err)}")
                print("继续使用现有权限...")
    except Exception as e:
        print(f"设置数据库目录时出错: {str(e)}")
        print("将尝试使用默认设置继续...")
    
    # 初始化数据库
    init_db()
    
    # 启动天气预警系统
    stop_weather_alert = False
    weather_alert_thread = Thread(target=run_weather_alert_background)
    weather_alert_thread.daemon = True
    weather_alert_thread.start()
    print("天气预警系统已启动")
    
    app.run(debug=False, host='0.0.0.0', port=8000, threaded=True)
