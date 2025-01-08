from initialization import db
from datetime import datetime
from .price_model import PriceConfig

class Usage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    model_name = db.Column(db.String(50), nullable=False)  # 使用的模型名称
    tokens_in = db.Column(db.Integer, default=0)  # 输入token数
    tokens_out = db.Column(db.Integer, default=0)  # 输出token数
    input_cost = db.Column(db.Float, default=0.0)  # 输入成本（美元）
    output_cost = db.Column(db.Float, default=0.0)  # 输出成本（美元）
    total_cost = db.Column(db.Float, default=0.0)  # 总成本（美元）
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 创建时间
    
    def __init__(self, user_id, model_name, tokens_in=0, tokens_out=0):
        self.user_id = user_id
        self.model_name = model_name
        self.tokens_in = tokens_in
        self.tokens_out = tokens_out

    def calculate_cost(self):
        """计算使用成本（美元）"""
        # 从price_config获取价格配置
        price = PriceConfig.get_model_price(self.model_name)
        if price is None:
            self.input_cost = 0.0
            self.output_cost = 0.0
            self.total_cost = 0.0
            return
            
        # 计算输入和输出成本（每百万token的价格）
        self.input_cost = (self.tokens_in / 1_000_000) * price['input']
        self.output_cost = (self.tokens_out / 1_000_000) * price['output']
        self.total_cost = self.input_cost + self.output_cost
        
        # 保留6位小数
        self.input_cost = round(self.input_cost, 6)
        self.output_cost = round(self.output_cost, 6)
        self.total_cost = round(self.total_cost, 6)

    @staticmethod
    def add_usage(user_id, model_name, tokens_in, tokens_out):
        """添加使用记录"""
        usage = Usage(user_id=user_id,
                     model_name=model_name,
                     tokens_in=tokens_in,
                     tokens_out=tokens_out)
        usage.calculate_cost()  # 手动调用计算成本
        db.session.add(usage)
        db.session.commit()
        return usage

    @staticmethod
    def get_user_usage(user_id, start_date=None, end_date=None):
        """获取用户使用记录"""
        query = Usage.query.filter_by(user_id=user_id)
        
        if start_date:
            query = query.filter(Usage.created_at >= start_date)
        if end_date:
            query = query.filter(Usage.created_at <= end_date)
            
        return query.all()

    @staticmethod
    def get_user_total_cost(user_id, start_date=None, end_date=None):
        """获取用户总消费（美元）"""
        query = Usage.query.filter_by(user_id=user_id)
        
        if start_date:
            query = query.filter(Usage.created_at >= start_date)
        if end_date:
            query = query.filter(Usage.created_at <= end_date)
            
        return query.with_entities(db.func.sum(Usage.total_cost)).scalar() or 0.0 