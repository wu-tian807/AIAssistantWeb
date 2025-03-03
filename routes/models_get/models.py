#获取模型是否为可以调整思考力度的模型
from config import THINKING_MODELS_WITH_THINKING_DEGREE
from flask import Blueprint, jsonify

models_get_bp = Blueprint('models_get', __name__)
#获取模型是否为可以调整思考力度的模型
@models_get_bp.route('/thinking_model/<model_id>')
def is_thinking_model(model_id):
    return jsonify({'thinking_model': model_id in THINKING_MODELS_WITH_THINKING_DEGREE})
