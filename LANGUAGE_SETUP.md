# NLTK 资源安装指南

## 自动安装

系统会在首次运行时自动下载所需的 NLTK 资源。这些资源包括：

- `punkt` - 句子分割器
- `punkt_tab` - 句子分割表格
- `averaged_perceptron_tagger` - 词性标注器
- `maxent_ne_chunker` - 命名实体识别器
- `words` - 英语词典
- `stopwords` - 停用词
- `wordnet` - 词义分析
- `maxent_ne_chunker_tab` - 命名实体识别表格
- `averaged_perceptron_tagger_eng` - 英语词性标注

## 手动安装

如果自动下载失败，您可以按照以下步骤手动安装：

1. 打开 Python 交互式终端：
```python
python
```

2. 执行以下命令：
```python
import nltk
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('averaged_perceptron_tagger')
nltk.download('maxent_ne_chunker')
nltk.download('words')
nltk.download('stopwords')
nltk.download('wordnet')
nltk.download('maxent_ne_chunker_tab')
nltk.download('averaged_perceptron_tagger_eng')
```

## 常见问题

### SSL 证书错误

如果遇到 SSL 证书错误，可以尝试以下解决方案：

```python
import ssl
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context
```

然后重新执行下载命令。

### 下载超时

如果下载超时，可以：

1. 检查网络连接
2. 使用代理服务器
3. 尝试使用 NLTK 下载器 GUI：
```python
import nltk
nltk.download()
```

### 存储路径问题

NLTK 数据默认存储在以下位置：

- Windows: `%APPDATA%\nltk_data`
- Unix/Linux: `/usr/share/nltk_data` 或 `/usr/local/share/nltk_data`
- macOS: `/usr/local/share/nltk_data`

如果需要自定义存储路径，可以设置环境变量 `NLTK_DATA`。

## 验证安装

运行以下代码验证资源是否安装成功：

```python
import nltk
nltk.data.path  # 查看 NLTK 数据路径
```

对于特定资源，可以尝试：

```python
from nltk.tokenize import word_tokenize
text = "This is a test sentence."
print(word_tokenize(text))
```

如果输出正常分词结果，说明基本功能已经可用。 