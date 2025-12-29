import json
import time
import os
from send_email_api import register_routes
from flask import Flask

# 设置数据JSON文件路径
EMAIL_JSON_FILE = 're-Emile.json'

def load_json_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f'读取JSON文件时出错: {str(e)}')
        return None

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
                email_data['attachments'] = email['attachments']
                print(f"邮件包含 {len(email['attachments'])} 个附件")
                
                # 检查附件文件是否存在
                for attachment in email['attachments']:
                    attachment_path = os.path.join(os.getcwd(), 'templates', attachment)
                    if os.path.exists(attachment_path):
                        print(f"  - 附件 {attachment} 存在")
                    else:
                        print(f"  - 警告: 附件 {attachment} 不存在")
            
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

if __name__ == '__main__':
    send_emails()