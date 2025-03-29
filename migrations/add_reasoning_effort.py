import os
import sys

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from app import app, db
from sqlalchemy import text

def add_reasoning_effort_field():
    """添加reasoning_effort列到conversation表"""
    with app.app_context():
        # 检查列是否已存在
        inspector = db.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('conversation')]
        
        if 'reasoning_effort' not in columns:
            print("正在添加列: reasoning_effort")
            # SQLite不支持ALTER TABLE ADD COLUMN WITH DEFAULT，所以我们需要创建新表
            create_table_sql = text("""
                CREATE TABLE conversation_new (
                    id VARCHAR(50) PRIMARY KEY,
                    title VARCHAR(200),
                    messages JSON,
                    system_prompt TEXT,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    temperature FLOAT DEFAULT 0.7,
                    max_tokens INTEGER DEFAULT 4096,
                    reasoning_effort VARCHAR(20) DEFAULT 'high',
                    FOREIGN KEY(user_id) REFERENCES user(id)
                )
            """)
            
            # 复制数据
            copy_data_sql = text("""
                INSERT INTO conversation_new (
                    id, title, messages, system_prompt, user_id,
                    created_at, updated_at, temperature, max_tokens, reasoning_effort
                )
                SELECT 
                    id, title, messages, system_prompt, user_id,
                    created_at, updated_at, temperature, max_tokens, 'high'
                FROM conversation
            """)
            
            # 删除旧表并重命名新表
            drop_table_sql = text("DROP TABLE conversation")
            rename_table_sql = text("ALTER TABLE conversation_new RENAME TO conversation")
            
            try:
                # 执行SQL语句
                db.session.execute(create_table_sql)
                db.session.execute(copy_data_sql)
                db.session.execute(drop_table_sql)
                db.session.execute(rename_table_sql)
                
                # 提交更改
                db.session.commit()
                print("成功添加列: reasoning_effort！")
            except Exception as e:
                db.session.rollback()
                print(f"更新数据库时出错: {str(e)}")
                raise
        else:
            print("reasoning_effort列已存在，无需更新。")

if __name__ == '__main__':
    add_reasoning_effort_field() 