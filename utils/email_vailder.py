from initialization import app, mail
import random
import string
from flask_mail import Message
from config import RATE_LIMIT_WINDOW, MAX_EMAILS_PER_WINDOW
from utils.rate_limiter import email_send_times
import time
def check_rate_limit(email):
    """检查邮件发送频率限制"""
    current_time = time.time()
    # 清理过期的记录
    email_send_times[email] = [t for t in email_send_times[email] if current_time - t < RATE_LIMIT_WINDOW]
    
    # 检查是否超过限制
    if len(email_send_times[email]) >= MAX_EMAILS_PER_WINDOW:
        return False
    
    # 添加新的发送时间
    email_send_times[email].append(current_time)
    return True

# 生成验证码
def generate_verification_code():
    return ''.join(random.choices(string.digits, k=6))

# 发送验证码邮件
def send_verification_email(email, code):
    try:
        msg = Message(
            subject='AI助手 - 验证码',
            sender=app.config['MAIL_DEFAULT_SENDER'],
            recipients=[email]
        )
        msg.body = f'''
您好！

您的验证码是：{code}

该验证码将在5分钟后过期，请尽快使用。

如果这不是您的操作，请忽略此邮件。

祝好，
AI助手团队
'''
        
        # 尝试多次发送邮件
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"正在尝试发送邮件到 {email}，第 {attempt + 1} 次尝试")
                with app.app_context():
                    with mail.connect() as conn:
                        conn.send(msg)
                print(f"邮件发送成功")
                return True
            except Exception as e:
                print(f"邮件发送失败，第 {attempt + 1} 次尝试: {str(e)}")
                if attempt == max_retries - 1:  # 最后一次尝试
                    raise
                continue
    except Exception as e:
        print(f"邮件发送错误: {str(e)}")
        # 检查是否是授权码问题
        if "authentication failed" in str(e).lower():
            print("可能是QQ邮箱授权码无效，请检查授权码是否正确或是否过期")
        # 检查是否是连接问题
        elif "connection" in str(e).lower():
            print("连接到邮件服务器失败，请检查网络连接和防火墙设置")
        return False
