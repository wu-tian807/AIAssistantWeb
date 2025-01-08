import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from openai import OpenAI
import google.generativeai as genai
from config import API_KEYS, API_BASE_URLS
from flask_migrate import Migrate
import random

# 创建Gemini API实例池
class GeminiAPIPool:
    def __init__(self, api_keys):
        self.api_keys = api_keys
        self._initialize_clients()
    
    def _initialize_clients(self):
        self.clients = []
        for api_key in self.api_keys:
            genai_instance = genai.GenerativeModel
            genai.configure(api_key=api_key)
            self.clients.append({
                'genai': genai,
                'instance': genai_instance,
                'api_key': api_key
            })
    
    def get_client(self):
        # 随机选择一个客户端
        client = random.choice(self.clients)
        # 确保使用正确的API key
        genai.configure(api_key=client['api_key'])
        return client['genai'], client['instance']

# 初始化 Flask 应用
app = Flask(__name__)
app.secret_key = 'wutianrandomkey1432532534632'  # 用于session加密，请更改为随机字符串

#路径用于存储上传的图片
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 创建上传相关的文件夹结构
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # 主上传文件夹
os.makedirs(os.path.join(UPLOAD_FOLDER, 'temp'), exist_ok=True)  # 临时处理文件夹
app.config['TEMP_FOLDER'] = os.path.join(UPLOAD_FOLDER, 'temp')

# 设置文件上传相关的配置
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB
app.config['MAX_CONTENT_PATH'] = None  # 不限制文件路径长度

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

# 初始化Gemini API池
gemini_pool = GeminiAPIPool(API_KEYS['google'])

# 初始化API客户端
xai_client = OpenAI(api_key=API_KEYS['xai'][0], base_url=API_BASE_URLS['xai'])
deepseek_client = OpenAI(api_key=API_KEYS['deepseek'][0], base_url=API_BASE_URLS['deepseek'])

# # 导出gemini_pool以供其他模块使用
# genai, GenerativeModel = gemini_pool.get_client()

# 初始化数据库迁移
migrate = Migrate(app, db)

def init_app():
    # 初始化数据库
    with app.app_context():
        db.create_all()