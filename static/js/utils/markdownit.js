export function initMarkdownit() {
    let md = window.markdownit({
        html: true,          // 允许 HTML 标签
        linkify: true,       // 自动转换 URL 为链接
        typographer: true,   // 启用排版功能
        // 代码高亮配置
        highlight: function (str, lang) {
            return `<div class="code-block-wrapper">
                <div class="code-block-header">
                    <span>${lang || '代码'}</span>
                    <button class="copy-button" onclick="copyCode(this)" data-action="copy">复制代码</button>
                </div>
                <pre><code class="language-${lang || 'plaintext'}">${md.utils.escapeHtml(str)}</code></pre>
            </div>`;
        }
    });

    // 统一列表渲染规则
    const customListRender = (tokens, idx, options, env, type) => {
        return `<${type} class="custom-list">`;
    };

    md.renderer.rules.bullet_list_open = function(tokens, idx, options, env) {
        return customListRender(tokens, idx, options, env, 'ul');
    };

    md.renderer.rules.ordered_list_open = function(tokens, idx, options, env) {
        return customListRender(tokens, idx, options, env, 'ol');
    };

    // 重写列表项渲染规则
    md.renderer.rules.list_item_open = function(tokens, idx, options, env) {
        return '<li class="custom-list-item">';
    };

    md.renderer.rules.paragraph_open = function(tokens, idx, options, env) {
        // 检查是否在列表项内部
        let isInListItem = false;
        for (let i = idx; i >= 0; i--) {
            if (tokens[i].type === 'list_item_open') {
                isInListItem = true;
                break;
            }
            if (tokens[i].type === 'list_item_close') {
                break;
            }
        }
        
        // 如果在列表项内，使用span而不是p
        if (isInListItem) {
            return '<span class="list-item-content">';
        }
        return '<p>';
    };

    md.renderer.rules.paragraph_close = function(tokens, idx, options, env) {
        // 检查是否在列表项内部
        let isInListItem = false;
        for (let i = idx; i >= 0; i--) {
            if (tokens[i].type === 'list_item_open') {
                isInListItem = true;
                break;
            }
            if (tokens[i].type === 'list_item_close') {
                break;
            }
        }
        
        // 如果在列表项内，关闭span而不是p
        if (isInListItem) {
            return '</span>';
        }
        return '</p>';
    };

    // 添加 LaTeX 数学公式支持
    md.use(window.texmath, {
        engine: katex,
        delimiters: 'dollars',
        katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
    });

    return md;
}

