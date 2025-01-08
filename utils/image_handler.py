import base64
import os
import json
import time
from pathlib import Path
from initialization import app

def encode_image(image_path):
    with open(image_path, 'rb') as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return encoded_string

def normalize_user_id(user_id):
    """将用户ID（邮箱或数字ID）转换为标准格式"""
    # 如果是数字ID，需要先获取用户邮箱
    if isinstance(user_id, (int, str)) and str(user_id).isdigit():
        from utils.user_model import User
        user = User.query.get(int(user_id))
        if user:
            user_id = user.email
    
    # 将邮箱转换为标准格式
    return str(user_id).replace('@', '_').replace('.', '_')

def save_base64_locally(base64_data, user_id):
    """将 base64 数据保存到本地 JSON 文件，返回唯一标识符"""
    # 创建用户专属的 base64 存储目录
    normalized_user_id = normalize_user_id(user_id)
    base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'
    base_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成唯一标识符
    timestamp = int(time.time() * 1000)
    unique_id = f"{timestamp}"
    
    # 保存数据到 JSON 文件
    data = {
        'base64': base64_data,
        'created_at': timestamp
    }
    
    file_path = base_dir / f"{unique_id}.json"
    print(f"保存 base64 数据到文件: {file_path}")
    with open(str(file_path), 'w') as f:
        json.dump(data, f)
    
    return unique_id

def get_base64_by_id(base64_id, user_id):
    """根据 ID 获取 base64 数据"""
    try:
        # 构建文件路径
        normalized_user_id = normalize_user_id(user_id)
        base_dir = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store'
        file_path = base_dir / f"{base64_id}.json"
        
        # 检查文件是否存在
        if not file_path.exists():
            raise FileNotFoundError(f"找不到文件: {file_path}")
            
        # 读取并返回 base64 数据
        with open(str(file_path), 'r', encoding='utf-8') as f:
            data = json.loads(f.read())
            if 'base64' not in data:
                raise KeyError("文件中没有 base64 数据")
            return data['base64']
            
    except FileNotFoundError:
        raise
    except json.JSONDecodeError as e:
        raise json.JSONDecodeError(f"JSON 解析错误: {str(e)}", e.doc, e.pos)
    except Exception as e:
        raise Exception(f"获取 base64 数据失败: {str(e)}")

def delete_base64_file(base64_id, user_id):
    """删除指定的 base64 文件"""
    try:
        normalized_user_id = normalize_user_id(user_id)
        file_path = Path(app.config['UPLOAD_FOLDER']) / normalized_user_id / 'base64_store' / f"{base64_id}.json"
        if file_path.exists():
            os.remove(str(file_path))
            print(f"已删除文件: {file_path}")
            return True
    except Exception as e:
        print(f"删除文件失败: {str(e)}")
        return False