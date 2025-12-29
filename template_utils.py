import re
import datetime

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
        '{{姓名}}': customer_data.get('name', ''),
        '{{称呼}}': customer_data.get('title', ''),
    }
    
    # 替换内容中的所有变量
    content = template_content
    for var, value in variables.items():
        content = content.replace(var, str(value) if value is not None else '')
    
    # 使用正则表达式查找并替换任何剩余的 {{变量名}} 格式的内容
    content = re.sub(r'{{.*?}}', '', content)
    
    return content 