// 应用代码高亮的函数
export function applyCodeHighlight(container) {
    container.querySelectorAll('.code-block-wrapper pre code').forEach((block) => {
        // 获取语言类名
        const langClass = Array.from(block.classList)
            .find(className => className.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : '';
        
        // 保持原有的语言类名
        if (lang && lang !== 'plaintext') {
            block.className = `hljs language-${lang}`;
        } else {
            block.className = 'hljs';
        }
        
        // 应用高亮
        try {
            hljs.highlightElement(block);
        } catch (e) {
            console.warn('Code highlighting failed:', e);
            // 如果高亮失败，至少确保基本样式
            block.className = 'hljs';
        }
    });
}

// 添加代码高亮和复制功能的初始化函数
export function initializeCodeBlocks(container) {
    // 应用代码高亮
    applyCodeHighlight(container);
    
    // 添加复制按钮事件监听
    container.querySelectorAll('.code-block-header .copy-button[data-action="copy"]').forEach(button => {
        // 如果已经有 onclick 属性，就不需要再添加事件监听
        if (button.hasAttribute('onclick')) {
            return;
        }
        
        // 移除可能的旧事件监听器
        button.removeAttribute('onclick');
        
        // 添加新的事件监听
        button.addEventListener('click', function() {
            // 调用全局 copyCode 函数
            window.copyCode(this);
        });
    });
}

/**
 * HTML转Markdown函数
 * 将HTML内容转换为Markdown格式
 * @param {string} html - 要转换的HTML内容
 * @return {string} 转换后的Markdown文本
 */
export function html2Markdown(html) {
    // 缓存机制，避免重复转换相同内容
    if (!window._markdownCache) {
        window._markdownCache = new Map();
    }
    
    // 计算内容的唯一标识（可以是内容的哈希值）
    const contentHash = hashString(html);
    
    // 检查缓存中是否已存在转换结果
    if (window._markdownCache.has(contentHash)) {
        console.log('使用HTML转Markdown缓存结果');
        return window._markdownCache.get(contentHash);
    }
    
    console.log('开始HTML转Markdown转换');
    
    // 创建一个临时容器
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 处理代码块
    const codeBlocks = tempDiv.querySelectorAll('.code-block-wrapper');
    codeBlocks.forEach(block => {
        const codeElement = block.querySelector('code');
        const langSpan = block.querySelector('.code-block-header span');
        let lang = langSpan ? langSpan.textContent : '';
        const code = codeElement ? codeElement.textContent : '';
        
        // 规范化语言标识，去除"代码"文本
        if (lang === '代码') {
            lang = 'text';
        }
        
        // 检查代码内容是否已经去除了前后空白
        const trimmedCode = code.trim();
        
        // 创建markdown格式的代码块
        const markdownCodeBlock = `\`\`\`${lang}\n${trimmedCode}\n\`\`\``;
        
        // 替换原HTML代码块
        const replacement = document.createElement('div');
        replacement.setAttribute('data-markdown', markdownCodeBlock);
        replacement.style.display = 'none';
        block.parentNode.replaceChild(replacement, block);
    });
    
    // 处理<eq>标签包裹的行内公式
    const eqTags = tempDiv.querySelectorAll('eq');
    eqTags.forEach(eqTag => {
        // 查找KaTeX元素
        const katexElement = eqTag.querySelector('.katex');
        if (!katexElement) return;
        
        // 查找annotation元素获取原始LaTeX
        const annotation = eqTag.querySelector('annotation[encoding="application/x-tex"]');
        if (!annotation) return;
        
        const latex = annotation.textContent || '';
        if (!latex.trim()) return;
        
        // 创建行内公式的Markdown表示
        const markdown = `$${latex}$`;
        
        // 创建替换元素
        const replacement = document.createElement('span');
        replacement.setAttribute('data-markdown', markdown);
        
        // 替换原eq标签
        eqTag.parentNode.replaceChild(replacement, eqTag);
    });
    
    // 处理LaTeX公式
    const mathElements = tempDiv.querySelectorAll('.katex-mathml');
    mathElements.forEach(mathElement => {
        // 查找annotation元素，它包含原始的LaTeX代码
        const annotation = mathElement.querySelector('annotation[encoding="application/x-tex"]');
        if (!annotation) return;
        
        const latex = annotation.textContent || '';
        if (!latex.trim()) return;
        
        // 判断是否是align环境的多行公式
        let markdown;
        if (latex.includes('\\begin{align}') && latex.includes('\\end{align}')) {
            // 对于align环境的多行公式，保留原格式并使用$$环境
            markdown = `$$\n${latex}\n$$`;
        } else if (latex.includes('\\begin{') && latex.includes('\\end{')) {
            // 处理其他环境的公式（如matrix, cases等）
            markdown = `$$\n${latex}\n$$`;
        } else {
            // 对于行内公式，使用单个$
            const isDisplayMode = mathElement.closest('.katex-display') !== null;
            markdown = isDisplayMode ? `$$${latex}$$` : `$${latex}$`;
        }
        
        // 创建替换元素
        const replacement = document.createElement('div');
        replacement.setAttribute('data-markdown', markdown);
        
        // 根据公式类型决定是否显示为块级元素
        if (markdown.startsWith('$$\n')) {
            replacement.style.display = 'none';
            // 替换整个公式块
            const mathBlock = mathElement.closest('section') || mathElement.closest('.katex-display') || mathElement;
            if (mathBlock.parentNode) {
                mathBlock.parentNode.replaceChild(replacement, mathBlock);
            }
        } else {
            // 替换行内公式
            const mathInline = mathElement.closest('eq') || mathElement.closest('.katex') || mathElement;
            if (mathInline.parentNode) {
                mathInline.parentNode.replaceChild(replacement, mathInline);
            }
        }
    });
    
    // 特别处理section>eqn结构的公式块
    const sectionEqns = tempDiv.querySelectorAll('section > eqn');
    sectionEqns.forEach(eqn => {
        const katexDisplay = eqn.querySelector('.katex-display');
        if (!katexDisplay) return;
        
        const annotation = katexDisplay.querySelector('annotation[encoding="application/x-tex"]');
        if (!annotation) return;
        
        const latex = annotation.textContent || '';
        if (!latex.trim()) return;
        
        // 确定是否需要保留原始公式的换行格式
        let markdown;
        if (latex.includes('\\begin{align}') || latex.includes('\\begin{equation}') || 
            latex.includes('\\begin{cases}') || latex.includes('\\begin{pmatrix}')) {
            // 保留换行和原始格式
            markdown = `$$\n${latex}\n$$`;
        } else {
            markdown = `$$${latex}$$`;
        }
        
        const replacement = document.createElement('div');
        replacement.setAttribute('data-markdown', markdown);
        replacement.style.display = 'none';
        
        // 替换整个section元素
        const section = eqn.parentNode;
        if (section && section.tagName === 'SECTION' && section.parentNode) {
            section.parentNode.replaceChild(replacement, section);
        }
    });
    
    // 处理嵌套在段落中的独立公式块
    const paragraphEqns = tempDiv.querySelectorAll('p > .katex-display, p > eqn, p > section > eqn');
    paragraphEqns.forEach(eqn => {
        // 找到公式的annotation元素
        const annotation = eqn.querySelector('annotation[encoding="application/x-tex"]');
        if (!annotation) return;
        
        const latex = annotation.textContent || '';
        if (!latex.trim()) return;
        
        // 确定适当的Markdown格式
        let markdown;
        if (latex.includes('\\begin{') && latex.includes('\\end{')) {
            markdown = `$$\n${latex}\n$$`;
        } else {
            markdown = `$$${latex}$$`;
        }
        
        // 创建替换元素
        const replacement = document.createElement('div');
        replacement.setAttribute('data-markdown', markdown);
        replacement.style.display = 'none';
        
        // 根据嵌套情况选择要替换的元素
        let elementToReplace = eqn;
        if (eqn.parentNode.tagName === 'EQN' && eqn.parentNode.parentNode.tagName === 'SECTION') {
            elementToReplace = eqn.parentNode.parentNode; // section>eqn结构
        } else if (eqn.parentNode.tagName === 'SECTION') {
            elementToReplace = eqn.parentNode; // section元素
        }
        
        // 执行替换
        if (elementToReplace.parentNode) {
            elementToReplace.parentNode.replaceChild(replacement, elementToReplace);
        }
    });
    
    // 处理可能包含LaTeX公式的data-markdown属性
    const latexSpans = tempDiv.querySelectorAll('span[data-markdown]');
    latexSpans.forEach(span => {
        const markdown = span.getAttribute('data-markdown');
        if (!markdown) return;
        
        // 检查是否是LaTeX公式
        if ((markdown.startsWith('$') && markdown.endsWith('$')) || 
            markdown.includes('\\begin{') || markdown.includes('\\end{')) {
            
            // 处理多行公式，确保保留换行
            let processedMarkdown = markdown;
            
            // 如果是多行公式且未被$$包裹，则添加包裹
            if ((markdown.includes('\\begin{align}') || 
                 markdown.includes('\\begin{equation}') || 
                 markdown.includes('\\begin{cases}') || 
                 markdown.includes('\\begin{pmatrix}')) && 
                !markdown.startsWith('$$')) {
                processedMarkdown = `$$\n${markdown}\n$$`;
            }
            
            // 创建正确的替换元素
            const replacement = document.createElement(processedMarkdown.includes('\n') ? 'div' : 'span');
            replacement.setAttribute('data-markdown', processedMarkdown);
            
            // 如果是块级公式，设置为块级元素
            if (processedMarkdown.startsWith('$$\n')) {
                replacement.style.display = 'none';
            }
            
            // 替换原span元素
            span.parentNode.replaceChild(replacement, span);
        }
    });
    
    // 处理内联代码
    const inlineCodes = tempDiv.querySelectorAll('code:not(.code-block-wrapper code)');
    inlineCodes.forEach(code => {
        const text = code.textContent;
        if (!text) return;
        
        const markdown = `\`${text}\``;
        
        const replacement = document.createElement('span');
        replacement.setAttribute('data-markdown', markdown);
        code.parentNode.replaceChild(replacement, code);
    });
    
    // 处理标题
    for (let i = 1; i <= 6; i++) {
        const headers = tempDiv.querySelectorAll(`h${i}`);
        headers.forEach(header => {
            const text = header.textContent;
            const markdown = `${'#'.repeat(i)} ${text}`;
            
            const replacement = document.createElement('div');
            replacement.setAttribute('data-markdown', markdown);
            replacement.style.display = 'none';
            header.parentNode.replaceChild(replacement, header);
        });
    }
    
    // 处理列表
    const processList = (listElement, isOrdered) => {
        // 检查是否是嵌套列表
        const isNested = listElement.parentNode.tagName === 'LI';
        let markdown = '';
        
        // 处理列表项
        Array.from(listElement.children).forEach((item, index) => {
            if (item.tagName !== 'LI') return;
            
            const prefix = isOrdered ? `${index + 1}. ` : '- ';
            let indent = isNested ? '  ' : ''; // 嵌套列表增加缩进
            
            // 获取列表项文本（不包括子列表）
            let content = '';
            Array.from(item.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    content += node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE && 
                          node.tagName !== 'UL' && 
                          node.tagName !== 'OL') {
                    content += node.textContent;
                }
            });
            
            // 添加当前列表项
            markdown += `${indent}${prefix}${content.trim()}\n`;
            
            // 处理嵌套列表
            const nestedLists = item.querySelectorAll(':scope > ul, :scope > ol');
            nestedLists.forEach(nestedList => {
                const nestedMarkdown = processList(nestedList, nestedList.tagName === 'OL');
                markdown += nestedMarkdown;
            });
        });
        
        if (!isNested) {
            // 只有非嵌套列表才替换原HTML
            const replacement = document.createElement('div');
            replacement.setAttribute('data-markdown', markdown);
            replacement.style.display = 'none';
            listElement.parentNode.replaceChild(replacement, listElement);
        }
        
        return markdown;
    };
    
    // 处理有序列表和无序列表（仅处理顶层列表）
    const topLevelLists = Array.from(tempDiv.querySelectorAll('ul, ol')).filter(list => {
        return list.parentNode.tagName !== 'LI';
    });
    
    topLevelLists.forEach(list => {
        processList(list, list.tagName === 'OL');
    });
    
    // 处理链接
    const links = tempDiv.querySelectorAll('a');
    links.forEach(link => {
        const text = link.textContent;
        const href = link.getAttribute('href');
        if (!href) return;
        
        const markdown = `[${text}](${href})`;
        
        const replacement = document.createElement('span');
        replacement.setAttribute('data-markdown', markdown);
        link.parentNode.replaceChild(replacement, link);
    });
    
    // 处理强调(粗体)
    const bolds = tempDiv.querySelectorAll('strong, b');
    bolds.forEach(bold => {
        const text = bold.textContent;
        if (!text.trim()) return;
        
        const markdown = `**${text}**`;
        
        const replacement = document.createElement('span');
        replacement.setAttribute('data-markdown', markdown);
        bold.parentNode.replaceChild(replacement, bold);
    });
    
    // 处理斜体
    const italics = tempDiv.querySelectorAll('em, i');
    italics.forEach(italic => {
        const text = italic.textContent;
        if (!text.trim()) return;
        
        const markdown = `*${text}*`;
        
        const replacement = document.createElement('span');
        replacement.setAttribute('data-markdown', markdown);
        italic.parentNode.replaceChild(replacement, italic);
    });
    
    // 处理图片
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => {
        const alt = img.getAttribute('alt') || '';
        const src = img.getAttribute('src') || '';
        if (!src) return;
        
        const markdown = `![${alt}](${src})`;
        
        const replacement = document.createElement('span');
        replacement.setAttribute('data-markdown', markdown);
        img.parentNode.replaceChild(replacement, img);
    });
    
    // 处理水平线
    const hrs = tempDiv.querySelectorAll('hr');
    hrs.forEach(hr => {
        const markdown = `---`;
        
        const replacement = document.createElement('div');
        replacement.setAttribute('data-markdown', markdown);
        replacement.style.display = 'none';
        hr.parentNode.replaceChild(replacement, hr);
    });
    
    // 处理引用块
    const blockquotes = tempDiv.querySelectorAll('blockquote');
    blockquotes.forEach(blockquote => {
        const text = blockquote.textContent.trim();
        if (!text) return;
        
        const lines = text.split('\n');
        let markdown = '';
        
        lines.forEach(line => {
            markdown += `> ${line}\n`;
        });
        
        const replacement = document.createElement('div');
        replacement.setAttribute('data-markdown', markdown);
        replacement.style.display = 'none';
        blockquote.parentNode.replaceChild(replacement, blockquote);
    });
    
    // 处理表格
    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => {
        let markdown = '';
        
        // 处理表头
        const headers = table.querySelectorAll('th');
        if (headers.length > 0) {
            // 第一行：表头内容
            markdown += '| ';
            headers.forEach(header => {
                markdown += `${header.textContent.trim()} | `;
            });
            markdown += '\n';
            
            // 第二行：分隔行
            markdown += '| ';
            headers.forEach(() => {
                markdown += '--- | ';
            });
            markdown += '\n';
        }
        
        // 处理表格数据行
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            // 跳过表头行
            if (row.querySelector('th')) return;
            
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return;
            
            markdown += '| ';
            cells.forEach(cell => {
                markdown += `${cell.textContent.trim()} | `;
            });
            markdown += '\n';
        });
        
        if (markdown) {
            const replacement = document.createElement('div');
            replacement.setAttribute('data-markdown', markdown);
            replacement.style.display = 'none';
            table.parentNode.replaceChild(replacement, table);
        }
    });
    
    // 提取所有markdown标记
    let resultMarkdown = '';
    const extractMarkdown = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            // 处理文本节点
            const text = node.textContent.replace(/\s+/g, ' ');
            if (text.trim()) {
                resultMarkdown += text;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.hasAttribute('data-markdown')) {
                // 如果节点有markdown数据属性，直接使用
                const markdown = node.getAttribute('data-markdown');
                resultMarkdown += markdown;
                
                // 在markdown后添加适当的换行
                if (!resultMarkdown.endsWith('\n')) {
                    resultMarkdown += '\n';
                }
                if (!resultMarkdown.endsWith('\n\n') && 
                    (node.style.display === 'none' || 
                     ['DIV', 'P', 'BLOCKQUOTE', 'TABLE'].includes(node.nodeName))) {
                    resultMarkdown += '\n';
                }
            } else {
                // 否则递归处理子节点
                for (let i = 0; i < node.childNodes.length; i++) {
                    extractMarkdown(node.childNodes[i]);
                }
                
                // 根据元素类型添加换行
                if (['DIV', 'P', 'BR'].includes(node.nodeName)) {
                    if (!resultMarkdown.endsWith('\n')) {
                        resultMarkdown += '\n';
                    }
                    if (node.nodeName !== 'BR' && !resultMarkdown.endsWith('\n\n')) {
                        resultMarkdown += '\n';
                    }
                }
            }
        }
    };
    
    // 提取所有节点的markdown
    for (let i = 0; i < tempDiv.childNodes.length; i++) {
        extractMarkdown(tempDiv.childNodes[i]);
    }
    
    // 清理额外的空行并确保段落分隔
    resultMarkdown = resultMarkdown
        .replace(/\n{3,}/g, '\n\n')  // 超过2个换行的替换为2个
        .replace(/^\s+|\s+$/g, '');  // 去除开头和结尾的空白
    
    // 确保公式块的格式正确
    resultMarkdown = resultMarkdown
        // 确保多行块级公式两侧有空行
        .replace(/([^\n])\n\$\$/g, '$1\n\n$$')
        .replace(/\$\$\n([^\n])/g, '$$\n\n$1')
        // 修复被分割的行内公式（可能因为换行被分割）
        .replace(/\$\s*\n\s*([^$\n]+)\s*\n\s*\$/g, '$$1$')
        // 修复被分割的块级公式
        .replace(/\$\$\s*\n\s*([^$]+?)\s*\n\s*\$\$/g, '$$\n$1\n$$');
    
    // 缓存结果
    window._markdownCache.set(contentHash, resultMarkdown);
    
    // 限制缓存大小，防止内存泄漏
    if (window._markdownCache.size > 50) {
        // 删除最早添加的缓存项
        const firstKey = window._markdownCache.keys().next().value;
        window._markdownCache.delete(firstKey);
    }
    
    console.log('HTML转Markdown转换完成');
    return resultMarkdown;
}

/**
 * 生成字符串的哈希值，用于缓存key
 * @param {string} str - 要哈希的字符串
 * @return {string} 哈希结果
 */
function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString();
}
