#!/usr/bin/env python3
import json
import requests
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
import time
import os
import random
from send_email_api import register_routes
from flask import Flask
from template_utils import replace_template_variables
import traceback
from maintenance_utils import backup_if_has_data, trim_json_file, log_health
import sqlite3

# 文件路径
SETTINGS_FILE = 'settings.json'
CUSTOMERS_FILE = 'customers_data.json'
ALERT_RULES_FILE = 'alert_rules.json'
TEMPLATES_FILE = 'templates_data.json'
WEATHER_FILE = 'weather.json'
EMAIL_JSON_FILE = 're-Emile.json'
REQUEST_TIMEOUT = 15  # 天气API请求超时时间（秒）
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'skyalert.db')

# 邮件任务表初始化
def ensure_mail_task_table():
    try:
        conn = sqlite3.connect(DB_PATH)
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
        print(f"初始化 mail_task 表失败: {e}")

# 时间解析工具
def parse_first_alert_time(settings):
    """从设置中解析初次预警时间，返回(小时, 分钟)"""
    time_str = settings.get('firstAlertTime') or settings.get('firstalertTime')
    if isinstance(time_str, str) and ':' in time_str:
        try:
            h, m = time_str.split(':')
            h, m = int(h), int(m)
            if 0 <= h < 24 and 0 <= m < 60:
                return h, m
        except Exception:
            pass
    fallback = settings.get('firstalert', 6)
    try:
        h = int(fallback)
        if 0 <= h < 24:
            return h, 0
    except Exception:
        pass
    return 6, 0

# 加载配置文件
def load_json_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

# 保存JSON文件
def save_json_file(file_path, data):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"Error saving {file_path}: {e}")
        return False

# 获取顾客地理位置
def get_customer_regions():
    customers = load_json_file(CUSTOMERS_FILE)
    if not customers:
        return []
    
    # 提取所有不重复的地区
    regions = set()
    for customer in customers:
        if 'region' in customer and customer['region']:
            regions.add(customer['region'])
    
    return list(regions)

# 使用天气API获取天气数据
def fetch_weather_data(regions):
    settings = load_json_file(SETTINGS_FILE)
    if not settings or 'weatherApiKey' not in settings:
        print("Weather API key not found in settings")
        log_health('WeatherAPI', False, '缺少API密钥配置')
        return None

    api_key = settings['weatherApiKey']
    weather_data = {}
    failure_regions = []

    # 获取全局预警天数，决定使用哪个API端点
    global_advance_days = settings.get('alertAdvanceTime', 1)

    # 根据预警提前天数选择API端点：大于2天使用7天预报，否则使用3天预报
    forecast_api_endpoint = "https://api.qweather.com/v7/weather/7d" if global_advance_days > 2 else "https://api.qweather.com/v7/weather/3d"
    print(f"全局提前预警天数: {global_advance_days}天，使用API端点: {forecast_api_endpoint}")

    for region in regions:
        region_success = False
        try:
            # 先获取城市ID
            location_url = f"https://geoapi.qweather.com/v2/city/lookup?location={region}&key={api_key}"
            location_response = requests.get(location_url, timeout=REQUEST_TIMEOUT)
            location_data = location_response.json()
        except requests.exceptions.RequestException as geo_err:
            print(f"获取城市ID超时或失败: {region} - {geo_err}")
            failure_regions.append(f"{region}(定位失败)")
            continue
        except Exception as geo_err:
            print(f"解析城市ID响应失败: {region} - {geo_err}")
            failure_regions.append(f"{region}(定位解析失败)")
            continue

        if location_data.get('code') == '200' and location_data.get('location'):
            city_id = location_data['location'][0]['id']
            url = f"{forecast_api_endpoint}?location={city_id}&key={api_key}"
            retry_count = 0
            max_retries = settings.get('retryCount', 3)
            auto_retry = settings.get('autoRetry', True)

            while retry_count < max_retries:
                try:
                    response = requests.get(url, timeout=REQUEST_TIMEOUT)
                    data = response.json()

                    if data.get('code') == '200':
                        daily_forecasts = data.get('daily', [])
                        max_days = 7 if global_advance_days > 2 else 3
                        if daily_forecasts and len(daily_forecasts) >= max_days:
                            weather_info = {
                                'region': region,
                                'updateTime': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                                'forecasts': []
                            }

                            for forecast in daily_forecasts:
                                forecast_data = {
                                    'date': forecast.get('fxDate'),
                                    'tempMax': forecast.get('tempMax'),
                                    'tempMin': forecast.get('tempMin'),
                                    'textDay': forecast.get('textDay'),
                                    'textNight': forecast.get('textNight'),
                                    'windSpeed': forecast.get('windSpeedDay'),
                                    'windDir': forecast.get('windDirDay'),
                                    'precip': forecast.get('precip'),
                                    'vis': forecast.get('vis')
                                }
                                weather_info['forecasts'].append(forecast_data)

                            weather_data[region] = weather_info
                            region_success = True
                            print(f"成功获取 {region} {max_days}天的天气预报数据")
                            break
                        else:
                            print(f"API返回数据不足{max_days}天: {region}")
                    else:
                        print(f"API error for {region}: {data.get('code')} - {data.get('message')}")
                except requests.exceptions.RequestException as req_err:
                    print(f"请求天气接口失败: {region} - {req_err}")
                except Exception as api_err:
                    print(f"解析天气接口响应失败: {region} - {api_err}")

                retry_count += 1
                if retry_count < max_retries and auto_retry:
                    print(f"Retrying {region} weather data... ({retry_count}/{max_retries})")
                    time.sleep(2)

            if not region_success:
                failure_regions.append(f"{region}(天气接口失败)")
        else:
            print(f"无法获取城市ID: {region}")
            failure_regions.append(f"{region}(无城市ID)")

    # 保存天气数据到文件
    if weather_data:
        save_json_file(WEATHER_FILE, weather_data)
        print(f"Weather data saved to {WEATHER_FILE}")
    else:
        print("未能获取任何地区的天气数据")

    if not weather_data:
        log_health('WeatherAPI', False, "本轮任务未获取到有效天气数据")
    elif failure_regions:
        log_health('WeatherAPI', False, f"部分地区天气数据获取失败: {', '.join(failure_regions)}")
    else:
        log_health('WeatherAPI', True, f"成功获取{len(weather_data)}个地区天气数据")

    return weather_data

