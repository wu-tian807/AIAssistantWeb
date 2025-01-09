import sqlite3
import json
import time
from pathlib import Path
from initialization import app, db
from utils.image_handler import save_base64_locally, normalize_user_id
from utils.conversation_model import Conversation

def add_new_columns():
    """添加新的temperature和max_tokens列"""
    try:
        # 获取数据库连接
        conn = db.session.connection().connection
        cursor = conn.cursor()
        
        # 检查temperature列是否存在
        cursor.execute("PRAGMA table_info(conversation)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]
        
        # 添加temperature列
        if 'temperature' not in column_names:
            print("添加temperature列...")
            cursor.execute("ALTER TABLE conversation ADD COLUMN temperature FLOAT DEFAULT 0.7")
            print("temperature列添加成功")
            
        # 添加max_tokens列
        if 'max_tokens' not in column_names:
            print("添加max_tokens列...")
            cursor.execute("ALTER TABLE conversation ADD COLUMN max_tokens INTEGER DEFAULT 4096")
            print("max_tokens列添加成功")
            
        conn.commit()
        print("数据库结构更新完成")
        
    except Exception as e:
        print(f"添加新列时发生错误: {str(e)}")
        raise e

def update_old_conversations():
    """为旧对话添加默认的max_tokens和temperature值"""
    try:
        # 获取所有对话
        conversations = Conversation.query.all()
        updated_count = 0
        
        for conversation in conversations:
            updated = False
            
            # 检查并设置默认temperature
            if conversation.temperature is None:
                conversation.temperature = 0.7
                updated = True
            
            # 检查并设置默认max_tokens
            if conversation.max_tokens is None:
                # 检查对话中最后一条助手消息的模型类型
                last_assistant_message = None
                if conversation.messages:
                    for msg in reversed(conversation.messages):
                        if msg.get('role') == 'assistant':
                            last_assistant_message = msg
                            break
                
                # 根据不同模型设置不同的默认max_tokens
                model_id = last_assistant_message.get('modelId') if last_assistant_message else None
                if model_id:
                    if 'grok' in model_id.lower():
                        conversation.max_tokens = 2048  # Grok默认值
                    elif 'deepseek' in model_id.lower():
                        conversation.max_tokens = 4096  # DeepSeek默认值
                    elif 'gemini' in model_id.lower():
                        conversation.max_tokens = 8192  # Gemini默认值
                    else:
                        conversation.max_tokens = 4096  # 通用默认值
                else:
                    conversation.max_tokens = 4096  # 如果没有模型信息，使用通用默认值
                
                updated = True
            
            if updated:
                updated_count += 1
        
        # 提交所有更改
        if updated_count > 0:
            db.session.commit()
            print(f"成功更新了 {updated_count} 个旧对话的设置")
        else:
            print("没有需要更新的旧对话")
            
    except Exception as e:
        db.session.rollback()
        print(f"更新旧对话时发生错误: {str(e)}")
        raise e

if __name__ == '__main__':
    print("正在初始化应用上下文...")
    with app.app_context():
        # 先添加新列
        add_new_columns()
        # 然后更新数据
        update_old_conversations() 