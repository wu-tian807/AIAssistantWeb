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
                    <button class="copy-button" onclick="copyCode(this)">复制代码</button>
                </div>
                <pre><code class="language-${lang || 'plaintext'}">${md.utils.escapeHtml(str)}</code></pre>
            </div>`;
        }
    })
    // 添加 LaTeX 数学公式支持
    .use(window.texmath, {
        engine: katex,
        delimiters: 'dollars',
        katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
    });
    return md
}

// 应用代码高亮的函数
export function applyCodeHighlight(container) {
    container.querySelectorAll('.code-block-wrapper pre code').forEach((block) => {
        // 获取语言类名
        const langClass = Array.from(block.classList)
            .find(className => className.startsWith('language-'));
        const lang = langClass ? langClass.replace('language-', '') : '';
        
        // 如果指定了语言，设置到 hljs 的类名中
        if (lang && lang !== 'plaintext') {
            block.className = `hljs language-${lang}`;
        }
        
        // 应用高亮
        hljs.highlightElement(block);
    });
}
