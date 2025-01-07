import os
import json
from datetime import datetime, timedelta

class OCRCache:
    def __init__(self, cache_dir):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
    def _get_cache_path(self, user_id, image_path):
        """获取缓存文件路径"""
        # 使用图片路径的哈希值作为缓存文件名
        import hashlib
        image_hash = hashlib.md5(image_path.encode()).hexdigest()
        return os.path.join(self.cache_dir, f"{user_id}_{image_hash}.json")
        
    def get_ocr_result(self, user_id, image_path):
        """获取OCR缓存结果"""
        cache_path = self._get_cache_path(user_id, image_path)
        if not os.path.exists(cache_path):
            return None
            
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                
            # 检查缓存是否过期（默认7天）
            cache_time = datetime.fromisoformat(cache_data['timestamp'])
            if datetime.now() - cache_time > timedelta(days=7):
                os.remove(cache_path)
                return None
                
            return cache_data['ocr_result']
        except Exception as e:
            print(f"读取OCR缓存出错: {str(e)}")
            return None
            
    def save_ocr_result(self, user_id, image_path, ocr_result):
        """保存OCR结果到缓存"""
        cache_path = self._get_cache_path(user_id, image_path)
        try:
            cache_data = {
                'timestamp': datetime.now().isoformat(),
                'ocr_result': ocr_result
            }
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存OCR缓存出错: {str(e)}")
            return False
            
    def clear_expired_cache(self, days=7):
        """清理过期的缓存文件"""
        try:
            for filename in os.listdir(self.cache_dir):
                cache_path = os.path.join(self.cache_dir, filename)
                try:
                    with open(cache_path, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    cache_time = datetime.fromisoformat(cache_data['timestamp'])
                    if datetime.now() - cache_time > timedelta(days=days):
                        os.remove(cache_path)
                except:
                    # 如果文件损坏，直接删除
                    os.remove(cache_path)
        except Exception as e:
            print(f"清理OCR缓存出错: {str(e)}") 