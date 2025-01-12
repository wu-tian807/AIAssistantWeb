import unittest
import logging
from utils.text_attachment.language_processor.fallback_processor import FallbackProcessor

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class TestFallbackProcessor(unittest.TestCase):
    """测试FallbackProcessor的功能"""
    
    @classmethod
    def setUpClass(cls):
        """初始化处理器"""
        cls.processor = FallbackProcessor()

    def test_text_features_contrast(self):
        """测试不同类型文本的特征对比"""
        
        # 高技术密度文本样本
        tech_samples = {
            "英语技术文本1": """
            Deep learning algorithms utilize neural networks with multiple hidden layers 
            for pattern recognition. The backpropagation algorithm optimizes network weights 
            through gradient descent, while convolutional layers extract hierarchical features 
            from input data.
            """,
            
            "英语技术文本2": """
            Advanced machine learning algorithms utilize stochastic gradient descent 
            with momentum for optimization. The neural network architecture incorporates 
            batch normalization layers and dropout regularization to prevent overfitting 
            during the training process.
            """,
            
            "德语技术文本": """
            Die Künstliche Intelligenz verwendet Deep-Learning-Algorithmen und 
            neuronale Netzwerke, um komplexe Datenmuster zu analysieren und 
            Vorhersagemodelle zu entwickeln. Maschinelles Lernen ermöglicht 
            autonome Entscheidungsprozesse.
            """,
            
            "法语技术文本": """
            L'apprentissage profond utilise des réseaux de neurones multicouches 
            pour analyser les données complexes. Les algorithmes de traitement 
            du langage naturel permettent la compréhension automatique du texte.
            """
        }
        
        # 普通文本样本
        non_tech_samples = {
            "英语日常文本1": """
            I love spending weekends in my garden. The roses are blooming beautifully 
            this year, and the tomatoes are growing well. My neighbor often stops by 
            to chat about the weather and share gardening tips.
            """,
            
            "英语日常文本2": """
            We had a wonderful family dinner last night. Mom made her famous apple pie, 
            and dad told funny stories about his childhood. The kids played games 
            while we enjoyed coffee after the meal.
            """,
            
            "德语日常文本": """
            Der kleine Café an der Ecke ist ein beliebter Treffpunkt. 
            Jeden Morgen duftet es nach frischem Kaffee und hausgemachtem 
            Gebäck. Die Gäste genießen die gemütliche Atmosphäre.
            """,
            
            "法语日常文本": """
            Le petit marché du village s'anime chaque dimanche matin. 
            Les agriculteurs locaux proposent leurs fruits et légumes frais. 
            L'ambiance est toujours chaleureuse et conviviale.
            """
        }

        # 新增：混合文本样本（技术内容与日常表达混合）
        mixed_samples = {
            "英语混合文本": """
            My new smartphone uses advanced AI algorithms to enhance photo quality.
            Yesterday, I took some beautiful pictures of my garden flowers, and the 
            neural network-based image processing made them look professional.
            """,
            
            "德语混合文本": """
            Mein neues Smart-Home-System verwendet KI-gesteuerte Sensoren, um Energie zu sparen.
            Gestern hat es automatisch die Heizung reduziert, als ich das Fenster zum Lüften öffnete.
            Die intelligente Technologie macht unser Leben wirklich einfacher.
            """,
            
            "法语混合文本": """
            Mon nouveau robot aspirateur utilise l'intelligence artificielle pour cartographier la maison.
            Hier, il a nettoyé toutes les pièces de manière autonome pendant que je préparais le dîner.
            Cette technologie nous facilite vraiment la vie quotidienne.
            """
        }

        # 新增：特殊格式文本样本
        special_samples = {
            "代码混合文本": """
            To implement the neural network, use the following code:
            model = Sequential([
                Dense(128, activation='relu', input_shape=(784,)),
                Dropout(0.2),
                Dense(10, activation='softmax')
            ])
            This architecture is perfect for MNIST classification.
            """,
            
            "数学公式文本": """
            The gradient descent update rule is given by:
            θ = θ - α∇J(θ)
            where α is the learning rate and ∇J(θ) is the gradient of the cost function.
            For neural networks, we use backpropagation to compute these gradients.
            """,
            
            "引用混合文本": """
            According to Dr. Smith's research paper "Deep Learning in 2024":
            "The transformer architecture has revolutionized NLP tasks, achieving
            state-of-the-art results across multiple benchmarks." This finding
            has significant implications for future AI development.
            """
        }

        # 新增：边界情况测试
        edge_cases = {
            "超短文本": "AI ML",
            "重复文本": "Deep learning. Deep learning. Deep learning.",
            "特殊字符文本": "∑(wi * xi) + b = y → ∂E/∂w = ∂E/∂y * ∂y/∂w",
            "混合语言": "The neural network 使用 deep learning und maschinelles Lernen pour l'analyse.",
            "纯数字文本": "1234 5678 9012 3456",
            "纯符号文本": "+-*/=()[]{}><|&^%$#@",
            "空白字符文本": "   \t\n\r   ",
            "超长单词": "Pneumonoultramicroscopicsilicovolcanoconiosis is a pneumoconiosis disease.",
        }

        # 分析技术文本特征
        tech_features = {}
        for name, text in tech_samples.items():
            features = self.processor.get_text_features(text)
            tech_features[name] = features
            logging.info(f"{name} features: {vars(features)}")
            
        # 分析非技术文本特征
        non_tech_features = {}
        for name, text in non_tech_samples.items():
            features = self.processor.get_text_features(text)
            non_tech_features[name] = features
            logging.info(f"{name} features: {vars(features)}")

        # 分析混合文本特征
        mixed_features = {}
        for name, text in mixed_samples.items():
            features = self.processor.get_text_features(text)
            mixed_features[name] = features
            logging.info(f"{name} features: {vars(features)}")

        # 分析特殊格式文本特征
        special_features = {}
        for name, text in special_samples.items():
            features = self.processor.get_text_features(text)
            special_features[name] = features
            logging.info(f"{name} features: {vars(features)}")

        # 分析边界情况特征
        edge_features = {}
        for name, text in edge_cases.items():
            features = self.processor.get_text_features(text)
            edge_features[name] = features
            logging.info(f"{name} features: {vars(features)}")

        # 验证技术文本特征
        for name, features in tech_features.items():
            self.assertGreater(
                features.technical_density,
                0.35,
                f"{name} 技术密度过低"
            )
            self.assertGreater(
                features.semantic_density,
                0.4,
                f"{name} 语义密度过低"
            )

        # 验证非技术文本特征
        for name, features in non_tech_features.items():
            self.assertLess(
                features.technical_density,
                0.32,
                f"{name} 技术密度过高"
            )
            self.assertGreater(
                features.content_density,
                0.4,
                f"{name} 内容密度过低"
            )

        # 验证混合文本特征
        for name, features in mixed_features.items():
            self.assertGreater(
                features.technical_density,
                0.25,
                f"{name} 技术密度过低"
            )
            self.assertLess(
                features.technical_density,
                0.45,
                f"{name} 技术密度过高"
            )

        # 验证特殊格式文本特征
        for name, features in special_features.items():
            if "代码" in name:
                self.assertGreater(
                    features.technical_density,
                    0.4,
                    f"{name} 代码技术密度过低"
                )
            elif "数学" in name:
                self.assertGreater(
                    features.technical_density,
                    0.35,
                    f"{name} 数学技术密度过低"
                )

        # 验证边界情况特征
        self.assertLess(
            edge_features["超短文本"].semantic_density,
            0.3,
            "超短文本语义密度过高"
        )
        self.assertLess(
            edge_features["重复文本"].content_density,
            0.3,
            "重复文本内容密度过高"
        )
        self.assertGreater(
            edge_features["特殊字符文本"].technical_density,
            0.3,
            "特殊字符文本技术密度过低"
        )
        self.assertGreater(
            edge_features["混合语言"].semantic_density,
            0.3,
            "混合语言语义密度过低"
        )

        # 验证语言间的一致性
        for lang in ["英语", "德语", "法语"]:
            tech_text = next(name for name in tech_features.keys() if lang in name)
            non_tech_text = next(name for name in non_tech_features.keys() if lang in name)
            
            tech_diff = tech_features[tech_text].technical_density - non_tech_features[non_tech_text].technical_density
            self.assertGreater(
                tech_diff,
                0.2,
                f"{lang}技术文本和非技术文本的区分度不足"
            )

    def test_text_segmentation(self):
        """测试文本分割功能"""
        # 测试长文本分割
        long_text = """
        Deep learning has revolutionized artificial intelligence in recent years.
        Neural networks with multiple layers can learn complex patterns in data.
        The backpropagation algorithm enables efficient training of deep networks.
        Convolutional neural networks excel at image recognition tasks.
        Recurrent neural networks are powerful for sequential data processing.
        Transformer models have achieved remarkable results in natural language processing.
        Attention mechanisms help models focus on relevant information.
        Transfer learning allows models to leverage pre-trained knowledge.
        Regularization techniques prevent overfitting during training.
        Batch normalization improves training stability and speed.
        """
        
        chunks = self.processor.split_text(long_text)
        
        # 验证分块结果
        self.assertGreater(len(chunks), 1, "长文本应该被分成多个块")
        
        for chunk in chunks:
            # 验证每个块的结构
            self.assertIn('text', chunk, "块应该包含文本")
            self.assertIn('features', chunk, "块应该包含特征")
            self.assertIn('key_phrases', chunk, "块应该包含关键短语")
            self.assertIn('semantic_unit', chunk, "块应该包含语义单元类型")
            
            # 验证块的特征
            features = chunk['features']
            self.assertGreater(
                features.technical_density,
                0.3,
                "技术文本块的技术密度过低"
            )
            
            # 验证关键短语
            self.assertGreater(
                len(chunk['key_phrases']),
                0,
                "技术文本块应该包含关键短语"
            )

    def test_language_detection(self):
        """测试语言检测功能"""
        # 测试多语言文本
        texts = {
            "英语": "Deep learning algorithms process complex data patterns.",
            "德语": "Maschinelles Lernen revolutioniert die künstliche Intelligenz.",
            "法语": "L'apprentissage profond transforme l'intelligence artificielle.",
            "混合": "Deep learning 算法 utilise 人工智能 pour l'analyse.",
        }
        
        for name, text in texts.items():
            features = self.processor.get_text_features(text)
            self.assertIsNotNone(features, f"{name}文本特征提取失败")
            self.assertGreater(
                features.semantic_density,
                0,
                f"{name}文本语义密度异常"
            )

    def test_edge_cases(self):
        """测试边界情况"""
        edge_cases = {
            "空文本": "",
            "空格文本": "   ",
            "单字符": "x",
            "特殊字符": "©®™℠",
            "超长单词": "pneumonoultramicroscopicsilicovolcanoconiosis",
            "重复标点": "!!!???...",
            "URL": "https://www.example.com/path?param=value",
            "邮箱": "user@example.com",
            "代码片段": "def func(): return None",
        }
        
        for name, text in edge_cases.items():
            features = self.processor.get_text_features(text)
            self.assertIsNotNone(features, f"{name}特征提取失败")

    def test_text_normalization(self):
        """测试文本规范化"""
        test_cases = {
            "重复空格": "This   is    a    test",
            "混合换行": "Line 1\nLine 2\r\nLine 3",
            "重复标点": "Hello!!! World???...",
            "特殊引号": "\"quoted text\" and 'quoted text'",
            "中文标点": "这是一个「测试」。。。",
        }
        
        for name, text in test_cases.items():
            normalized = self.processor.normalize_text(text)
            self.assertIsNotNone(normalized, f"{name}规范化失败")
            self.assertNotEqual(normalized, "", f"{name}规范化结果为空")

if __name__ == '__main__':
    unittest.main() 