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

        // 获取选中的模型所属的组（xai 或 google）
        const modelGroup = selectedOption.parentElement.label.toLowerCase();
        const groupType = modelGroup.includes('xai') ? 'xai' : 
                         modelGroup.includes('google') ? 'google' : modelGroup.includes('deepseek') ? 'deepseek' : 
                         modelGroup.includes('siliconcloud') ? 'siliconcloud' : modelGroup.includes('oaipro') ? 'oaipro' : null;

        // 更新图标
        if (groupType && model_to_svg[groupType]) {
            this.modelIcon.src = model_to_svg[groupType];
        }
    }
}

// 初始化渲染器
document.addEventListener('DOMContentLoaded', async () => {
    await fetchModels();
    // 初始化图标渲染器
    const iconRenderer = new TitleIconRenderer();
    // 触发一次更新以设置初始图标
    iconRenderer.updateIcon();
});
