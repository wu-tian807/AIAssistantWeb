// 初始化图标映射对象为空，将通过API动态填充
export let model_to_svg = {};

// 用户图标保持静态定义
export const user_to_svg = {
    'default_profile': STATIC_URL + 'icons/users/default_profile.svg'
}

// 从后端动态获取图标路径
export async function loadModelIcons() {
    try {
        const response = await fetch('/api/models/icons');
        if (!response.ok) {
            throw new Error(`获取图标路径失败: ${response.statusText}`);
        }
        const icons = await response.json();
        
        // 更新图标路径
        for (const [modelType, iconInfo] of Object.entries(icons)) {
            model_to_svg[modelType] = STATIC_URL + iconInfo.icon_path.replace('static/', '');
        }
        
        console.log('图标路径已更新:', model_to_svg);
    } catch (error) {
        console.error('获取图标路径失败:', error);
    }
}

// 在文件加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    loadModelIcons();
});
