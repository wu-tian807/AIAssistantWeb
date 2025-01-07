from flask import Blueprint, Response, stream_with_context
import json
import queue
import threading

upload_status_bp = Blueprint('upload_status', __name__)

# 创建一个全局的状态队列
status_queue = queue.Queue()

def send_status(status_data):
    """发送状态到队列"""
    status_queue.put(status_data)

@upload_status_bp.route('/stream')
def stream_status():
    """流式传输上传状态"""
    def generate():
        while True:
            try:
                # 从队列中获取状态数据，设置超时以避免永久阻塞
                status = status_queue.get(timeout=30)
                yield f"data: {json.dumps(status)}\n\n"
            except queue.Empty:
                # 发送心跳包保持连接
                yield "data: {}\n\n"
            except Exception as e:
                print(f"状态流发送错误: {e}")
                break

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    )
