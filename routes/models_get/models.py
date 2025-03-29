#获取模型是否为可以调整思考力度的模型
from config import THINKING_MODELS_WITH_THINKING_DEGREE
from flask import Blueprint, jsonify, current_app

models_get_bp = Blueprint('models_get', __name__)
#获取模型是否为可以调整思考力度的模型
@models_get_bp.route('/thinking_model/<model_id>')
def is_thinking_model(model_id):
    current_app.logger.info(f"检查模型是否支持思考力度调整: {model_id}")
    result = model_id in THINKING_MODELS_WITH_THINKING_DEGREE
    current_app.logger.info(f"模型 {model_id} 支持思考力度调整: {result}")
    current_app.logger.info(f"所有支持思考力度的模型: {THINKING_MODELS_WITH_THINKING_DEGREE}")
    return jsonify({'thinking_model': result})
