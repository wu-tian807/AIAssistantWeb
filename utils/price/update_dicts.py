import logging
from dict_updater import DictUpdater

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main():
    updater = DictUpdater()
    
    # 科技领域
    tech_categories = ["人工智能", "深度学习", "机器学习", "自然语言处理", 
                      "计算机科学", "软件工程", "云计算", "大数据", "区块链"]
                      
    # 数学领域
    math_categories = ["数学", "代数学", "几何学", "微积分", "统计学", 
                      "概率论", "拓扑学", "数论"]
                      
    # 物理领域
    physics_categories = ["物理学", "力学", "热学", "光学", "电磁学", 
                         "量子力学", "相对论", "粒子物理学"]
                         
    # 生活领域
    life_categories = ["互联网", "电子商务", "社交媒体", "移动支付",
                      "智能家居", "在线教育", "数字生活"]

    # 新增：艺术文化领域
    art_categories = ["艺术", "绘画", "雕塑", "建筑", "音乐", "舞蹈", 
                     "戏剧", "摄影", "书法", "陶瓷艺术"]

    # 新增：博物馆和文物领域
    museum_categories = ["博物馆", "文物保护", "考古学", "文化遗产",
                        "古代文明", "古代艺术", "文物修复", "博物馆学",
                        "展览策划", "文物鉴定"]

    # 新增：世界文明史领域
    civilization_categories = ["古埃及文明", "古希腊文明", "古罗马文明",
                             "中华文明", "玛雅文明", "印度文明",
                             "波斯文明", "美索不达米亚文明"]

    # 新增：文物类型
    artifact_categories = ["青铜器", "陶器", "瓷器", "玉器", "石器",
                         "金银器", "漆器", "织物", "壁画", "古籍",
                         "甲骨文", "石刻", "钱币"]
    
    # 新增：多语言专业术语
    japanese_terms = {
        "tech": ["人工知能", "機械学習", "深層学習", "自然言語処理",
                "コンピュータサイエンス", "ソフトウェア工学"],
        "science": ["数学", "物理学", "化学", "生物学",
                   "統計学", "確率論", "幾何学"],
        "culture": ["美術", "建築", "音楽", "舞踊", "演劇", "写真",
                   "書道", "陶芸", "博物館学"]
    }
    
    korean_terms = {
        "tech": ["인공지능", "기계학습", "심층학습", "자연어처리",
                "컴퓨터과학", "소프트웨어공학"],
        "science": ["수학", "물리학", "화학", "생물학",
                   "통계학", "확률론", "기하학"],
        "culture": ["미술", "건축", "음악", "무용", "연극", "사진",
                   "서예", "도예", "박물관학"]
    }
    
    thai_terms = {
        "tech": ["ปัญญาประดิษฐ์", "การเรียนรู้ของเครื่อง", "การเรียนรู้เชิงลึก",
                "การประมวลผลภาษาธรรมชาติ", "วิทยาการคอมพิวเตอร์"],
        "science": ["คณิตศาสตร์", "ฟิสิกส์", "เคมี", "ชีววิทยา",
                   "สถิติ", "ความน่าจะเป็น", "เรขาคณิต"],
        "culture": ["ศิลปะ", "สถาปัตยกรรม", "ดนตรี", "นาฏศิลป์",
                   "การละคร", "การถ่ายภาพ", "พิพิธภัณฑ์วิทยา"]
    }

    # 新增：西方语言专业术语
    english_terms = {
        "tech": ["artificial intelligence", "machine learning", "deep learning",
                "natural language processing", "computer science", "software engineering",
                "cloud computing", "big data", "blockchain"],
        "science": ["mathematics", "physics", "chemistry", "biology",
                   "statistics", "probability", "geometry", "algebra"],
        "culture": ["art", "architecture", "music", "dance", "theatre",
                   "photography", "calligraphy", "ceramics", "museology"]
    }
    
    french_terms = {
        "tech": ["intelligence artificielle", "apprentissage automatique",
                "apprentissage profond", "traitement du langage naturel",
                "informatique", "génie logiciel", "cloud computing",
                "big data", "blockchain"],
        "science": ["mathématiques", "physique", "chimie", "biologie",
                   "statistiques", "probabilités", "géométrie"],
        "culture": ["art", "architecture", "musique", "danse", "théâtre",
                   "photographie", "calligraphie", "céramique", "muséologie"]
    }
    
    german_terms = {
        "tech": ["Künstliche Intelligenz", "Maschinelles Lernen", "Deep Learning",
                "Natürliche Sprachverarbeitung", "Informatik", "Software Engineering",
                "Cloud Computing", "Big Data", "Blockchain"],
        "science": ["Mathematik", "Physik", "Chemie", "Biologie",
                   "Statistik", "Wahrscheinlichkeitstheorie", "Geometrie"],
        "culture": ["Kunst", "Architektur", "Musik", "Tanz", "Theater",
                   "Fotografie", "Kalligraphie", "Keramik", "Museologie"]
    }
    
    spanish_terms = {
        "tech": ["inteligencia artificial", "aprendizaje automático",
                "aprendizaje profundo", "procesamiento del lenguaje natural",
                "informática", "ingeniería de software", "computación en la nube",
                "big data", "blockchain"],
        "science": ["matemáticas", "física", "química", "biología",
                   "estadística", "probabilidad", "geometría"],
        "culture": ["arte", "arquitectura", "música", "danza", "teatro",
                   "fotografía", "caligrafía", "cerámica", "museología"]
    }
    
    italian_terms = {
        "tech": ["intelligenza artificiale", "apprendimento automatico",
                "apprendimento profondo", "elaborazione del linguaggio naturale",
                "informatica", "ingegneria del software", "cloud computing",
                "big data", "blockchain"],
        "science": ["matematica", "fisica", "chimica", "biologia",
                   "statistica", "probabilità", "geometria"],
        "culture": ["arte", "architettura", "musica", "danza", "teatro",
                   "fotografia", "calligrafia", "ceramica", "museologia"]
    }

    # 从维基百科抓取各个领域词条
    all_categories = (tech_categories + math_categories + physics_categories + 
                     life_categories + art_categories + museum_categories + 
                     civilization_categories + artifact_categories)

    # 从维基百科抓取（中文）
    for category in all_categories:
        terms = updater.update_from_wiki(category, max_terms=200)
        if terms:
            updater.save_to_dict(terms, f"wiki_zh_{category}")
            
    # 从百度百科抓取（中文）
    for keyword in all_categories:
        print("抓取百度百科")
        terms = updater.update_from_baidu(keyword, max_terms=100)
        if terms:
            updater.save_to_dict(terms, f"baidu_zh_{keyword}")
            
    # 从日语维基百科抓取
    for category_dict in japanese_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='ja', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_ja_{category}")
                
    # 从韩语维基百科抓取
    for category_dict in korean_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='ko', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_ko_{category}")
                
    # 从泰语维基百科抓取
    for category_dict in thai_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='th', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_th_{category}")

    # 从英语维基百科抓取
    for category_dict in english_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='en', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_en_{category}")

    # 从法语维基百科抓取
    for category_dict in french_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='fr', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_fr_{category}")

    # 从德语维基百科抓取
    for category_dict in german_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='de', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_de_{category}")

    # 从西班牙语维基百科抓取
    for category_dict in spanish_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='es', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_es_{category}")

    # 从意大利语维基百科抓取
    for category_dict in italian_terms.values():
        for category in category_dict:
            terms = updater.update_from_wiki(category, lang='it', max_terms=100)
            if terms:
                updater.save_to_dict(terms, f"wiki_it_{category}")
    
    # 合并所有词典
    updater.merge_dicts()
    
if __name__ == "__main__":
    main() 