from utils.text_attachment.language_detector import LanguageDetector
import json

def print_result(title: str, result):
    """格式化打印结果"""
    print("\n" + "="*50)
    print(f"测试场景：{title}")
    print("-"*50)
    if isinstance(result, dict):
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result)

def test_language_detection():
    detector = LanguageDetector()
    
    # 1. 单字符测试
    single_char_texts = {
        "中文字": "我",
        "英文字": "A",
        "日文假名": "あ",
        "韩文字": "한",
        "俄文字": "Я",
        "泰文字": "ก",
        "特殊符号": "☆",
        "数字": "1",
        "空格": " ",
        "标点": "。",
    }
    
    print("\n=== 1. 单字符测试 ===")
    for desc, text in single_char_texts.items():
        result = detector.fallback_detect(text)
        print(f"\n{desc}:")
        print(f"文本: {text}")
        print(json.dumps(result, ensure_ascii=False, indent=2))

    # 2. 混合语言边界测试
    mixed_boundary_texts = {
        "中英相连": [
            "Chinese中文English",
            "Hello世界World",
            "ABC中文DEF",
        ],
        "日英相连": [
            "Japaneseにほんご",
            "すしSushi",
            "ABCひらがなDEF",
        ],
        "多语言无空格": [
            "中文English한글にほんご",
            "HelloМир世界こんにちは",
            "테스트Test测试テスト",
        ],
        "特殊分隔符": [
            "中文|English|한글|にほんご",
            "Hello-世界-Мир-こんにちは",
            "test_测试_テスト_테스트",
        ],
    }
    
    print("\n=== 2. 混合语言边界测试 ===")
    for category, texts in mixed_boundary_texts.items():
        print(f"\n{category}:")
        for text in texts:
            # 对于混合语言文本，使用较大的窗口
            result = detector.detect(text)
            print(f"\n文本: {text}")
            print(json.dumps(result, ensure_ascii=False, indent=2))

    # 3. 特殊格式测试
    special_format_texts = {
        "重复模式": {
            "中文重复": "好好好好好好好好好好",
            "英文重复": "testtesttesttesttest",
            "混合重复": "中文English中文English",
            "标点重复": "。。。。。....",
        },
        "特殊分隔": {
            "换行分隔": "Chinese\n中文\nEnglish\n英文",
            "制表符分隔": "Chinese\t中文\tEnglish\t英文",
            "多重空格": "Chinese    中文    English    英文",
        },
        "特殊字符": {
            "HTML标签": "<div>这是中文</div><span>This is English</span>",
            "URL": "https://www.example.com/测试/テスト",
            "邮箱": "test@example.com测试@示例.com",
            "表情符号": "Hello😊你好😄こんにちは😍",
        },
    }
    
    print("\n=== 3. 特殊格式测试 ===")
    for category, texts in special_format_texts.items():
        print(f"\n{category}:")
        for desc, text in texts.items():
            result = detector.detect(text)
            print(f"\n{desc}:")
            print(f"文本: {text}")
            print(json.dumps(result, ensure_ascii=False, indent=2))

    # 4. 语言特征测试
    language_feature_texts = {
        "中文特征": {
            "繁体": "漢字檢測測試",
            "简体": "汉字检测测试",
            "数字中文": "一二三四五六七八九十",
            "中文标点": "【这是】「测试」、例子。",
        },
        "日文特征": {
            "平假名": "ひらがなのテスト",
            "片假名": "カタカナノテスト",
            "日文汉字": "漢字テスト",
            "日文标点": "「これは」『テスト』です。",
        },
        "韩文特征": {
            "谚文": "한글 테스트입니다",
            "韩文汉字": "韓國語 테스트",
            "韩文混合": "한자와 한글의 테스트",
        },
        "欧洲语言特征": {
            "德文变音": "Über München läuft äöü",
            "法文重音": "Voilà où est né café",
            "西班牙重音": "¿Cómo está usted?",
            "俄文字母": "Проверка русского языка",
        },
    }
    
    print("\n=== 4. 语言特征测试 ===")
    for category, texts in language_feature_texts.items():
        print(f"\n{category}:")
        for desc, text in texts.items():
            result = detector.detect(text)
            print(f"\n{desc}:")
            print(f"文本: {text}")
            print(json.dumps(result, ensure_ascii=False, indent=2))

    # 5. 超长文本测试
    long_texts = {
        "中文长文本": "这是一个很长的中文文本，" * 50,
        "英文长文本": "This is a very long English text. " * 50,
        "混合长文本": "这是一个Mixed Language混合语言的Long Text长文本。" * 30,
        "多语言长文本": "English中文日本語한글" * 30,
    }
    
    print("\n=== 5. 超长文本测试 ===")
    for desc, text in long_texts.items():
        result = detector.detect(text)
        print(f"\n{desc}:")
        print(f"文本长度: {len(text)}")
        print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    test_language_detection()