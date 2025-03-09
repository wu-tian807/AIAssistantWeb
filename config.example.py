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
    },
    'siliconcloud':{
        'icon_path': 'static/icons/models/siliconcloud.svg',
        'name': 'SiliconCloud'
    },
    'oaipro':{
        'icon_path': 'static/icons/models/oaipro.svg',
        'name': 'OAIPro'
    }
}
# 模型配置
AVAILABLE_MODELS = {
    'xai': {
        'models': [
            {'id': 'grok-2-latest', 'name': 'Grok 2', 'description': '最新的基础文本生成模型，支持131K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':12000},
            {'id': 'grok-2-1212', 'name': 'Grok 2 1212', 'description': '基础文本生成模型，支持131K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':12000},
            {'id': 'grok-2-vision-1212', 'name': 'Grok 2 Vision', 'description': '支持图像理解的多模态模型，32K上下文','available_attachments':[AttachmentType.IMAGE, AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':4000},
            {'id': 'grok-vision-beta', 'name': 'Grok Vision Beta', 'description': '支持图像理解的多模态模型，8K上下文','available_attachments':[AttachmentType.IMAGE, AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':1200},
            {'id': 'grok-beta', 'name': 'Grok Beta', 'description': '基础文本生成模型，支持131K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':12000}
        ],
        'api_type': 'openai'
    },
    'google': {
        'models': [
            {'id': 'gemini-2.0-flash-001', 'name': 'Gemini 2.0 Flash', 'description': '新一代功能、速度和多模态生成，适用于各种各样的任务','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens': 16384 },
            {'id': 'gemini-2.0-flash-lite-preview-02-05','name':'Gemini 2.0 Flash Lite Preview','description':'新一代功能、速度和多模态生成，适用于各种各样的任务','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens': 16384 },
            {'id': 'gemini-2.0-pro-exp-02-05','name':'Gemini 2.0 Pro Exp','description':'质量有所提升，尤其是对于世界知识、代码和长篇幅上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens': 32768 },
            {'id': 'gemini-2.0-flash-thinking-exp-01-21','name':'Gemini 2.0 Flash Thinking Exp','description':'针对复杂问题进行推理，具备新的思考能力','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens': 16384 ,'reasoner':True},
            {'id': 'gemini-2.0-flash-exp', 'name': 'Gemini 2.0 Flash Exp', 'description': '新一代功能、卓越的速度、原生工具使用和多模态生成','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens': 15000 },
            {'id': 'gemini-1.5-flash', 'name': 'Gemini 1.5 Flash', 'description': '快速、多样化的性能','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens':15000},
            {'id': 'gemini-1.5-flash-8b', 'name': 'Gemini 1.5 Flash-8B', 'description': '量大且智能程度较低的任务','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens':15000},
            {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro', 'description': '需要更多智能的复杂推理任务','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens':30000},
            {'id': 'learnlm-1.5-pro-experimental', 'name': 'LearnLM 1.5 Pro', 'description': '支持音频、图片、视频和文本','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.GEMINI_VIDEO, AttachmentType.IMAGE],'max_output_tokens':4000}
        ],
        'api_type': 'google'
    },
    'deepseek':{
        'models':[
            {'id':'deepseek-chat','name':'DeepSeek V3','description':'DeepSeek V3 是深度求索公司开发的智能助手，支持文本输入，64K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':8192},#8k
            {'id':'deepseek-reasoner','name':'DeepSeek R1','description':'性能对标 OpenAI o1 正式版的推理模型，支持文本输入，64K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':8192,'reasoner':True}
        ],
        'api_type': 'openai'
    },
    'siliconcloud':{
        'models':[
            {'id':'deepseek-ai/DeepSeek-R1','name':'DeepSeek R1','description':'硅基流动部署的DeepSeekR1','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT],'max_output_tokens':8192,'reasoner':True}
        ],
        'api_type':'openai'
    },
    'oaipro':{
        'models':[
            {'id':'gpt-4o-mini','name':'GPT4o Mini','description':'OpenAI的最快速的模型，支持128K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.IMAGE],'max_output_tokens':16000},
            {'id':'gpt-4o','name':'GPT4o','description':'OpenAI的旗舰模型，支持128K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.IMAGE],'max_output_tokens':25000},
            {'id':'chatgpt-4o-latest','name':'ChatGPT4o','description':'OpenAI最新的ChatGPT4o，支持128K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.IMAGE],'max_output_tokens':25000},
            {'id':'o1','name':'OpenAI o1','description':'OpenAI的高性能推理模型，支持200K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.IMAGE],'max_output_tokens':100000,'reasoner':True},
            {'id':'o3-mini','name':'OpenAI o3-mini','description':'OpenAI新一代，支持200K上下文','available_attachments':[AttachmentType.DOCUMENT, AttachmentType.TEXT, AttachmentType.IMAGE],'max_output_tokens':100000,'reasoner':True}
        ],
        'api_type':'openai'
    }
}
#思考模型但是不会返回思考内容的模型
THINKING_MODELS_WITHOUT_CONTENT = ['o1','gemini-2.0-flash-thinking-exp-01-21','o3-mini']
#思考模型可以调整思考力度的模型
THINKING_MODELS_WITH_THINKING_DEGREE = ['o1','o3-mini']

#速率限制
RATE_LIMIT_WINDOW = 60  # 60秒时间窗口
MAX_EMAILS_PER_WINDOW = 3  # 每个时间窗口内最多发送3封邮件

#设置AliYun API用于Qwen2.5VL模型，用于增强型OCR（计价）
# API配置
API_KEYS = {
    'google': ["API_KEY_1"],
    'xai': ["API_KEY_2"],
    'deepseek': ["API_KEY_3"],
    'siliconcloud':["API_KEY_4"],
    'aliyun': ["API_KEY_5"],
    'oaipro': ["API_KEY_6"]
}

API_BASE_URLS = {
    'google': "https://generativelanguage.googleapis.com/v1",
    'xai': "https://api.x.ai/v1",
    'deepseek': "https://api.deepseek.com/v1",
    'siliconcloud': "https://api.siliconflow.cn/v1",
    'aliyun': "https://dashscope.aliyuncs.com/compatible-mode/v1",
    'oaipro': 'https://api.oaipro.com/v1'
}

#文字+latex公式图像ocr API和网址
#感谢https://simpletex.cn
OCR_API_KEY = "E1QcpnpmEPMNztTTy8tLkNVtKXJCB5nPOHrz1z1KQXNCDuvuMdIcshdPyN2BmJBS"
# OCR_TURBO_LATEX_API_URL = "https://server.simpletex.cn/api/latex_ocr_turbo" #轻量级图像提取公式
# OCR_STANDARD_LATEX_API_URL = "https://server.simpletex.cn/api/latex_ocr" #标准图像提取公式
OCR_COMMON_API_URL = "https://server.simpletex.cn/api/simpletex_ocr" #通用图像提取