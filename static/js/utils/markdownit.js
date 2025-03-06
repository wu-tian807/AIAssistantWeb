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
