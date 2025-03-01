from initialization import db
from datetime import datetime
from .price_model import PriceConfig

class Usage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    model_name = db.Column(db.String(50), nullable=False)  # 使用的模型名称
    tokens_in = db.Column(db.Integer, default=0)  # 输入token数
    tokens_out = db.Column(db.Integer, default=0)  # 输出token数
    image_ocr_input_tokens = db.Column(db.Integer, default=0)  # 图片OCR输入token数
    image_ocr_output_tokens = db.Column(db.Integer, default=0)  # 图片OCR输出token数
    image_ocr_cost = db.Column(db.Float, default=0.0)  # 图片OCR成本（美元）
    input_cost = db.Column(db.Float, default=0.0)  # 输入成本（美元）
    cached_input_tokens = db.Column(db.Integer, default=0)  # 缓存的输入token数
    output_cost = db.Column(db.Float, default=0.0)  # 输出成本（美元）
    total_cost = db.Column(db.Float, default=0.0)  # 总成本（美元）
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 创建时间
    
    def __init__(self, user_id, model_name, tokens_in=0, cached_input_tokens=0, tokens_out=0, image_ocr_input_tokens=0, image_ocr_output_tokens=0):
        self.user_id = user_id
        self.model_name = model_name
        self.tokens_in = tokens_in
        self.cached_input_tokens = cached_input_tokens
        self.tokens_out = tokens_out
        self.image_ocr_input_tokens = image_ocr_input_tokens
        self.image_ocr_output_tokens = image_ocr_output_tokens


    def calculate_cost(self):
        """计算使用成本（美元）"""
        # 从price_config获取价格配置
        price = PriceConfig.get_model_price(self.model_name)
        if price is None:
            self.input_cost = 0.0
            self.output_cost = 0.0
            self.total_cost = 0.0
            self.image_ocr_cost = 0.0
            return
            
        # 计算常规输入token成本
        regular_input_cost = (self.tokens_in / 1_000_000) * price['input']
        
        # 计算缓存token成本并加入到input_cost中
        if self.cached_input_tokens > 0:
            # 如果模型有特定的缓存价格，使用缓存价格；否则使用常规输入价格
            cache_price = price.get('cached_input', price['input'])
            cached_cost = (self.cached_input_tokens / 1_000_000) * cache_price
            # 将缓存成本直接加入到输入成本中
            self.input_cost = regular_input_cost + cached_cost
        else:
            self.input_cost = regular_input_cost
        
        # 计算输出成本
        self.output_cost = (self.tokens_out / 1_000_000) * price['output']

        # 计算图片OCR成本
        if self.image_ocr_input_tokens > 0 or self.image_ocr_output_tokens > 0:
            try:
                # 单独获取OCR模型的价格配置
                ocr_price = PriceConfig.get_model_price('qwen2.5-vl-72b-instruct')
                if ocr_price:
                    self.image_ocr_cost = (self.image_ocr_input_tokens / 1_000_000) * ocr_price['input'] + \
                                         (self.image_ocr_output_tokens / 1_000_000) * ocr_price['output']
                else:
                    # 如果找不到OCR模型价格，使用默认值或记录错误
                    print(f"警告: 找不到OCR模型'qwen2.5-vl-72b-instruct'的价格配置")
                    self.image_ocr_cost = 0.0
            except Exception as e:
                print(f"计算OCR成本时出错: {str(e)}")
                self.image_ocr_cost = 0.0
        else:
            self.image_ocr_cost = 0.0
        
        # 计算总成本
        self.total_cost = self.input_cost + self.output_cost + self.image_ocr_cost
        
        # 保留6位小数
        self.input_cost = round(self.input_cost, 6)
        self.output_cost = round(self.output_cost, 6)
        self.image_ocr_cost = round(self.image_ocr_cost, 6)
        self.total_cost = round(self.total_cost, 6)

    @staticmethod
    def add_usage(user_id, model_name, tokens_in, tokens_out, image_ocr_input_tokens, image_ocr_output_tokens):
        """添加使用记录"""
        usage = Usage(user_id=user_id,
                     model_name=model_name,
                     tokens_in=tokens_in,
                     tokens_out=tokens_out,
                     image_ocr_input_tokens=image_ocr_input_tokens,
                     image_ocr_output_tokens=image_ocr_output_tokens)
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