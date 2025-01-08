from initialization import db
from datetime import datetime
from .price_config import PRICE_CONFIG

class PriceConfig:
    @staticmethod
    def get_model_price(model_name):
        """获取指定模型的价格配置"""
        return PRICE_CONFIG.get(model_name)

    @staticmethod
    def get_all_prices():
        """获取所有模型的价格配置"""
        return PRICE_CONFIG 