# 从file_config导入附件类型配置
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType
#svg到模型类型的映射
SVG_TO_MODEL_TYPE = {
    'xai': {
        'icon_path': 'static/icons/models/xai.svg',
        'name': 'xAI'
    },
    'google': {
        'icon_path': 'static/icons/models/google.svg',
        'name': 'Gemini'
    },
    'deepseek': {
        'icon_path': 'static/icons/models/deepseek.svg',
        'name': 'DeepSeek'
    }
}
# 模型配置
AVAILABLE_MODELS = {
    'xai': {
        'models': [
            {'id': 'grok-2-latest', 'name': 'Grok 2', 'description': '最新的基础文本生成模型，支持131K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT]},
            {'id': 'grok-2-1212', 'name': 'Grok 2 1212', 'description': '基础文本生成模型，支持131K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT]},
            {'id': 'grok-2-vision-1212', 'name': 'Grok 2 Vision', 'description': '支持图像理解的多模态模型，32K上下文','available_attachments':[AttachmentType.IMAGE, AttachmentType.DOCUMENT, AttachmentType.TEXT]},
            {'id': 'grok-vision-beta', 'name': 'Grok Vision Beta', 'description': '支持图像理解的多模态模型，8K上下文','available_attachments':[AttachmentType.IMAGE, AttachmentType.DOCUMENT, AttachmentType.TEXT]},
            {'id': 'grok-beta', 'name': 'Grok Beta', 'description': '基础文本生成模型，支持131K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT]}
        ],
        'api_type': 'openai'
    },
    'google': {
        'models': [
            {'id': 'gemini-2.0-flash-exp', 'name': 'Gemini 2.0 Flash Exp', 'description': '新一代功能、卓越的速度、原生工具使用和多模态生成','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]},
            {'id': 'gemini-1.5-flash', 'name': 'Gemini 1.5 Flash', 'description': '快速、多样化的性能','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]},
            {'id': 'gemini-1.5-flash-8b', 'name': 'Gemini 1.5 Flash-8B', 'description': '量大且智能程度较低的任务','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]},
            {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro', 'description': '需要更多智能的复杂推理任务','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]},
            {'id': 'gemini-exp-1206', 'name': 'Gemini Exp 1206', 'description': '改进了编码、推理和视觉能力','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]},
            {'id': 'gemini-exp-1121', 'name': 'Gemini Exp 1121', 'description': '质量改进','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]},
            {'id': 'learnlm-1.5-pro-experimental', 'name': 'LearnLM 1.5 Pro', 'description': '支持音频、图片、视频和文本','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE]}
        ],
        'api_type': 'google'
    },
    'deepseek':{
        'models':[
            {'id':'deepseek-chat','name':'DeepSeek V3','description':'DeepSeek V3 是深度求索公司开发的智能助手，支持文本、图片、视频和音频等多种输入类型，能够处理复杂的任务和问题。','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT]}
        ],
        'api_type': 'openai'
    }
}

#速率限制
RATE_LIMIT_WINDOW = 60  # 60秒时间窗口
MAX_EMAILS_PER_WINDOW = 3  # 每个时间窗口内最多发送3封邮件

# API配置
API_KEYS = {
    'google': "AIzaSyDWQDPJdzX0pcqqfuH7QkIarCYOUyMaYrg",
    'xai': "xai-ustHuYhJfrn6mdl5Oi9lzIpDeeLkKCUqwOtynKE0IC9s0cHMw2QjSeQlYUkhq0URI5uVp8db66avB82B",
    'deepseek': "sk-6f8f1e8e2d8847559db94b51f2fa21ca"
}

API_BASE_URLS = {
    'google': "https://generativelanguage.googleapis.com/v1",
    'xai': "https://api.x.ai/v1",
    'deepseek': "https://api.deepseek.com/v1"
}