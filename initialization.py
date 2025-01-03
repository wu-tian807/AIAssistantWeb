import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from openai import OpenAI
import google.generativeai as genai
from config import API_KEYS, API_BASE_URLS

# 初始化 Flask 应用
app = Flask(__name__)
app.secret_key = 'wutianrandomkey1432532534632'  # 用于session加密，请更改为随机字符串

#路径用于存储上传的图片
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# 确保上传文件夹存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 数据库配置
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 邮件服务器配置
app.config['MAIL_SERVER'] = 'smtp.qq.com'  # QQ邮箱的SMTP服务器
app.config['MAIL_PORT'] = 465  # QQ邮箱的SSL端口
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = '2212929908@qq.com'  # 你的QQ邮箱
app.config['MAIL_PASSWORD'] = 'bqtzsojusmuldhgh'  # 你的QQ邮箱授权码
app.config['MAIL_DEFAULT_SENDER'] = ('AI助手', '2212929908@qq.com')
app.config['MAIL_MAX_EMAILS'] = None
app.config['MAIL_ASCII_ATTACHMENTS'] = False
app.config['MAIL_TIMEOUT'] = 30  # 设置超时时间为30秒

# 初始化扩展
db = SQLAlchemy(app)
mail = Mail(app)

# 初始化API客户端
xai_client = OpenAI(api_key=API_KEYS['xai'], base_url=API_BASE_URLS['xai'])
genai.configure(api_key=API_KEYS['google'])