def check_parameter_condition(value, condition):
    try:
        # 解析条件字符串，例如 "最高温度 >= 30 度"
        parts = condition.split()
        operator = parts[1]
        threshold = float(parts[2])
        
        # 确保value是float类型，防止字符串比较问题
        value = float(value)
        
        print(f"  参数比较: {value} {operator} {threshold} (原值: '{value}', 类型: {type(value).__name__})")
        
        if operator == '>':
            return value > threshold
        elif operator == '<':
            return value < threshold
        elif operator == '>=':
            return value >= threshold
        elif operator == '<=':
            return value <= threshold
        return False
    except Exception as e:
        print(f"  参数比较异常: {e}")
        return False

def is_condition_met(region_data, rule, forecast_hours=24):
    """
    检查天气数据是否满足预警规则条件
    
    参数:
    - region_data: 地区天气数据
    - rule: 预警规则
    - forecast_hours: 预报时间范围（小时）
    
    返回:
    - 是否满足条件，及满足条件的日期(如果满足)
    """
    # 获取规则类型和条件
    weather_type = rule.get('type')
    condition = rule.get('condition')
    alert_type = rule.get('alertType', 'parameter')  # 默认为参数类型
    
    print(f"\n检查规则: {weather_type} - {condition} - {alert_type}")
    
    # 确定要检查的预报天数（根据API返回的预报数据，最多7天）
    forecast_days = min(7, (forecast_hours + 23) // 24)  # 向上取整，最多7天
    
    # 获取预报数据
    forecasts = region_data.get('forecasts', [])
    if not forecasts or len(forecasts) < forecast_days:
        print(f"预报数据不足 {forecast_days} 天，无法检查条件")
        return False
    
    # 使用规则中的提前预警天数（已在check_alert_conditions中统一设置为全局值）
    advance_days = int(rule['advanceTime'])
    
    # 计算预警日期 - 这是我们关心的未来日期
    try:
        # 首先尝试从文件中读取预警日期
        with open('test_date.txt', 'r') as f:
            date_str = f.read().strip()
            current_date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
    except:
        # 如果文件不存在或读取失败，使用当前日期
        current_date = datetime.datetime.now()
    
    alert_date = current_date + datetime.timedelta(days=advance_days)
    alert_date_str = alert_date.strftime('%Y-%m-%d')
    print(f"当前日期: {current_date.strftime('%Y-%m-%d')}, 提前预警天数: {advance_days}, 预警日期: {alert_date_str}, 地区: {region_data['region']}")
    
    # 打印所有预报数据，以便调试
    print(f"获取到的预报数据:")
    for i, fc in enumerate(forecasts):
        print(f"  预报 {i+1}: 日期={fc.get('date')}, 最高温度={fc.get('tempMax')}, 最低温度={fc.get('tempMin')}, 风速={fc.get('windSpeed')}")
    
    # 找到匹配预警日期的预报数据
    target_forecast = None
    for forecast in forecasts:
        if forecast.get('date') == alert_date_str:
            target_forecast = forecast
            break
    
    if not target_forecast:
        print(f"未找到预警日期 {alert_date_str} 的预报数据")
        return False
        
    print(f"检查预警日期: {alert_date_str}")
    print(f"{alert_date_str} 的天气数据: 最高温度={target_forecast.get('tempMax', 'N/A')}, 最低温度={target_forecast.get('tempMin', 'N/A')}, 风速={target_forecast.get('windSpeed', 'N/A')}, 降水量={target_forecast.get('precip', 'N/A')}, 能见度={target_forecast.get('vis', 'N/A')}")
    
    # 根据规则类型检查条件
    if alert_type == 'parameter':
        # 参数类型规则（如温度、降水等）
        if ('最高温度' in condition and 'tempMax' in target_forecast) or \
           ('最低温度' in condition and 'tempMin' in target_forecast):
            
            if '最高温度' in condition and 'tempMax' in target_forecast:
                check_result = check_parameter_condition(target_forecast['tempMax'], condition)
                print(f"  检查最高温度条件: {target_forecast['tempMax']} {condition}, 结果: {check_result}")
                if check_result:
                    print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                    # 保存实际满足条件的预报日期
                    rule['matched_forecast_date'] = alert_date_str
                    return True
            
            if '最低温度' in condition and 'tempMin' in target_forecast:
                check_result = check_parameter_condition(target_forecast['tempMin'], condition)
                print(f"  检查最低温度条件: {target_forecast['tempMin']} {condition}, 结果: {check_result}")
                if check_result:
                    print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                    rule['matched_forecast_date'] = alert_date_str
                    return True
                    
        elif '降水量' in condition and 'precip' in target_forecast:
            check_result = check_parameter_condition(target_forecast['precip'], condition)
            print(f"  检查降水量条件: {target_forecast['precip']} {condition}, 结果: {check_result}")
            if check_result:
                print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                rule['matched_forecast_date'] = alert_date_str
                return True
        elif '24h降雨量' in condition and 'precip' in target_forecast:
            # 将"24h降雨量"条件转换为使用"降水量"进行处理
            modified_condition = condition.replace('24h降雨量', '降水量')
            check_result = check_parameter_condition(target_forecast['precip'], modified_condition)
            print(f"  检查24h降雨量条件: {target_forecast['precip']} {condition}, 结果: {check_result}")
            if check_result:
                print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                rule['matched_forecast_date'] = alert_date_str
                return True
        elif '降雨量' in condition and 'precip' in target_forecast:
            # 兼容旧格式的降雨量条件
            modified_condition = condition.replace('降雨量', '降水量')
            check_result = check_parameter_condition(target_forecast['precip'], modified_condition)
            print(f"  检查降雨量条件: {target_forecast['precip']} {condition}, 结果: {check_result}")
            if check_result:
                print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                rule['matched_forecast_date'] = alert_date_str
                return True
        elif '风速' in condition and 'windSpeed' in target_forecast:
            check_result = check_parameter_condition(target_forecast['windSpeed'], condition)
            print(f"  检查风速条件: {target_forecast['windSpeed']} {condition}, 结果: {check_result}")
            if check_result:
                print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                rule['matched_forecast_date'] = alert_date_str
                return True
        elif '能见度' in condition and 'vis' in target_forecast:
            check_result = check_parameter_condition(target_forecast['vis'], condition)
            print(f"  检查能见度条件: {target_forecast['vis']} {condition}, 结果: {check_result}")
            if check_result:
                print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的{condition}")
                rule['matched_forecast_date'] = alert_date_str
                return True
    elif alert_type == 'keyword' or alert_type == 'text':
        # 关键词类型规则（如雨、雪、雾等）或文本类型规则（如沙尘暴）
        day_text = target_forecast.get('textDay', '')
        night_text = target_forecast.get('textNight', '')
        
        # 提取关键词
        keywords = condition.split('包含')[1].strip() if '包含' in condition else condition
        keywords = [k.strip() for k in keywords.split('或')]
        
        print(f"  检查关键词条件: {day_text}/{night_text} 是否包含 {keywords}")
        
        # 检查白天或夜间天气是否包含关键词
        for keyword in keywords:
            if keyword in day_text or keyword in night_text:
                print(f"满足条件: {region_data['region']} 在 {alert_date_str} 的天气包含关键词 '{keyword}'")
                rule['matched_forecast_date'] = alert_date_str
                return True
    
    print(f"  结果: 没有满足 '{weather_type}' 规则的条件")
    return False

# 检查天气预警条件
def check_alert_conditions(weather_data, forecast_hours=24):
    """
    检查天气数据是否满足预警条件
    
    修改：确保对每个客户检查所有预警条件，并为每个满足的条件创建单独的预警
    """
    alerts = []
    
    # 加载预警规则
    try:
        with open('alert_rules.json', 'r', encoding='utf-8') as f:
            rules = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("无法加载预警规则")
        return []
    
    # 加载客户数据
    try:
        with open('customers_data.json', 'r', encoding='utf-8') as f:
            customers = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("无法加载客户数据")
        return []
    
    # 加载全局设置
    try:
        with open('settings.json', 'r', encoding='utf-8') as f:
            settings = json.load(f)
            global_advance_days = settings.get('alertAdvanceTime', 1)  # 读取全局提前预警天数
            interval_prediction = settings.get('intervalPrediction', False)  # 读取是否启用区间预测
            if settings.get('autoRetry') is not None and settings.get('intervalPrediction') is None:
                # 兼容处理，如果有旧版配置但没有新配置
                interval_prediction = settings.get('autoRetry', False)
            
            print(f"全局提前预警天数设置为: {global_advance_days}天")
            print(f"区间预测模式: {'已启用' if interval_prediction else '未启用'}")
    except (FileNotFoundError, json.JSONDecodeError):
        global_advance_days = 1
        interval_prediction = False
        print("无法加载设置文件，使用默认提前预警天数: 1天")
    
    # 对每个地区的天气数据进行检查
    for region, region_data in weather_data.items():
        # 对每个预警规则进行检查
        for rule in rules:
            if rule.get('status') != '活跃':
                continue
                
            # 获取提前预警天数 - 优先使用规则中的设置，如果没有则使用全局设置
            advance_days = rule.get('advanceTime')
            if advance_days is None:
                advance_days = global_advance_days
            else:
                # 确保是整数类型
                try:
                    advance_days = int(advance_days)
                except (ValueError, TypeError):
                    advance_days = global_advance_days
            
            # 区间预测模式：检查从当天到提前预警天数的整个区间
            matched_forecasts = []
            
            if interval_prediction:
                # 在区间内检查所有日期
                print(f"区间预测模式：检查从今天到提前{advance_days}天的整个区间")
                
                # 为每一天创建临时规则副本并检查
                for day in range(0, advance_days + 1):
                    # 计算当前检查的日期距离今天的天数
                    check_day = day
                    
                    # 创建临时规则，设置对应的提前预警天数
                    temp_rule = rule.copy()
                    temp_rule['advanceTime'] = str(check_day)
                    
                    # 检查当前日期是否满足条件
                    if is_condition_met(region_data, temp_rule, forecast_hours):
                        # 如果满足条件，记录该日期的预报信息
                        matched_date = temp_rule.get('matched_forecast_date')
                        matched_forecasts.append({
                            'days': check_day,  # 相对于当前日期的天数
                            'date': matched_date,  # 实际日期
                            'rule': temp_rule  # 规则副本，包含满足条件的日期
                        })
                
                # 如果有多个日期满足条件，选择最接近当前日期的
                if matched_forecasts:
                    # 按照距离当前日期的天数排序（升序）
                    matched_forecasts.sort(key=lambda x: x['days'])
                    # 取最接近当前日期的预报
                    closest_forecast = matched_forecasts[0]
                    
                    print(f"在区间内发现 {len(matched_forecasts)} 天满足条件，选择最接近当前日期的: {closest_forecast['date']}")
                    
                    # 更新规则中的匹配日期
                    rule['matched_forecast_date'] = closest_forecast['date']
                    
                    # 找到该地区的所有客户
                    region_customers = [c for c in customers if c['region'] == region]
                    
                    # 对每个客户检查是否关注此类型的预警
                    for customer in region_customers:
                        # 检查客户是否关注此类型的预警
                        if rule['type'] in customer.get('weatherTypes', []):
                            # 创建预警记录
                            alert = {
                                'customer': customer,
                                'region': region,
                                'weather_type': rule['type'],
                                'condition': rule['condition'],
                                'rule': rule,
                                'global_advance_days': global_advance_days,
                                'forecast_date': closest_forecast['date']
                            }
                            alerts.append(alert)
            else:
                # 原始模式：只检查特定的提前预警天数
                # 创建临时规则副本
                temp_rule = rule.copy()
                temp_rule['advanceTime'] = str(advance_days)
                
                # 检查天气数据是否满足规则条件
                if is_condition_met(region_data, temp_rule, forecast_hours):
                    # 保存满足条件的预报日期
                    matched_date = temp_rule.get('matched_forecast_date')
                    
                    # 找到该地区的所有客户
                    region_customers = [c for c in customers if c['region'] == region]
                    
                    # 对每个客户检查是否关注此类型的预警
                    for customer in region_customers:
                        # 检查客户是否关注此类型的预警
                        if rule['type'] in customer.get('weatherTypes', []):
                            # 创建预警记录
                            alert = {
                                'customer': customer,
                                'region': region,
                                'weather_type': rule['type'],
                                'condition': rule['condition'],
                                'rule': rule,
                                'global_advance_days': global_advance_days,
                                'forecast_date': matched_date
                            }
                            alerts.append(alert)
    
    return alerts

# 检查是否是重复预警
def is_duplicate_alert(customer, weather_type, data_logs):
    """
    检查最近三天是否已发送过相同条件的预警
    
    参数:
    - customer: 客户信息
    - weather_type: 天气类型
    - data_logs: 历史预警日志
    
    返回:
    - 是否是重复预警
    """
    if not data_logs:
        return False
    
    current_time = datetime.datetime.now()
    three_days_ago = current_time - datetime.timedelta(days=3)
    
    # 将三天前的日期转换为字符串格式，用于比较
    three_days_ago_str = three_days_ago.strftime('%Y-%m-%d')
    
    for log in data_logs:
        # 检查是否是同一地区、同一天气类型的预警
        if (log.get('region') == customer.get('region') and 
            log.get('weather_type') == weather_type and 
            log.get('status') == '已发送'):
            
            # 检查时间是否在三天内
            log_time_str = log.get('timestamp', '').split(' ')[0]  # 提取日期部分
            if log_time_str >= three_days_ago_str:
                return True
    
    return False

# 发送预警通知
def send_alerts(alerts, is_test=False):
    """
    发送预警邮件
    
    修改：确保处理所有预警，不跳过同一客户的多个预警
    重复邮件定义：一周之内，同一收件对象，同一触发条件
    """
    if not alerts:
        print("没有需要发送的预警")
        return False
    
    # 加载模板数据
    templates = {}
    try:
        with open('templates_data.json', 'r', encoding='utf-8') as f:
            templates_data = json.load(f)
            
        # 按类型组织模板
        for template in templates_data:
            if template.get('isActive', True) and template.get('type'):
                # 如果已有这个类型的模板，存储为列表
                if template['type'] not in templates:
                    templates[template['type']] = []
                templates[template['type']].append(template)
    except (FileNotFoundError, json.JSONDecodeError):
        print("无法加载模板数据")
        return False
    
    # 加载历史日志数据，用于检查重复预警
    try:
        with open('data.json', 'r', encoding='utf-8') as f:
            history_logs = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history_logs = []
    
    # 准备发送的邮件列表
    emails_to_send = []
    
    # 处理每个预警
    for alert in alerts:
        customer = alert['customer']
        weather_type = alert['weather_type']
        customer_category = customer.get('category', '客户')  # 获取客户类别，默认为"客户"
        
        # 查找对应的模板
        if weather_type not in templates:
            print(f"未找到{weather_type}类型的模板，跳过")
            continue
        
        # 根据客户类别选择合适的模板
        suitable_template = None
        available_templates = templates[weather_type]
        
        for template in available_templates:
            target_role = template.get('targetRole', 'all')
            
            # 对于客户：可以使用通用(all)模板或客户专用(customer)模板
            if customer_category == '客户' and (target_role == 'all' or target_role == 'customer'):
                suitable_template = template
                break
            # 对于工程师：可以使用通用(all)模板或工程师专用(engineer)模板
            elif customer_category == '工程师' and (target_role == 'all' or target_role == 'engineer'):
                suitable_template = template
                break
        
        # 如果没有找到合适的模板，跳过
        if not suitable_template:
            print(f"未找到适合{customer_category}的{weather_type}类型模板，跳过")
            continue
        
        template = suitable_template
        
        # 准备邮件数据
        email_data = {
            'to_email': customer['email'],
            'to_name': customer['name'],
            'subject': template['subject'],
            'content': replace_template_variables(template['content'], customer, alert),
            'company': customer.get('company', ''),
            'region': customer['region'],
            'weather_type': weather_type,
            'alert_date': get_alert_date(alert),
            'template_type': weather_type,
            'condition': alert.get('condition', ''),  # 添加触发条件
            'category': customer_category,
            'is_test': is_test
        }
        
        # 确保内容不为空
        if not email_data['content']:
            print(f"警告: {customer['name']}的{weather_type}预警邮件内容为空，使用默认内容")
            # 添加默认内容
            email_data['content'] = f"""
尊敬的{customer['name']}：

我们检测到您所在的{customer['region']}地区将在{email_data['alert_date']}出现{weather_type}天气情况。

具体情况：{alert.get('condition', '未知条件')}

请注意防范，确保安全。

此致
天气预警系统
            """
        
        # 确保主题不为空
        if not email_data['subject']:
            print(f"警告: {customer['name']}的{weather_type}预警邮件主题为空，使用默认主题")
            email_data['subject'] = f"{customer['region']}地区{weather_type}天气预警通知"
        
        # 添加附件信息
        if 'attachments' in template and template['attachments']:
            try:
                email_data['attachments'] = json.loads(template['attachments'])
            except:
                email_data['attachments'] = template['attachments']
        
        # 检查是否是重复预警（一周内同一收件人同一触发条件）
        is_duplicate = check_duplicate_alert(email_data, history_logs)
        
        # 标记重复预警
        email_data['is_duplicate'] = bool(is_duplicate)
        if is_duplicate:
            # 记录重复情况到日志，便于审计
            try:
                try:
                    with open('data.json', 'r', encoding='utf-8') as f:
                        log_data = json.load(f)
                except (FileNotFoundError, json.JSONDecodeError):
                    log_data = []
                new_id = max([log.get('id', 0) for log in log_data]) + 1 if log_data else 1
                log_entry = {
                    'id': new_id,
                    'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'recipient': email_data['to_email'],
                    'to_name': email_data.get('to_name', ''),
                    'weather_type': email_data.get('weather_type', ''),
                    'region': email_data.get('region', ''),
                    'subject': email_data.get('subject', ''),
                    'content': email_data.get('content', ''),
                    'alert_date': email_data.get('alert_date', ''),
                    'condition': email_data.get('condition', ''),
                    'status': '已记录（重复预警，7天内跳过）',
                    'category': email_data.get('category', ''),
                    'is_test': is_test
                }
                log_data.append(log_entry)
                with open('data.json', 'w', encoding='utf-8') as f:
                    json.dump(log_data, f, ensure_ascii=False, indent=4)
                trim_json_file('data.json', 'data_log')
            except Exception as log_err:
                print(f"记录重复预警日志失败: {log_err}")
            # 仅记录，不进入待发送队列
            print(f"检测到重复预警（仅记录，不发送/通知）: {email_data['to_name']} - {email_data['weather_type']} - {email_data['region']}")
            continue
        
        # 添加到发送列表
        emails_to_send.append(email_data)
    
    # 保存到数据库任务表
    try:
        ensure_mail_task_table()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for email in emails_to_send:
            # 使用时间戳 + 随机数，避免同一邮箱同一时刻多任务被覆盖
            task_id = f"task_{datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')}_{email['to_email']}_{random.randint(1000, 9999)}"
            payload = json.dumps(email, ensure_ascii=False)
            cursor.execute(
                """
                INSERT OR REPLACE INTO mail_task (task_id, status, payload, is_test, attempts, error, created_at, updated_at)
                VALUES (?, 'pending', ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (task_id, payload, 1 if is_test else 0)
            )
        conn.commit()
        conn.close()
        print(f"邮件任务已写入数据库，共 {len(emails_to_send)} 条")
    except Exception as e:
        print(f"保存邮件任务失败: {str(e)}")
        return False
    
    # 同步保存到文件以兼容现有流程
    try:
        backup_if_has_data('re-Emile.json', 're_emile')
        with open('re-Emile.json', 'w', encoding='utf-8') as f:
            json.dump(emails_to_send, f, ensure_ascii=False, indent=4)
        trim_json_file('re-Emile.json', 're_emile', max_entries=1000)
        print(f"邮件信息已保存到 re-Emile.json，共 {len(emails_to_send)} 条记录")
        return True
    except Exception as e:
        print(f"保存邮件信息到文件失败: {str(e)}")
        return False

def check_duplicate_alert(email_data, history_logs):
    """
    检查是否是重复预警（一周内同一收件人同一触发条件）
    注意：不使用 alert_date（预警日期）参与去重，避免每天预报日期滚动/区间预测导致重复发送。
    
    参数:
    - email_data: 当前邮件数据
    - history_logs: 历史日志数据
    
    返回:
    - 是否是重复预警
    """
    if not history_logs:
        return False
    
    current_time = datetime.datetime.now()
    one_week_ago = current_time - datetime.timedelta(days=7)
    
    current_email = email_data['to_email']
    current_region = email_data['region']
    current_weather_type = email_data['weather_type']
    current_condition = email_data.get('condition', '')
    current_category = email_data.get('category', '')
    
    for log in history_logs:
        try:
            log_time = datetime.datetime.strptime(log.get('timestamp', ''), '%Y-%m-%d %H:%M:%S')
        except Exception:
            continue
        if log_time < one_week_ago:
            continue
        
        if log.get('recipient') != current_email:
            continue
        if log.get('region') != current_region:
            continue
        if log.get('weather_type') != current_weather_type:
            continue
        # 兼容旧日志：如果任一方缺失条件/类别，不用作阻断条件
        log_condition = (log.get('condition', '') or '').strip()
        if log_condition and current_condition and log_condition != current_condition:
            continue
        log_category = (log.get('category', '') or '').strip()
        if log_category and current_category and log_category != current_category:
            continue
        
        status = log.get('status', '')
        if status.startswith('已发送') or status.startswith('已记录（重复预警'):
            return True
    
    return False

# 发送邮件
def send_emails():
    # 读取邮件信息
    emails = load_json_file(EMAIL_JSON_FILE)
    if not emails:
        print('没有找到需要发送的邮件信息。')
        return
    
    # 创建Flask应用
    app = Flask(__name__)
    register_routes(app)
    
    # 发送结果统计
    results = {
        'success': [],
        'failed': []
    }
    
    print('\n=== 开始发送邮件 ===\n')
    
    # 遍历发送邮件
    for email in emails:
        try:
            print(f"正在发送邮件给 {email['to_name']} ({email['to_email']})...")
            
            # 构建请求数据
            email_data = {
                'to': email['to_email'],
                'subject': email['subject'],
                'content': email['content']
            }
            
            # 添加附件，如果有的话
            if 'attachments' in email and email['attachments']:
                try:
                    # 如果附件信息是字符串，尝试解析它
                    attachments_data = email['attachments']
                    if isinstance(attachments_data, str):
                        if attachments_data.lower() != "null":
                            try:
                                attachments_data = json.loads(attachments_data)
                            except Exception as e:
                                print(f"解析邮件附件JSON字符串出错: {e}")
                                attachments_data = []
                        else:
                            attachments_data = []
                            
                    email_data['attachments'] = attachments_data
                    
                    if isinstance(attachments_data, list) and attachments_data:
                        print(f"邮件包含 {len(attachments_data)} 个附件: {attachments_data}")
                        
                        # 检查附件文件是否存在
                        for attachment in attachments_data:
                            # 首先检查templates目录
                            template_path = os.path.join(os.getcwd(), 'templates', attachment)
                            # 然后检查templates目录
                            twmplate_path = os.path.join(os.getcwd(), 'templates', attachment)
                            
                            if os.path.exists(template_path):
                                print(f"  - 附件 {attachment} 存在于templates目录")
                            elif os.path.exists(twmplate_path):
                                print(f"  - 附件 {attachment} 存在于templates目录")
                            else:
                                print(f"  - 警告: 附件 {attachment} 不存在")
                except Exception as e:
                    print(f"处理邮件附件时出错: {str(e)}")
                    email_data['attachments'] = []
            
            # 使用测试客户端发送请求
            with app.test_client() as client:
                response = client.post('/api/send-email', json=email_data)
                result = response.get_json()
                
                if result['success']:
                    print(f"✓ 发送成功")
                    results['success'].append({
                        'to_name': email['to_name'],
                        'to_email': email['to_email'],
                        'subject': email['subject']
                    })
                else:
                    print(f"✗ 发送失败: {result['message']}")
                    results['failed'].append({
                        'to_name': email['to_name'],
                        'to_email': email['to_email'],
                        'subject': email['subject'],
                        'error': result['message']
                    })
                
                # 添加短暂延迟，避免发送过快
                time.sleep(1)
                
        except Exception as e:
            print(f"✗ 发送出错: {str(e)}")
            results['failed'].append({
                'to_name': email['to_name'],
                'to_email': email['to_email'],
                'subject': email['subject'],
                'error': str(e)
            })
    
    # 打印发送报告
    print('\n=== 邮件发送报告 ===\n')
    print(f"总计需发送: {len(emails)} 封")
    print(f"发送成功: {len(results['success'])} 封")
    print(f"发送失败: {len(results['failed'])} 封\n")
    
    if results['failed']:
        print('发送失败的邮件列表:')
        for failed in results['failed']:
            print(f"- {failed['to_name']} ({failed['to_email']}): {failed['error']}")

def calculate_next_alert_time(settings):
    """计算下一次预警时间，支持时:分精度"""
    current_time = datetime.datetime.now()
    first_hour, first_minute = parse_first_alert_time(settings)
    warning_interval = settings.get('warningInterval', 12)  # 默认12小时间隔
    try:
        warning_interval = int(warning_interval)
        if warning_interval <= 0:
            warning_interval = 12
    except Exception:
        warning_interval = 12
    
    # 今天的首次预警时间
    today_first_alert = current_time.replace(hour=first_hour, minute=first_minute, second=0, microsecond=0)
    
    # 如果当前时间早于今天的首次预警时间，返回今天的首次预警时间
    if current_time < today_first_alert:
        return today_first_alert
    
    # 按间隔推算下一次
    delta_hours = (current_time - today_first_alert).total_seconds() / 3600
    intervals_passed = int(delta_hours / warning_interval)
    next_alert = today_first_alert + datetime.timedelta(hours=(intervals_passed + 1) * warning_interval)
    
    # 保底：若计算仍不大于当前时间，再顺延一轮
    if next_alert <= current_time:
        next_alert = next_alert + datetime.timedelta(hours=warning_interval)
    
    return next_alert

# 添加获取预警日期的辅助函数
def get_alert_date(alert):
    """
    获取预警日期
    
    参数:
    - alert: 预警信息
    
    返回:
    - 预警日期字符串
    """
    # 如果有预报日期，直接返回
    if 'forecast_date' in alert and alert['forecast_date']:
        return alert['forecast_date']
    
    # 否则根据提前预警天数计算
    current_date = datetime.datetime.now()
    
    # 使用全局提前预警天数
    if 'global_advance_days' in alert:
        advance_days = alert['global_advance_days']
    elif 'rule' in alert and 'advanceTime' in alert['rule']:
        # 从规则中获取提前天数（已在check_alert_conditions中统一设置为全局值）
        advance_days = int(alert['rule']['advanceTime'])
    else:
        # 默认值
        advance_days = 1
    
    # 计算预警日期
    alert_date = current_date + datetime.timedelta(days=advance_days)
    
    # 返回格式化的日期字符串
    return alert_date.strftime('%Y-%m-%d')

def main():
    """
    主函数：运行天气预警系统
    """
    try:
        # 读取配置文件
        config = load_json_file(SETTINGS_FILE)
        if not config:
            print("错误：无法加载配置文件")
            return
        
        # 读取预警规则
        rules = load_json_file(ALERT_RULES_FILE)
        if not rules:
            print("错误：无法加载预警规则")
            return
        
        # 获取全局预警天数
        global_advance_days = config.get('alertAdvanceTime', 1)
        print(f"\n全局提前预警天数设置为: {global_advance_days}天")
        
        # 获取所有地区的天气数据
        regions = get_customer_regions()
        if not regions:
            print("错误：未找到任何地区")
            return
            
        # 存储所有满足条件的预警信息
        all_alerts = []
        
        # 获取天气数据
        weather_data = fetch_weather_data(regions)
        if not weather_data:
            print("错误：无法获取天气数据")
            return
        
        # 检查预警条件
        forecast_hours = global_advance_days * 24
        alerts = check_alert_conditions(weather_data, forecast_hours)
        
        # 提取客户数据以便显示收件人信息
        customers = load_json_file(CUSTOMERS_FILE)
        customer_map = {}
        if customers:
            for customer in customers:
                key = f"{customer.get('region')}_{customer.get('name')}"
                customer_map[key] = customer
        
        # 处理预警信息
        for alert in alerts:
            customer = alert.get('customer', {})
            alert_info = {
                'region': alert.get('region', ''),
                'type': alert.get('weather_type', ''),
                'condition': alert.get('condition', ''),
                'date': alert.get('forecast_date', 'unknown'),
                'recipient': customer.get('name', ''),
                'email': customer.get('email', '')
            }
            all_alerts.append(alert_info)
            
        # 在末尾统一输出所有检测到的预警条件
        if all_alerts:
            print("\n=== 检测到的预警条件汇总 ===")
            # 按地区分组显示预警信息
            regions_alerts = {}
            for alert in all_alerts:
                region = alert['region']
                if region not in regions_alerts:
                    regions_alerts[region] = []
                regions_alerts[region].append(alert)
            
            # 按地区输出预警信息
            for region, alerts in regions_alerts.items():
                print(f"\n地区: {region}")
                for alert in alerts:
                    print(f"  - 日期: {alert['date']} | 类型: {alert['type']} | 条件: {alert['condition']} | 收件人: {alert['recipient']}({alert['email']})")
            print("\n==========================")
        else:
            print("\n=== 未检测到任何预警条件 ===")
            
    except Exception as e:
        print(f"系统运行出错: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
