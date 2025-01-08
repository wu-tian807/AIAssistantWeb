import sqlite3
import json
import time
from pathlib import Path
from initialization import app, db
from utils.image_handler import save_base64_locally, normalize_user_id
from utils.conversation_model import Conversation

def get_user_email(cursor, user_id):
    """获取用户的邮箱地址"""
    cursor.execute('SELECT email FROM user WHERE id = ?', (user_id,))
    result = cursor.fetchone()
    return result[0] if result else None

def cleanup_base64_data():
    """清理数据库中的 base64 数据，将其转换为 base64_id 引用"""
    try:
        print("正在连接数据库...")
        # 连接数据库
        db_path = Path(app.instance_path) / 'users.db'
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # 获取所有对话
        print("正在获取对话列表...")
        cursor.execute('SELECT id, user_id, messages FROM conversation')
        conversations = cursor.fetchall()

        print(f"\n=== 开始处理 {len(conversations)} 个对话 ===")
        print("每个点代表一条消息的处理，每行50个点")
        processed_count = 0
        total_base64_saved = 0
        total_thumbnails_saved = 0
        message_count = 0
        start_time = time.time()

        for conv_id, user_id, messages_json in conversations:
            try:
                # 获取用户邮箱作为存储ID
                user_email = get_user_email(cursor, user_id)
                if not user_email:
                    print(f"\n警告: 找不到用户 {user_id} 的邮箱")
                    continue
                    
                messages = json.loads(messages_json)
                modified = False
                
                # 打印对话处理开始
                normalized_email = normalize_user_id(user_email)
                print(f"\n正在处理对话 {conv_id} (用户 {normalized_email})...")
                print(f"该对话包含 {len(messages)} 条消息")

                # 处理每条消息
                for message in messages:
                    message_count += 1
                    if 'attachments' in message and message['attachments']:
                        attachment_count = len(message['attachments'])
                        print(f"发现消息包含 {attachment_count} 个附件，正在处理...", end='', flush=True)
                        
                        new_attachments = []
                        processed_attachments = 0
                        for attachment in message['attachments']:
                            if not isinstance(attachment, dict):
                                continue

                            if attachment.get('type') == 'image':
                                # 处理图片附件
                                if 'base64' in attachment:
                                    # 保存 base64 数据到文件系统
                                    base64_id = save_base64_locally(attachment['base64'], normalized_email)
                                    # 更新附件数据
                                    attachment['base64_id'] = base64_id
                                    del attachment['base64']
                                    modified = True
                                    total_base64_saved += 1
                                    print("📷", end='', flush=True)
                                else:
                                    print("🖼️", end='', flush=True)

                            elif attachment.get('type') == 'video':
                                # 处理视频附件
                                if 'thumbnail' in attachment:
                                    # 保存缩略图 base64 数据到文件系统
                                    thumbnail_base64_id = save_base64_locally(attachment['thumbnail'].split(',')[1], normalized_email)
                                    # 更新附件数据
                                    attachment['thumbnail_base64_id'] = thumbnail_base64_id
                                    del attachment['thumbnail']
                                    modified = True
                                    total_thumbnails_saved += 1
                                    print("🎥", end='', flush=True)
                                else:
                                    print("📽️", end='', flush=True)

                                # 删除不必要的 base64 数据
                                if 'base64' in attachment:
                                    del attachment['base64']
                                    modified = True

                            new_attachments.append(attachment)
                            processed_attachments += 1
                            
                        print(f" ({processed_attachments}/{attachment_count})")
                        message['attachments'] = new_attachments
                    else:
                        print(".", end='', flush=True)

                if modified:
                    # 更新数据库
                    cursor.execute(
                        'UPDATE conversation SET messages = ? WHERE id = ?',
                        (json.dumps(messages), conv_id)
                    )
                    processed_count += 1

                    # 每 10 条提交一次
                    if processed_count % 10 == 0:
                        conn.commit()
                        elapsed_time = time.time() - start_time
                        avg_time = elapsed_time / processed_count
                        remaining_count = len(conversations) - processed_count
                        estimated_remaining = avg_time * remaining_count
                        
                        print(f"\n=== 进度报告 ===")
                        print(f"已处理: {processed_count}/{len(conversations)} 个对话")
                        print(f"已处理: {message_count} 条消息")
                        print(f"已保存: {total_base64_saved} 个图片")
                        print(f"已保存: {total_thumbnails_saved} 个视频缩略图")
                        print(f"已用时: {elapsed_time:.1f} 秒")
                        print(f"预计还需: {estimated_remaining:.1f} 秒")
                        print("=" * 20)

            except json.JSONDecodeError:
                print(f"\n警告: 对话 {conv_id} 的 JSON 解析失败")
                continue
            except Exception as e:
                print(f"\n警告: 处理对话 {conv_id} 时出错: {str(e)}")
                continue

        # 最终提交
        conn.commit()
        total_time = time.time() - start_time
        
        print("\n" + "=" * 50)
        print("清理完成!")
        print(f"总耗时: {total_time:.1f} 秒")
        print(f"处理了 {processed_count}/{len(conversations)} 个对话")
        print(f"处理了 {message_count} 条消息")
        print(f"保存了 {total_base64_saved} 个图片")
        print(f"保存了 {total_thumbnails_saved} 个视频缩略图")
        print(f"平均每个对话耗时: {total_time/processed_count:.1f} 秒")
        print("=" * 50)

    except Exception as e:
        print(f"\n错误: {str(e)}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    print("正在初始化应用上下文...")
    with app.app_context():
        cleanup_base64_data() 