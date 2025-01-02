from flask import session, redirect, url_for
from utils.user_model import User
from functools import wraps

# 登录验证装饰器
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
            
        # 验证用户是否存在
        user = User.query.get(session['user_id'])
        if not user:
            # 如果用户不存在，清除 session 并重定向到登录页面
            session.clear()
            return redirect(url_for('login'))
            
        return f(*args, **kwargs)
    return decorated_function
