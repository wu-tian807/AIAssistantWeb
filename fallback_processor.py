def _get_statistical_features(self, text):
    """获取文本的统计特征"""
    words = text.split()
    if not words:
        return 0.0
        
    # 词长分析（使用改进的sigmoid函数）
    word_lengths = [len(word) for word in words]
    avg_length = sum(word_lengths) / len(words)
    length_score = 1 / (1 + math.exp(-2.5 * (avg_length - 7)))
    
    # 句子复杂度分析
    sentences = text.split('.')
    sentence_lengths = [len(sent.split()) for sent in sentences if sent.strip()]
    avg_sent_length = sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0
    
    # 计算从属子句数量（通过标点和关联词）
    subordinate_markers = [',', ';', 'which', 'that', 'because', 'although', 'while', 'if', 'when']
    subordinate_count = sum(1 for marker in subordinate_markers if marker in text.lower())
    
    # 复杂度得分（考虑句长和从属结构）
    complexity_base = 1 / (1 + math.exp(-5 * (avg_sent_length - 15)))
    complexity_score = (complexity_base + 0.5 * (subordinate_count / len(sentences))) / 1.5
    
    # 重复模式分析（加权版本）
    word_freq = Counter(words)
    tech_terms = set(term.lower() for term in self.nltk_service.technical_terms)
    
    # 计算技术术语的加权重复
    weighted_repetitions = 0
    for word, freq in word_freq.items():
        if word.lower() in tech_terms:
            weighted_repetitions += freq * 2.0  # 技术术语权重
        else:
            weighted_repetitions += freq
            
    # 计算2-gram和3-gram
    bigrams = list(zip(words[:-1], words))
    trigrams = list(zip(words[:-2], words[1:-1], words[2:]))
    
    # n-gram重复分析
    bigram_freq = Counter(bigrams)
    trigram_freq = Counter(trigrams)
    
    # 组合n-gram得分
    ngram_score = (
        sum(freq for freq in bigram_freq.values()) / len(bigrams) if bigrams else 0 +
        sum(freq for freq in trigram_freq.values()) / len(trigrams) if trigrams else 0
    ) / 2
    
    # 归一化重复得分
    repetition_score = (weighted_repetitions / len(words) + ngram_score) / 4
    
    # 组合所有特征
    return (length_score * 0.3 + complexity_score * 0.4 + repetition_score * 0.3) 

def get_text_features(self, text):
    """获取文本特征"""
    if not text or not text.strip():
        return TextFeatures()
        
    # 计算基础技术密度
    base_density = self._calculate_base_density(text)
    
    # 计算技术词组密度
    phrase_density = self._calculate_phrase_density(text)
    
    # 使用加权平均组合两个密度
    # 基础密度权重0.6，技术词组密度权重0.4
    technical_density = base_density * 0.6 + phrase_density * 0.4
    
    # 确保技术密度不超过1
    technical_density = min(technical_density, 1.0)
    
    return TextFeatures(
        technical_density=technical_density,
        semantic_density=self._calculate_semantic_density(text)
    )

def _calculate_base_density(self, text):
    """计算基础技术密度"""
    # 统计特征（权重0.5）
    statistical_score = self._get_statistical_features(text)
    
    # 形态特征（权重0.3）
    morphological_score = self._get_morphological_features(text)
    
    # 上下文特征（权重0.2）
    contextual_score = self._get_contextual_features(text)
    
    # 组合基础特征
    return (
        statistical_score * 0.5 +
        morphological_score * 0.3 +
        contextual_score * 0.2
    )

def _calculate_phrase_density(self, text):
    """计算技术词组密度"""
    # 获取技术词组
    tech_phrases = self._identify_tech_phrases(text)
    
    if not tech_phrases:
        return 0.0
        
    # 计算总词数
    words = text.split()
    total_words = len(words)
    
    if total_words == 0:
        return 0.0
    
    # 计算技术词组覆盖率
    covered_words = 0
    total_weight = 0
    
    for phrase, weight in tech_phrases.items():
        # 计算词组中的词数
        phrase_words = len(phrase.split())
        covered_words += phrase_words
        total_weight += weight * phrase_words
    
    # 计算加权覆盖率
    coverage_ratio = covered_words / total_words
    weight_ratio = total_weight / (2.0 * total_words)  # 使用2.0作为最大权重进行归一化
    
    # 组合覆盖率和权重比
    return (coverage_ratio + weight_ratio) / 2

def _identify_tech_phrases(self, text):
    """识别技术词组"""
    # 技术词组模式及其权重
    patterns = {
        # 核心机器学习概念 (权重2.0)
        r'machine learning': 2.0,
        r'deep learning': 2.0,
        r'neural network': 2.0,
        r'artificial intelligence': 2.0,
        r'reinforcement learning': 2.0,
        
        # 具体算法和技术 (权重1.5)
        r'gradient descent': 1.5,
        r'back propagation': 1.5,
        r'convolutional (?:neural )?network': 1.5,
        r'recurrent (?:neural )?network': 1.5,
        r'transformer(?: architecture)?': 1.5,
        r'support vector': 1.5,
        r'decision tree': 1.5,
        r'random forest': 1.5,
        
        # 技术组件和概念 (权重1.2)
        r'feature(?:s)? extract(?:ion|ing)': 1.2,
        r'pattern recognition': 1.2,
        r'supervised learning': 1.2,
        r'unsupervised learning': 1.2,
        r'statistical analysis': 1.2,
        r'data mining': 1.2,
        
        # 基础设施和系统 (权重1.0)
        r'big data': 1.0,
        r'cloud computing': 1.0,
        r'distributed system': 1.0,
        r'parallel processing': 1.0,
        
        # 数学和统计概念 (权重1.0)
        r'mathematical model': 1.0,
        r'statistical model': 1.0,
        r'probability theory': 1.0,
        r'linear algebra': 1.0,
        
        # 技术变体和组合 (权重1.2)
        r'(?:deep|machine|statistical) learning (?:algorithm|model|system)': 1.2,
        r'neural (?:network|architecture|model|system)': 1.2,
        r'(?:AI|ML|DL|NN) (?:based|driven|powered)': 1.2,
        r'(?:data|feature|pattern) (?:analysis|processing|recognition)': 1.2,
        
        # 新增：技术动词和短语 (权重1.0)
        r'optimiz(?:e|ing|ation)': 1.0,
        r'implement(?:ing|ation)?': 1.0,
        r'process(?:ing)?': 1.0,
        r'analyz(?:e|ing)': 1.0,
        r'compute?(?:ing|ation)?': 1.0
    }
    
    # 使用正则表达式查找所有匹配的技术词组
    found_phrases = {}
    for pattern, weight in patterns.items():
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            phrase = match.group()
            if phrase not in found_phrases or weight > found_phrases[phrase]:
                found_phrases[phrase] = weight
                
    return found_phrases 