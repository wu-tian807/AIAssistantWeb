import asyncio
from utils.text_attachment.embeddings import TextEmbedding
import os
from pathlib import Path
import google.generativeai as genai
from config import API_KEYS

async def test_semantic_search():
    try:
        # 配置 API 密钥
        api_key = API_KEYS['google'][0]
        print(f"\nAPI密钥配置状态: {'成功' if api_key else '失败'}")
        genai.configure(api_key=api_key)
        
        # 初始化
        embedding_processor = TextEmbedding()
        base_path = "D:/WorkSpace/AI Assistant System/uploads/2212929908_qq_com"
        file_id = "1736571306916"
        
        # 验证embeddings文件是否存在
        embeddings_path = Path(base_path) / 'embeddings' / file_id
        print(f"\n检查Embeddings文件:")
        print(f"目录路径: {embeddings_path}")
        print(f"目录存在: {embeddings_path.exists()}")
        if embeddings_path.exists():
            files = list(embeddings_path.glob('*'))
            print(f"目录内文件: {[f.name for f in files]}")
        
        # 加载embeddings数据进行验证
        stored_data = embedding_processor.load_embeddings(base_path, file_id)
        if stored_data:
            print(f"\nEmbeddings数据加载成功:")
            print(f"文本块数量: {len(stored_data['chunks'])}")
            print(f"向量数量: {len(stored_data['embeddings'])}")
            print(f"元数据: {stored_data['metadata']}")
        else:
            print("\nEmbeddings数据加载失败!")
            return
        
        # 测试用例列表 - 针对全球博物馆主题的文章
        test_queries = [
            {
                "query": "卢浮宫最著名的三件镇馆之宝是什么",
                "description": "应该匹配到关于卢浮宫三大镇馆之宝的具体描述",
                "expected_keywords": ["蒙娜丽莎", "维纳斯", "胜利女神", "达·芬奇", "米洛"]
            },
            {
                "query": "故宫博物院有哪些重要的文物收藏",
                "description": "应该匹配到关于故宫博物院珍贵藏品的描述",
                "expected_keywords": ["书画", "陶瓷", "玉器", "清明上河图", "雍正行乐图", "皇家"]
            },
            {
                "query": "梵蒂冈博物馆最著名的艺术作品",
                "description": "应该匹配到关于梵蒂冈博物馆重要艺术品的描述",
                "expected_keywords": ["西斯廷", "米开朗基罗", "创世纪", "最后的审判", "拉斐尔", "雅典学派"]
            },
            {
                "query": "现代博物馆如何运用数字技术提升展览体验",
                "description": "应该匹配到关于现代博物馆数字化创新的描述",
                "expected_keywords": ["数字化", "虚拟现实", "增强现实", "三维", "互动", "体验"]
            },
            {
                "query": "大英博物馆的全球文化收藏特色",
                "description": "应该匹配到关于大英博物馆的全球性收藏描述",
                "expected_keywords": ["罗塞塔", "埃尔金", "文物", "全球", "文明", "考古"]
            },
            {
                "query": "冬宫博物馆的艺术收藏和建筑特色",
                "description": "应该匹配到关于冬宫博物馆的艺术收藏和建筑风格描述",
                "expected_keywords": ["埃尔米塔日", "俄罗斯", "巴洛克", "皇室", "装饰", "艺术"]
            },
            {
                "query": "东京国立博物馆的日本传统艺术收藏",
                "description": "应该匹配到关于东京国立博物馆日本传统艺术的描述",
                "expected_keywords": ["浮世绘", "陶瓷", "漆器", "刀剑", "佛教", "传统"]
            },
            {
                "query": "纽约大都会艺术博物馆的多元文化特色",
                "description": "应该匹配到关于大都会博物馆多元文化收藏的描述",
                "expected_keywords": ["欧洲", "亚洲", "非洲", "美洲", "梵高", "毕加索"]
            }
        ]
        
        # 执行测试
        for test_case in test_queries:
            print("\n" + "="*50)
            print(f"测试查询: {test_case['query']}")
            print(f"预期结果: {test_case['description']}")
            print(f"关键词: {', '.join(test_case['expected_keywords'])}")
            print("-"*50)
            
            try:
                results = await embedding_processor.semantic_search(
                    query=test_case['query'],
                    base_path=base_path,
                    file_id=file_id,
                    top_k=3,
                    similarity_threshold=0.6
                )
                
                if not results:
                    print("未找到匹配结果")
                    continue
                    
                print("\n搜索结果:")
                for i, result in enumerate(results, 1):
                    print(f"\n结果 #{i}")
                    print(f"相似度: {result['similarity']:.4f}")
                    if result.get('title'):
                        print(f"标题: {result['title']}")
                    
                    # 分析关键词匹配情况
                    matched_keywords = [
                        keyword for keyword in test_case['expected_keywords']
                        if keyword in result['text']
                    ]
                    print(f"匹配关键词: {', '.join(matched_keywords) if matched_keywords else '无'}")
                    print(f"关键词匹配率: {len(matched_keywords)/len(test_case['expected_keywords']):.2%}")
                    print(f"关键词匹配得分: {result.get('keyword_match_score', 0):.4f}")
                    print(f"上下文相关性得分: {result.get('context_score', 0):.4f}")
                    
                    # 显示上下文信息
                    if result.get('context'):
                        if result['context'].get('prev_title'):
                            print(f"前文标题: {result['context']['prev_title']}")
                        if result['context'].get('next_title'):
                            print(f"后文标题: {result['context']['next_title']}")
                    
                    # 显示相关上下文
                    if result.get('prev_text'):
                        print("\n前文内容:")
                        print(result['prev_text'])
                    
                    print("\n主要内容:")
                    print(result['text'])
                    
                    if result.get('next_text'):
                        print("\n后文内容:")
                        print(result['next_text'])
                    
            except Exception as e:
                print(f"搜索失败: {str(e)}")
                import traceback
                print(traceback.format_exc())
                
    except Exception as e:
        print(f"测试过程发生错误: {str(e)}")
        import traceback
        print(traceback.format_exc())

if __name__ == "__main__":
    asyncio.run(test_semantic_search()) 