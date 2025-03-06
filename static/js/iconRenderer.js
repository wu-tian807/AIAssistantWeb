import { model_to_svg } from './icons/icon_types.js';
import { fetchModels } from './utils/model_selector/modelSelect.js';

export class IconRenderer {
    constructor(modelInfo) {
        console.log('IconRenderer initialized with:', modelInfo);
        
        this.modelIcon = document.createElement('img');
        this.modelIcon.className = 'model-icon';
        
        // 添加调试日志
        console.log('Available icons:', model_to_svg);
        
        // 设置默认图标
        const iconType = modelInfo || 'xai';  // 如果 modelInfo 为空，使用默认值
        const svg = model_to_svg[iconType];
        
        console.log('Icon type:', iconType);
        console.log('SVG path:', svg);
        
        if (svg) {
            this.modelIcon.src = svg;
        } else {
            console.warn('No SVG found for icon type:', iconType);
            // 使用默认图标
            this.modelIcon.src = model_to_svg['xai'];
        }
        
        console.log('Created model icon:', this.modelIcon);
    }

    updateIcon(newIcon) {
        this.modelIcon.src = model_to_svg[newIcon];
    }
}

export class TitleIconRenderer {
    constructor() {
        this.modelSelect = document.getElementById('model-select');
        this.modelIcon = document.getElementById('model-icon');
        
        // 绑定事件监听器
        this.modelSelect.addEventListener('change', this.updateIcon.bind(this));
    }

    updateIcon() {
        const selectedOption = this.modelSelect.options[this.modelSelect.selectedIndex];
        if (!selectedOption || selectedOption.disabled) {
            return;
        }

        // 直接使用data-model-icon属性
        const modelIcon = selectedOption.getAttribute('data-model-icon');
        
        // 更新图标
        if (modelIcon && model_to_svg[modelIcon]) {
            console.log('更新标题图标为:', modelIcon, model_to_svg[modelIcon]);
            this.modelIcon.src = model_to_svg[modelIcon];
        }
    }
}

// 初始化渲染器
document.addEventListener('DOMContentLoaded', async () => {
    await fetchModels();
    // 初始化图标渲染器
    const iconRenderer = new TitleIconRenderer();
    
    // 延迟触发图标更新，确保在模型选择后执行
    setTimeout(() => {
        console.log('延迟触发图标更新');
        iconRenderer.updateIcon();
    }, 500);
});
