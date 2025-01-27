###记录模型的价格（美元/百万tokens）
PRICE_CONFIG = {
    # Gemini 模型（免费）
    "gemini-2.0-flash-exp": {
        "input": 0,
        "output": 0
    },
    "gemini-1.5-flash": {
        "input": 0,
        "output": 0
    },
    "gemini-1.5-flash-8b": {
        "input": 0,
        "output": 0
    },
    "gemini-1.5-pro": {
        "input": 0,
        "output": 0
    },
    "gemini-exp-1206": {
        "input": 0,
        "output": 0
    },
    "gemini-exp-1121": {
        "input": 0,
        "output": 0
    },
    "learnlm-1.5-pro-experimental": {
        "input": 0,
        "output": 0
    },
    
    # DeepSeek 模型
    "deepseek-chat": {
        "input": 0.27,      # 使用未命中缓存的输入价格
        "output": 1.10      # 输出价格
    },

    # Grok 模型
    "grok-beta": {
        "input": 5.00,      # 文本输入价格
        "output": 15.00     # 文本输出价格
    },
    "grok-vision-beta": {
        "input": 5.00,      # 文本和图像输入价格
        "output": 15.00     # 文本输出价格
    },
    "grok-2-vision-1212": {
        "input": 2.00,      # 文本和图像输入价格
        "output": 10.00     # 文本输出价格
    },
    "grok-2-1212": {
        "input": 2.00,      # 文本输入价格
        "output": 10.00     # 文本输出价格
    },
    "grok-2": {            # 与 grok-2-1212 相同
        "input": 2.00,
        "output": 10.00
    },
    "grok-2-latest": {     # 与 grok-2-1212 相同
        "input": 2.00,
        "output": 10.00
    }
}