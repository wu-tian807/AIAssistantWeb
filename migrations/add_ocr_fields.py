import os
import sys

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from app import app, db
from sqlalchemy import text

def add_ocr_fields():
    """添加image_ocr_input_tokens、image_ocr_output_tokens和image_ocr_cost列到usage表"""
    with app.app_context():
        # 检查列是否已存在
        inspector = db.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('usage')]
        needed_columns = ['image_ocr_input_tokens', 'image_ocr_output_tokens', 'image_ocr_cost']
        missing_columns = [col for col in needed_columns if col not in columns]
        
        if missing_columns:
            print(f"正在添加列: {', '.join(missing_columns)}")
            # SQLite不支持ALTER TABLE ADD COLUMN WITH DEFAULT，所以我们需要创建新表
            create_table_sql = text("""
                CREATE TABLE usage_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    model_name VARCHAR(100) NOT NULL,
                    tokens_in INTEGER NOT NULL,
                    tokens_out INTEGER NOT NULL,
                    cached_input_tokens INTEGER DEFAULT 0,
                    image_ocr_input_tokens INTEGER DEFAULT 0,
                    image_ocr_output_tokens INTEGER DEFAULT 0,
                    image_ocr_cost FLOAT DEFAULT 0.0,
                    input_cost FLOAT NOT NULL,
                    output_cost FLOAT NOT NULL,
                    total_cost FLOAT NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES user(id)
                )
            """)
            
            # 复制数据
            copy_data_sql = text("""
                INSERT INTO usage_new (
                    id, user_id, model_name, tokens_in, tokens_out,
                    cached_input_tokens, image_ocr_input_tokens, image_ocr_output_tokens,
                    image_ocr_cost, input_cost, output_cost, total_cost, created_at
                )
                SELECT 
                    id, user_id, model_name, tokens_in, tokens_out,
                    CASE WHEN cached_input_tokens IS NULL THEN 0 ELSE cached_input_tokens END,
                    0, 0, 0.0,
                    input_cost, output_cost, total_cost, created_at
                FROM usage
            """)
            
            # 删除旧表并重命名新表
            drop_table_sql = text("DROP TABLE usage")
            rename_table_sql = text("ALTER TABLE usage_new RENAME TO usage")
            
            try:
                # 执行SQL语句
                db.session.execute(create_table_sql)
                db.session.execute(copy_data_sql)
                db.session.execute(drop_table_sql)
                db.session.execute(rename_table_sql)
                
                # 提交更改
                db.session.commit()
                print(f"成功添加列: {', '.join(missing_columns)}！")
            except Exception as e:
                db.session.rollback()
                print(f"更新数据库时出错: {str(e)}")
                raise
        else:
            print("所有需要的列都已存在，无需更新。")

if __name__ == '__main__':
    add_ocr_fields() 