from initialization import db
from datetime import datetime, timezone
# 添加Conversation模型
class Conversation(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    title = db.Column(db.String(200))
    messages = db.Column(db.JSON)
    system_prompt = db.Column(db.Text)  # 添加系统提示词字段
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'messages': self.messages,
            'systemPrompt': self.system_prompt,  # 添加系统提示词到返回的字典中
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }