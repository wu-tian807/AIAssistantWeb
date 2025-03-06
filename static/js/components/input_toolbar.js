/**
 * 输入工具栏组件
 * 用于管理输入框上方的工具栏及相关功能按钮
 */
import { showToast } from '../utils/toast.js';

/**
 * 输入工具栏类 - 管理输入框上方的工具栏
 */
export class InputToolbar {
    constructor() {
        this.toolbar = null;
        this.buttons = new Map(); // 存储添加的按钮
        this.activeButtons = new Set(); // 存储激活的按钮ID
        this.isDarkMode = document.body.classList.contains('dark-theme');
        this.initialized = false;
        
        // 加载工具栏CSS
        this.loadStylesheet('/static/css/input-toolbar.css');
    }

    /**
     * 加载CSS样式表
     * @param {string} path - 样式表路径
     */
    loadStylesheet(path) {
        if (!document.querySelector(`link[href="${path}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = path;
            document.head.appendChild(link);
        }
    }

    /**
     * 初始化工具栏
     */
    initialize() {
        // 确保之前的工具栏被移除
        if (this.toolbar) {
            this.toolbar.remove();
        }

        // 创建工具栏容器
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'input-tools-toolbar';
        
        // 适配暗色模式
        if (this.isDarkMode) {
            this.toolbar.classList.add('dark-mode');
        }
        
        // 查找输入框容器
        const inputContainer = document.querySelector('.message-input-container');
        if (!inputContainer) {
            console.log('未找到消息输入容器，无法添加工具栏');
            return false;
        }
        
        // 将工具栏添加到输入容器中
        inputContainer.appendChild(this.toolbar);
        
        // 监听暗色模式变化
        this.listenForDarkModeChanges();
        
        // 监听DOM变化，确保工具栏始终存在
        this.listenForDomChanges();
        
        // 默认隐藏工具栏，直到有激活的按钮
        this.toolbar.style.display = 'none';
        
        this.initialized = true;
        console.log('输入工具栏创建完成');
        return true;
    }
    
    /**
     * 获取工具栏实例（单例模式）
     */
    static getInstance() {
        if (!InputToolbar.instance) {
            InputToolbar.instance = new InputToolbar();
        }
        return InputToolbar.instance;
    }
    
    /**
     * 添加按钮到工具栏
     * @param {string} id - 按钮ID
     * @param {HTMLElement} buttonElement - 按钮元素
     * @param {boolean} isActive - 按钮是否激活
     * @returns {boolean} - 是否添加成功
     */
    addButton(id, buttonElement, isActive = false) {
        if (!this.initialized && !this.initialize()) {
            return false;
        }
        
        // 如果已存在同ID按钮，先移除
        if (this.buttons.has(id)) {
            const existingButton = this.buttons.get(id);
            existingButton.remove();
            this.buttons.delete(id);
            this.activeButtons.delete(id);
        }
        
        // 添加按钮
        this.toolbar.appendChild(buttonElement);
        this.buttons.set(id, buttonElement);
        
        // 如果按钮激活，添加到激活集合
        if (isActive) {
            this.activeButtons.add(id);
            this.showToolbar();
        }
        
        return true;
    }
    
    /**
     * 移除按钮
     * @param {string} id - 按钮ID
     */
    removeButton(id) {
        if (this.buttons.has(id)) {
            const button = this.buttons.get(id);
            button.remove();
            this.buttons.delete(id);
            this.activeButtons.delete(id);
            
            // 检查是否需要隐藏工具栏
            if (this.activeButtons.size === 0 && this.toolbar) {
                this.toolbar.style.display = 'none';
            }
        }
    }
    
    /**
     * 设置按钮激活状态
     * @param {string} id - 按钮ID
     * @param {boolean} isActive - 是否激活
     */
    setButtonActive(id, isActive) {
        if (!this.buttons.has(id)) {
            return false;
        }
        
        if (isActive) {
            this.activeButtons.add(id);
            this.showToolbar();
        } else {
            this.activeButtons.delete(id);
            
            // 如果没有激活的按钮，隐藏工具栏
            if (this.activeButtons.size === 0) {
                this.hideToolbar();
            }
        }
        
        return true;
    }
    
    /**
     * 显示工具栏（如果有按钮）
     */
    showToolbar() {
        if (this.toolbar && this.buttons.size > 0) {
            this.toolbar.style.display = 'flex';
            console.log('显示输入工具栏，激活的按钮数:', this.activeButtons.size);
        }
    }
    
    /**
     * 隐藏工具栏
     */
    hideToolbar() {
        if (this.toolbar) {
            this.toolbar.style.display = 'none';
            console.log('隐藏输入工具栏');
        }
    }
    
    /**
     * 监听暗色模式变化
     */
    listenForDarkModeChanges() {
        // 创建一个观察器来监听body类的变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isDarkMode = document.body.classList.contains('dark-theme');
                    if (this.isDarkMode !== isDarkMode) {
                        this.isDarkMode = isDarkMode;
                        this.updateDarkMode();
                    }
                }
            });
        });
        
        // 开始观察目标节点
        observer.observe(document.body, { attributes: true });
    }
    
    /**
     * 更新暗色模式状态
     */
    updateDarkMode() {
        if (this.toolbar) {
            if (this.isDarkMode) {
                this.toolbar.classList.add('dark-mode');
            } else {
                this.toolbar.classList.remove('dark-mode');
            }
        }
    }
    
    /**
     * 监听DOM变化，确保工具栏始终存在
     */
    listenForDomChanges() {
        try {
            const messageInputContainer = document.querySelector('.message-input-container');
            if (messageInputContainer) {
                // 监听DOM变化，确保按钮始终存在
                const containerObserver = new MutationObserver(() => {
                    // 如果工具栏不在DOM中，重新添加
                    if (this.toolbar && !document.contains(this.toolbar) && this.buttons.size > 0) {
                        messageInputContainer.appendChild(this.toolbar);
                        
                        // 如果有激活的按钮，显示工具栏
                        if (this.activeButtons.size > 0) {
                            this.showToolbar();
                        } else {
                            this.hideToolbar();
                        }
                    }
                });
                
                containerObserver.observe(messageInputContainer, { 
                    attributes: true, 
                    childList: true,
                    subtree: true
                });
            }
        } catch (error) {
            console.error('设置DOM变化监听器时出错:', error);
        }
    }
    
    /**
     * 检查是否为空（无按钮）
     */
    isEmpty() {
        return this.buttons.size === 0;
    }
    
    /**
     * 检查是否存在激活的按钮
     */
    hasActiveButtons() {
        return this.activeButtons.size > 0;
    }
    
    /**
     * 隐藏工具栏
     * @deprecated 使用hideToolbar替代
     */
    hide() {
        this.hideToolbar();
    }
    
    /**
     * 显示工具栏
     * @deprecated 使用showToolbar替代
     */
    show() {
        this.showToolbar();
    }
}

/**
 * 增强视觉分析按钮类
 */
export class EnhancedVisualToggle {
    constructor() {
        this.buttonElement = null;
        this.enhancedVisualEnabled = false;
        this.ocrEnabled = false;
        this.isDarkMode = document.body.classList.contains('dark-theme');
        this.initialized = false;
        this.buttonId = 'enhanced-visual-toggle';
        
        // 获取工具栏实例
        this.toolbar = InputToolbar.getInstance();
        
        // 加载按钮样式
        this.loadStylesheet('/static/css/enhanced-visual-toggle.css');
    }

    /**
     * 加载CSS样式表
     * @param {string} path - 样式表路径
     */
    loadStylesheet(path) {
        if (!document.querySelector(`link[href="${path}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = path;
            document.head.appendChild(link);
        }
    }

    /**
     * 初始化增强视觉分析设置
     */
    async initialize() {
        console.log('初始化增强视觉分析设置');
        try {
            // 获取初始设置
            await this.fetchSettings();
            
            // 创建按钮并添加到工具栏
            this.createButton();
            
            // 监听OCR设置变化
            this.listenForOcrSettingChanges();
            
            // 确保状态正确同步到UI
            this.syncUIState();
            
            console.log('增强视觉分析设置初始化完成, OCR状态:', this.ocrEnabled, '增强视觉状态:', this.enhancedVisualEnabled);
            this.initialized = true;
        } catch (error) {
            console.error('初始化增强视觉分析设置时出错:', error);
        }
    }

    /**
     * 初始化方法 - 确保DOM加载完成后再初始化
     */
    async init() {
        try {
            const initFunction = async () => {
                console.log('开始初始化增强视觉分析设置');
                
                // 等待一小段时间确保DOM完全就绪
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // 确保输入框容器存在
                const checkContainer = () => {
                    const inputContainer = document.querySelector('.message-input-container');
                    if (!inputContainer) {
                        console.log('未找到消息输入容器，稍后重试...');
                        setTimeout(checkContainer, 300);
                        return;
                    }
                    
                    // 容器存在，可以初始化
                    this.initialize();
                };
                
                checkContainer();
            };
            
            // 等待DOM加载完成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('DOM加载完成，准备初始化');
                    initFunction();
                });
            } else {
                // DOM已加载完成，直接初始化
                console.log('DOM已加载，直接初始化');
                await initFunction();
            }
        } catch (error) {
            console.error('初始化增强视觉分析按钮时出错:', error);
        }
    }
    
    /**
     * 从服务器获取用户设置
     */
    async fetchSettings() {
        try {
            // 从localStorage获取缓存的设置（如果存在）- 仅作为临时状态使用
            const cachedSettings = localStorage.getItem('enhanced_visual_settings');
            if (cachedSettings) {
                try {
                    const settings = JSON.parse(cachedSettings);
                    // 临时使用缓存值，直到服务器响应返回
                    this.enhancedVisualEnabled = settings.enhanced_visual || false;
                    this.ocrEnabled = settings.ocr_enabled || false;
                    console.log('从缓存临时加载设置', settings);
                } catch (e) {
                    console.error('解析缓存设置失败:', e);
                }
            }
            
            // 获取增强视觉设置 - 这是权威来源
            const response = await fetch('/api/user/settings/enhanced_visual');
            if (!response.ok) {
                throw new Error(`获取增强视觉设置失败: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            this.enhancedVisualEnabled = data.enhanced_visual || false;
            
            // 获取OCR设置 - 这是权威来源
            const ocrResponse = await fetch('/api/user/settings/ocr_model');
            if (!ocrResponse.ok) {
                throw new Error(`获取OCR设置失败: ${ocrResponse.status} ${ocrResponse.statusText}`);
            }
            const ocrData = await ocrResponse.json();
            this.ocrEnabled = ocrData.enable_ocr || false;
            
            // 更新本地缓存以便下次快速加载
            try {
                localStorage.setItem('enhanced_visual_settings', JSON.stringify({
                    enhanced_visual: this.enhancedVisualEnabled,
                    ocr_enabled: this.ocrEnabled,
                    timestamp: new Date().getTime() // 添加时间戳以便知道缓存何时过期
                }));
            } catch (e) {
                console.warn('无法更新设置缓存:', e);
            }
            
            console.log('从服务器获取设置成功:', {
                enhancedVisual: this.enhancedVisualEnabled,
                ocrEnabled: this.ocrEnabled
            });
            
            return {
                enhanced_visual: this.enhancedVisualEnabled,
                ocr_enabled: this.ocrEnabled
            };
        } catch (error) {
            console.error('获取用户设置时出错:', error);
            // 出错时，使用默认值或本地缓存
            return {
                enhanced_visual: this.enhancedVisualEnabled,
                ocr_enabled: this.ocrEnabled
            };
        }
    }
    
    /**
     * 同步UI状态
     */
    syncUIState() {
        // 首先确保按钮状态正确
        if (this.buttonElement) {
            // 设置按钮的active类
            if (this.enhancedVisualEnabled) {
                this.buttonElement.classList.add('active');
            } else {
                this.buttonElement.classList.remove('active');
            }
        }
        
        // 根据OCR总开关状态显示/隐藏按钮
        this.toggleVisibility(this.ocrEnabled);
    }
    
    /**
     * 创建视觉分析按钮
     */
    createButton() {
        // 创建眼睛图标按钮
        this.buttonElement = document.createElement('button');
        this.buttonElement.className = 'visual-eye-button';
        this.buttonElement.title = '增强视觉分析';
        
        // 创建眼睛图标
        const eyeIcon = document.createElement('span');
        eyeIcon.className = 'eye-icon';
        eyeIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5C7 5 2.73 8.11 1 12C2.73 15.89 7 19 12 19C17 19 21.27 15.89 23 12C21.27 8.11 17 5 12 5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="currentColor"/>
        </svg>`;
        
        // 将眼睛图标添加到按钮
        this.buttonElement.appendChild(eyeIcon);
        
        // 设置激活状态
        if (this.enhancedVisualEnabled) {
            this.buttonElement.classList.add('active');
        }
        
        // 确保按钮可以正确响应用户交互
        this.buttonElement.addEventListener('click', this.handleToggleClick.bind(this));
        
        // 根据OCR设置显示或隐藏按钮
        if (this.ocrEnabled) {
            // 添加到工具栏，并指明是否是激活状态
            this.toolbar.addButton(this.buttonId, this.buttonElement, this.enhancedVisualEnabled);
        }
        
        console.log('增强视觉分析按钮创建完成，激活状态:', this.enhancedVisualEnabled);
        return this.buttonElement;
    }
    
    /**
     * 控制按钮可见性
     * @param {boolean} visible - 是否可见
     */
    toggleVisibility(visible) {
        if (visible) {
            // 添加到工具栏（如果不在DOM中）
            if (this.buttonElement && !document.contains(this.buttonElement)) {
                this.toolbar.addButton(this.buttonId, this.buttonElement, this.enhancedVisualEnabled);
            }
            
            // 确保工具栏根据增强视觉状态正确显示
            if (this.enhancedVisualEnabled) {
                this.toolbar.setButtonActive(this.buttonId, true);
            } 
        } else {
            // OCR总开关关闭时，不应该直接移除按钮，而是将其设置为非激活状态
            // this.toolbar.removeButton(this.buttonId); // 这会导致按钮被完全移除
            this.toolbar.setButtonActive(this.buttonId, false);
        }
        
        console.log(`增强视觉分析按钮${visible ? '显示' : '隐藏'}`);
    }

    /**
     * 处理按钮点击
     */
    async handleToggleClick() {
        try {
            // 切换状态
            const newValue = !this.enhancedVisualEnabled;
            console.log('增强视觉分析状态变更为:', newValue);
            
            // UI立即反馈，提高响应速度
            this.enhancedVisualEnabled = newValue;
            if (this.enhancedVisualEnabled) {
                this.buttonElement.classList.add('active');
                this.toolbar.setButtonActive(this.buttonId, true);
            } else {
                this.buttonElement.classList.remove('active');
            }
            
            // 获取CSRF令牌
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            if (!csrfToken) {
                throw new Error('无法获取CSRF令牌');
            }
            
            // 保存设置到后端（真正的持久化）
            const response = await fetch('/api/user/settings/enhanced_visual', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    enhanced_visual: newValue
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`设置更新失败 (${response.status}): ${errorData.error || response.statusText}`);
            }
            
            const data = await response.json();
            
            // 再次更新状态（以防服务器状态与本地不一致）
            const serverValue = data.enhanced_visual;
            if (serverValue !== this.enhancedVisualEnabled) {
                console.warn('服务器返回的状态与本地不一致，使用服务器状态');
                this.enhancedVisualEnabled = serverValue;
                
                // 更新UI
                if (this.enhancedVisualEnabled) {
                    this.buttonElement.classList.add('active');
                    this.toolbar.setButtonActive(this.buttonId, true);
                } else {
                    this.buttonElement.classList.remove('active');
                }
            }
            
            // 更新本地缓存
            try {
                const cachedSettings = localStorage.getItem('enhanced_visual_settings');
                let settings = cachedSettings ? JSON.parse(cachedSettings) : {};
                settings.enhanced_visual = this.enhancedVisualEnabled;
                settings.timestamp = new Date().getTime();
                localStorage.setItem('enhanced_visual_settings', JSON.stringify(settings));
            } catch (e) {
                console.warn('无法更新设置缓存:', e);
            }
            
            // 显示成功提示
            showToast(`增强视觉分析已${this.enhancedVisualEnabled ? '启用' : '禁用'}`, 'success');
        } catch (error) {
            console.error('更新增强视觉分析设置时出错:', error);
            
            // 发生错误时，恢复原状态
            this.enhancedVisualEnabled = !this.enhancedVisualEnabled;
            if (this.enhancedVisualEnabled) {
                this.buttonElement.classList.add('active');
                this.toolbar.setButtonActive(this.buttonId, true);
            } else {
                this.buttonElement.classList.remove('active');
            }
            
            // 显示详细错误信息
            showToast(`设置更新失败: ${error.message}`, 'error');
        }
    }
    
    /**
     * 监听OCR设置变化
     */
    listenForOcrSettingChanges() {
        // 监听设置更新事件
        document.addEventListener('settings-updated', (event) => {
            if (event.detail && event.detail.setting === 'enable_ocr') {
                const isOcrEnabled = event.detail.value;
                this.ocrEnabled = isOcrEnabled
                this.toggleVisibility(isOcrEnabled);
                console.log('OCR设置已更改:', isOcrEnabled);
            }
        });
        
        // 同时也监听ocrSettingChanged事件（兼容性考虑）
        window.addEventListener('ocrSettingChanged', (event) => {
            const isOcrEnabled = event.detail.enabled;
            this.ocrEnabled = isOcrEnabled;
            this.toggleVisibility(isOcrEnabled);
            console.log('OCR设置已更改(通过ocrSettingChanged):', isOcrEnabled);
        });
        
        console.log('已设置OCR设置变化监听器');
    }

    showProcessingStatus(message) {
        // 显示处理状态
        const status = document.createElement('div');
        status.className = 'processing-status';
        status.textContent = message;
        document.body.appendChild(status);
        
        // 3秒后自动隐藏
        setTimeout(() => {
            status.remove();
        }, 3000);
    }

    hideProcessingStatus() {
        const status = document.querySelector('.processing-status');
        if (status) {
            status.remove();
        }
    }
}

// 初始化组件
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('DOM已加载，准备初始化工具栏和增强视觉分析按钮');
        
        // 首先初始化一次工具栏
        const toolbar = InputToolbar.getInstance();
        if (!toolbar.initialized) {
            setTimeout(() => toolbar.initialize(), 300);
        }
        
        // 初始化增强视觉分析按钮
        const enhancedVisualToggle = new EnhancedVisualToggle();
        enhancedVisualToggle.init();
        
        // 额外的初始化保障，确保在DOM完全就绪后，工具栏和按钮都存在并正确显示
        setTimeout(() => {
            try {
                // 确保工具栏已初始化
                if (!toolbar.initialized) {
                    toolbar.initialize();
                }
                
                // 如果当前是移动端，则先隐藏工具栏
                if(window.isMobile){
                    InputToolbar.getInstance().hideToolbar();
                }
                // 如果OCR已启用但按钮未显示，重新添加按钮
                else if (enhancedVisualToggle.ocrEnabled && 
                    (!enhancedVisualToggle.buttonElement || 
                     !document.contains(enhancedVisualToggle.buttonElement))) {
                    console.log('增强视觉分析按钮未正确显示，尝试重新初始化');
                    enhancedVisualToggle.createButton();
                    enhancedVisualToggle.syncUIState();
                }else if(enhancedVisualToggle.ocrEnabled){
                    InputToolbar.getInstance().showToolbar();
                }
            } catch (e) {
                console.error('延迟初始化时出错:', e);
            }
        }, 1000);
        
        // 额外的备份检查，5秒后检查组件状态
        setTimeout(() => {
            if (enhancedVisualToggle.ocrEnabled && 
                (!enhancedVisualToggle.buttonElement || 
                 !document.contains(enhancedVisualToggle.buttonElement))) {
                console.log('增强视觉分析按钮未正确显示，进行最后一次初始化尝试');
                enhancedVisualToggle.init();
            }
        }, 5000);
    } catch (error) {
        console.error('初始化输入工具栏组件时出错:', error);
    }
});

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
.processing-status {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1000;
    display: none;
}
`;
document.head.appendChild(style); 