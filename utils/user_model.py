from initialization import db
from werkzeug.security import generate_password_hash, check_password_hash
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

