# 获取模型图标路径
from flask import Blueprint, jsonify
from config import SVG_TO_MODEL_TYPE

model_icons_bp = Blueprint('model_icons', __name__)

@model_icons_bp.route('/icons')
def get_model_icons():
    """
    获取所有模型的图标路径
    返回格式：{
        'model_type': {
            'icon_path': '路径',
            'name': '名称'
        }
    }
    """
    return jsonify(SVG_TO_MODEL_TYPE)

@model_icons_bp.route('/icon/<model_type>')
def get_model_icon(model_type):
    """
    获取指定模型类型的图标路径
    :param model_type: 模型类型，如xai, google等
    :return: 该类型的图标信息
    """
    if model_type in SVG_TO_MODEL_TYPE:
        return jsonify(SVG_TO_MODEL_TYPE[model_type])
    else:
        return jsonify({"error": f"未找到{model_type}的图标信息"}), 404 