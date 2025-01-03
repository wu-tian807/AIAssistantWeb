# 支持的附件类型定义
ATTACHMENT_TYPES = {
    'images': {
        'name': '图片',
        'extensions': ['.jpg', '.jpeg', '.png', '.webp','.heic','.heif'],
        'mime_types': ['image/jpeg', 'image/png', 'image/webp','image/heic','image/heif'],
        'max_size': 20 * 1024 * 1024  # 20MB
    },
    'documents': {
        'name': '文档',
        'extensions': ['.pdf', '.doc', '.docx'],
        'mime_types': ['application/pdf', 
                      'application/msword', 
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'max_size': 50 * 1024 * 1024  # 50MB
    },
    'text':{
        'name': '文本',
        'extensions':['.txt', '.md'],
        'mime_types':['text/plain', 'text/markdown']
    },
    'audio': {
        'name': '音频',
        'extensions': ['.mp3', '.wav', '.m4a', '.ogg'],
        'mime_types': ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/ogg'],
        'max_size': 100 * 1024 * 1024  # 100MB
    },
    'gemini_original_video': {
        'name': '视频', 
        'extensions': ['.mp4', '.mpeg', '.mov', '.avi', '.flv', '.mpg', '.webm', '.wmv', '.3gp'],
        'mime_types': [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',     # .mov
            'video/x-msvideo',     # .avi
            'video/x-flv',         # .flv
            'video/mpg',
            'video/webm',
            'video/x-ms-wmv',      # .wmv
            'video/3gpp'           # .3gp
        ],
        'max_size': 500 * 1024 * 1024  # 500MB
    }
}
# 模型配置
AVAILABLE_MODELS = {
    'xai': {
        'models': [
            {'id': 'grok-2-latest', 'name': 'Grok 2', 'description': '最新的基础文本生成模型，支持131K上下文','available_attachments':['documents','text']},
            {'id': 'grok-2-1212', 'name': 'Grok 2 1212', 'description': '基础文本生成模型，支持131K上下文','available_attachments':['documents','text']},
            {'id': 'grok-2-vision-1212', 'name': 'Grok 2 Vision', 'description': '支持图像理解的多模态模型，32K上下文','available_attachments':['images','documents','text']},
            {'id': 'grok-vision-beta', 'name': 'Grok Vision Beta', 'description': '支持图像理解的多模态模型，8K上下文','available_attachments':['images','documents','text']},
            {'id': 'grok-beta', 'name': 'Grok Beta', 'description': '基础文本生成模型，支持131K上下文','available_attachments':['documents','text']}
        ],
        'api_type': 'openai'
    },
    'google': {
        'models': [
            {'id': 'gemini-2.0-flash-exp', 'name': 'Gemini 2.0 Flash Exp', 'description': '新一代功能、卓越的速度、原生工具使用和多模态生成','available_attachments':['documents','text','gemini_original_video','images']},
            {'id': 'gemini-1.5-flash', 'name': 'Gemini 1.5 Flash', 'description': '快速、多样化的性能','available_attachments':['documents','text','gemini_original_video','images']},
            {'id': 'gemini-1.5-flash-8b', 'name': 'Gemini 1.5 Flash-8B', 'description': '量大且智能程度较低的任务','available_attachments':['documents','text','gemini_original_video','images']},
            {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro', 'description': '需要更多智能的复杂推理任务','available_attachments':['documents','text','gemini_original_video','images']},
            {'id': 'gemini-exp-1206', 'name': 'Gemini Exp 1206', 'description': '改进了编码、推理和视觉能力','available_attachments':['documents','text','gemini_original_video','images']},
            {'id': 'gemini-exp-1121', 'name': 'Gemini Exp 1121', 'description': '质量改进','available_attachments':['documents','text','gemini_original_video','images']},
            {'id': 'learnlm-1.5-pro-experimental', 'name': 'LearnLM 1.5 Pro', 'description': '支持音频、图片、视频和文本','available_attachments':['documents','text','gemini_original_video','images']}
        ],
        'api_type': 'google'
    }
}
#速率限制
RATE_LIMIT_WINDOW = 60  # 60秒时间窗口
MAX_EMAILS_PER_WINDOW = 3  # 每个时间窗口内最多发送3封邮件

# API配置
API_KEYS = {
    'google': "AIzaSyBZmhlArtzyz0r8yR3FXMr37614-OzI1RU",
    'xai': "xai-ustHuYhJfrn6mdl5Oi9lzIpDeeLkKCUqwOtynKE0IC9s0cHMw2QjSeQlYUkhq0URI5uVp8db66avB82B"
}

API_BASE_URLS = {
    'google': "https://generativelanguage.googleapis.com/v1beta/openai/",
    'xai': "https://api.x.ai/v1"
}