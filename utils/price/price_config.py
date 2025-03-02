###记录模型的价格（美元/百万tokens）
PRICE_CONFIG = {
    # Gemini 模型（免费）
    "gemini-2.0":{
        "input": 0,
        "output": 0
    },
    "gemini-2.0-flash-lite-preview-02-05":{
        "input": 0,
        "output": 0
    },
    "gemini-2.0-pro-exp-02-05":{
        "input": 0,
        "output": 0
    },
    "gemini-2.0-flash-thinking-exp-01-21":{
        "input": 0,
        "output": 0
    },
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
    "learnlm-1.5-pro-experimental": {
        "input": 0,
        "output": 0
    },
    
    # DeepSeek 模型
    "deepseek-chat": {
        "cached_input": 0.07,
        "input": 0.27,      # 使用未命中缓存的输入价格
        "output": 1.10      # 输出价格
    },
    "deepseek-reasoner": {
        "cached_input": 0.14,
        "input": 0.55,      # 使用未命中缓存的输入价格
        "output": 2.19      # 输出价格
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
    },
    "deepseek-ai/DeepSeek-R1":{
        "input": 0.55,
        "output": 2.19
    },
    "qwen2.5-vl-72b-instruct":{
        "input": 2.20,
        "output": 6.59
    },
    "gpt-4o-mini":{
        "input": 0.15,
        "output": 0.6
    },
    "gpt-4o":{
        "input": 2.5,
        "output": 10
    },
    "chatgpt-4o-latest":{
        "input": 5,
        "output": 15
    }
}