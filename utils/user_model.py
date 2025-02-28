from initialization import db
from werkzeug.security import generate_password_hash, check_password_hash
from .price.usage_model import Usage

# 默认用户设置
DEFAULT_USER_SETTINGS = {
    'image_compression': True,  # 默认开启图片压缩
    'dark_theme': False,  # 默认关闭夜间主题
    'enable_ocr': True,  # 默认开启非视觉模型的OCR功能
}

# 用户模型
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(6))
    code_timestamp = db.Column(db.DateTime(timezone=True))
    profile_icon = db.Column(db.String(256))
    display_name = db.Column(db.String(50))
    settings = db.Column(db.JSON, default=lambda: dict(DEFAULT_USER_SETTINGS))
    
    # 添加与Usage的关联
    usages = db.relationship('Usage', backref='user', lazy=True)
    
    def get_total_cost(self, start_date=None, end_date=None):
        """获取用户总消费"""
        return Usage.get_user_total_cost(self.id, start_date, end_date)
    
    def get_usage_history(self, start_date=None, end_date=None):
        """获取用户使用记录"""
        return Usage.get_user_usage(self.id, start_date, end_date)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_profile_icon(self):
        return self.profile_icon
    
    def set_profile_icon(self, icon_path):
        self.profile_icon = icon_path

    def get_display_name(self):
        return self.display_name or ''

    def set_display_name(self, name):
        if name is None:
            self.display_name = None
        else:
            name = str(name).strip()
            self.display_name = name if name else None
            
    def get_setting(self, key, default=None):
        """获取用户设置值"""
        if self.settings is None:
            self.settings = dict(DEFAULT_USER_SETTINGS)
        return self.settings.get(key, default)

    def set_setting(self, key, value):
        """设置用户设置值"""
        if self.settings is None:
            self.settings = dict(DEFAULT_USER_SETTINGS)
        # 确保设置是一个新的字典，避免引用问题
        settings_copy = dict(self.settings)
        settings_copy[key] = value
        self.settings = settings_copy
        
    def update_settings(self, settings_dict):
        """批量更新用户设置"""
        if self.settings is None:
            self.settings = dict(DEFAULT_USER_SETTINGS)
        # 确保设置是一个新的字典，避免引用问题
        settings_copy = dict(self.settings)
        settings_copy.update(settings_dict)
        self.settings = settings_copy
        
    def delete_setting(self, key):
        """删除用户设置"""
        if self.settings is not None and key in self.settings:
            # 确保设置是一个新的字典，避免引用问题
            settings_copy = dict(self.settings)
            del settings_copy[key]
            self.settings = settings_copy

