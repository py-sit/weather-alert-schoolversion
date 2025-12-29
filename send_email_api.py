# 邮件发送API

from flask import request, jsonify
import json
import os
import smtplib
import mimetypes
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.utils import formataddr
import email.utils
from maintenance_utils import log_health

# 设置数据JSON文件路径
SETTINGS_JSON_FILE = 'settings.json'
SMTP_TIMEOUT = 30  # SMTP连接超时时间（秒）
SMTP_MAX_RETRY = 3  # SMTP发送失败重试次数

def register_routes(app):
    @app.route('/api/send-email', methods=['POST'])
    def send_email():
        data = request.json
        
        # 获取请求数据
        to = data.get('to', '')
        subject = data.get('subject', '')
        content = data.get('content', '')
        attachments = data.get('attachments', [])  # 附件文件名列表
        
        # 验证必要的字段
        if not all([to, subject, content]):
            return jsonify({
                'success': False,
                'message': '请填写所有必要的邮件信息'
            })
        
        # 从settings.json读取邮件配置
        try:
            with open(SETTINGS_JSON_FILE, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            
            sender = settings.get('emailSender', '')
            name = settings.get('emailName', '')
            server = settings.get('smtpServer', '')
            port = settings.get('smtpPort', 587)
            username = settings.get('smtpUsername', '')
            password = settings.get('smtpPassword', '')
            
            # 验证邮件配置
            if not all([sender, server, port, username, password]):
                return jsonify({
                    'success': False,
                    'message': '邮件服务器配置不完整，请检查设置'
                })
            
            # 创建邮件
            message = MIMEMultipart('mixed')  # 明确指定为mixed类型
            message['From'] = formataddr((name, sender))
            message['To'] = to
            message['Subject'] = subject
            message['Date'] = email.utils.formatdate(localtime=True)
            message['Message-ID'] = email.utils.make_msgid()

            # 将纯文本内容转换为HTML（包含<br>标签的换行）
            email_content = prepare_email_content(content, is_html=True)

            # 设置邮件内容类型为HTML
            msg = MIMEText(email_content, 'html', 'utf-8')
            message.attach(msg)
            
            # 处理附件
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

            # 连接到SMTP服务器并发送邮件，增加超时与重试
            last_error = None
            for attempt in range(1, SMTP_MAX_RETRY + 1):
                smtp = None
                try:
                    smtp = smtplib.SMTP(server, port, timeout=SMTP_TIMEOUT)
                    smtp.ehlo()

                    if port == 587:
                        smtp.starttls()
                        smtp.ehlo()

                    smtp.login(username, password)
                    print(f"正在发送邮件到 {to}（第{attempt}次尝试）...")
                    smtp.sendmail(sender, [to], message.as_string())
                    print("邮件发送成功")
                    log_health('SMTP', True, f"向 {to} 发送成功（第{attempt}次）")
                    smtp.quit()
                    last_error = None
                    break
                except Exception as smtp_err:
                    last_error = smtp_err
                    log_health('SMTP', False, f"向 {to} 发送失败（第{attempt}次）: {smtp_err}")
                    print(f"发送失败（第{attempt}次）: {smtp_err}")
                    if smtp:
                        try:
                            smtp.quit()
                        except Exception:
                            pass
                    if attempt < SMTP_MAX_RETRY:
                        time.sleep(2)

            if last_error:
                raise last_error

            return jsonify({
                'success': True,
                'message': '邮件发送成功'
            })
            
        except Exception as e:
            print(f"发送邮件时出错: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'message': f'发送邮件时出错: {str(e)}'
            })

# 在发送邮件前处理邮件内容
def prepare_email_content(content, is_html=True):
    """
    准备邮件内容，处理换行符
    
    参数:
    - content: 原始邮件内容
    - is_html: 是否以HTML格式发送
    
    返回:
    - 处理后的邮件内容
    """
    if is_html:
        # 将纯文本换行符转换为HTML的<br>标签
        content = content.replace('\n', '<br>')
        # 将制表符转换为空格
        content = content.replace('\t', '&nbsp;&nbsp;&nbsp;&nbsp;')
        # 包装在HTML标签中
        content = f"""
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body>
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                {content}
            </div>
        </body>
        </html>
        """
    return content
