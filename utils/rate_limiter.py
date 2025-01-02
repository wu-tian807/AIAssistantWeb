import redis
import logging
from collections import defaultdict
from typing import List
import time

class RateLimiter:
    """频率限制器的抽象基类"""
    def __getitem__(self, key: str) -> List[float]:
        raise NotImplementedError
        
    def __setitem__(self, key: str, value: List[float]) -> None:
        raise NotImplementedError

class RedisRateLimiter(RateLimiter):
    def __init__(self, host='localhost', port=6379, db=0):
        self.redis = None
        try:
            self.redis = redis.Redis(
                host=host,
                port=port,
                db=db,
                decode_responses=True,
                socket_timeout=2,
                socket_connect_timeout=2,
                retry_on_timeout=False
            )
            self.redis.ping()
        except Exception as e:
            logging.warning(f"Redis连接失败: {e}")
            self.dict = defaultdict(list)
            
    def __getitem__(self, key: str) -> List[float]:
        if self.redis:
            try:
                records = self.redis.lrange(f"rate_limit:{key}", 0, -1)
                return [float(t) for t in records]
            except Exception as e:
                logging.error(f"Redis获取失败: {e}")
                return self.dict[key]
        return self.dict[key]
        
    def __setitem__(self, key: str, value: List[float]) -> None:
        if self.redis:
            try:
                pipe = self.redis.pipeline()
                pipe.delete(f"rate_limit:{key}")
                if value:  # 只在有值时写入
                    pipe.rpush(f"rate_limit:{key}", *value)
                pipe.execute()
                return
            except Exception as e:
                logging.error(f"Redis设置失败: {e}")
                self.dict[key] = value
        self.dict[key] = value

class LocalRateLimiter(RateLimiter):
    def __init__(self):
        self.storage = defaultdict(list)
        
    def __getitem__(self, key: str) -> List[float]:
        return self.storage[key]
        
    def __setitem__(self, key: str, value: List[float]) -> None:
        self.storage[key] = value

# 创建全局实例
email_send_times = RedisRateLimiter()  # 如果Redis连接失败会自动降级到本地存储

