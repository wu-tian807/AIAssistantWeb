from flask import Blueprint, request, jsonify, Response
import json
from initialization import xai_client

# 创建蓝图
summary_bp = Blueprint('summary', __name__)

# 生成思考内容摘要的路由
@summary_bp.route('/generate_thinking_summary', methods=['POST'])
def generate_thinking_summary():
    try:
        data = request.get_json()
        thinking_content = data.get('thinking_content')
        model_id = data.get('model_id', 'grok-2-latest') # 默认使用grok-2模型
        
        if not thinking_content:
            return jsonify({'error': 'No thinking content provided'}), 400
            
        def generate():
            prompt = f"""请根据AI的思考内容生成一个简洁明了的摘要（不超过100个字）。
            摘要应当包含所有关键逻辑点和重要思考过程，但忽略不重要的细节和错误的思考分支。
            
            思考内容如下：
            {thinking_content}
            """
            
            for chunk in stream_chat_response_for_summary([{
                "role": "user",
                "content": prompt
            }], model_id):
                if chunk:
                    # 兼容两种前端处理方式
                    try:
                        # 使用 SSE 格式发送 JSON 数据
                        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                    except Exception as e:
                        print(f"封装摘要数据时出错: {str(e)}")
                        # 如果JSON编码失败，直接发送文本
                        yield f"data: {chunk}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        print(f"生成思考摘要时出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 辅助函数：流式输出摘要内容
def stream_chat_response_for_summary(messages, model_id='grok-2-latest'):
    # 这里根据不同模型选择不同的实现
    # 默认使用grok-2模型
    
    try:
        # 使用xai_client调用OpenAI兼容API
        if model_id.startswith('grok'):
            stream = xai_client.chat.completions.create(
                model=model_id,
                messages=messages,
                stream=True
            )
            
            for chunk in stream:
                # 正确处理OpenAI API的响应格式
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        yield delta.content
                    
        # 如果需要添加其他模型的支持，可以在这里添加
                    
    except Exception as e:
        print(f"流式输出摘要内容时出错: {str(e)}")
        yield f"生成摘要时出错: {str(e)}" 