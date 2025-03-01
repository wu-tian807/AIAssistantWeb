/**
 * 增强视觉分析开关组件
 * 用于控制增强视觉分析功能的开关
 */
import { showToast } from '../utils/toast.js';

export class EnhancedVisualToggle {
    constructor() {
        this.toggleElement = null;
        this.toggleCheckbox = null;
        this.toolbar = null;
        this.isVisible = false;
        this.enhancedVisualEnabled = false;
        this.ocrEnabled = false;
        this.initialized = false;
        this.isDarkMode = document.body.classList.contains('dark-theme');
    }

    /**
     * 初始化开关组件
     */
    async init() {
        try {
            console.log('正在初始化增强视觉分析开关...');
            await this.fetchSettings();
            this.createToolbar();
            this.checkOcrSetting();
            this.listenForOcrSettingChanges();
            // 监听暗色模式变化
            this.listenForDarkModeChanges();
            // 监听输入框内容变化
            this.listenForInputChanges();
            this.initialized = true;
            console.log('增强视觉分析开关初始化完成');
        } catch (error) {
            console.error('初始化增强视觉分析开关时出错:', error);
        }
    }

    /**
     * 获取用户设置
     */
    async fetchSettings() {
        try {
            const response = await fetch('/api/user/settings/enhanced_visual');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`获取设置失败: ${errorData.error || response.statusText}`);
            }
            
            const data = await response.json();
            this.enhancedVisualEnabled = data.enhanced_visual || false;
            
            // 获取OCR设置
            const ocrResponse = await fetch('/api/user/settings/ocr_model');
            if (!ocrResponse.ok) {
                const errorData = await ocrResponse.json();
                throw new Error(`获取OCR设置失败: ${errorData.error || ocrResponse.statusText}`);
            }
            
            const ocrData = await ocrResponse.json();
            this.ocrEnabled = ocrData.enable_ocr || false;
            
            console.log('已获取用户设置:', {
                enhancedVisual: this.enhancedVisualEnabled,
                ocrEnabled: this.ocrEnabled
            });
        } catch (error) {
            console.error('获取用户设置时出错:', error);
            showToast(`获取设置失败: ${error.message}`, 'error');
        }
    }

    /**
     * 创建工具栏和开关
     */
    createToolbar() {
        // 确保之前的工具栏被移除
        if (this.toolbar) {
            this.toolbar.remove();
        }

        // 创建工具栏容器
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'visual-tools-toolbar';
        
        // 适配暗色模式
        if (this.isDarkMode) {
            this.toolbar.classList.add('dark-mode');
        }
        
        // 创建开关容器
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-container';
        
        // 创建标签
        const label = document.createElement('label');
        label.className = 'toggle-label';
        label.textContent = '增强视觉分析';
        label.htmlFor = 'enhanced-visual-toggle';
        
        // 创建开关
        this.toggleElement = document.createElement('label');
        this.toggleElement.className = 'toggle-switch';
        
        // 创建复选框
        this.toggleCheckbox = document.createElement('input');
        this.toggleCheckbox.type = 'checkbox';
        this.toggleCheckbox.id = 'enhanced-visual-toggle';
        this.toggleCheckbox.checked = this.enhancedVisualEnabled;
        
        // 创建滑块
        const slider = document.createElement('span');
        slider.className = 'slider';
        
        // 组装开关
        this.toggleElement.appendChild(this.toggleCheckbox);
        this.toggleElement.appendChild(slider);
        
        // 组装开关容器
        toggleContainer.appendChild(label);
        toggleContainer.appendChild(this.toggleElement);
        
        // 添加到工具栏
        this.toolbar.appendChild(toggleContainer);
        
        // 修改：直接添加到body末尾，实现完全悬浮效果
        document.body.appendChild(this.toolbar);
        
        // 确保开关可以正确响应用户交互
        this.toggleCheckbox.addEventListener('change', this.handleToggleChange.bind(this));
        
        // 为标签添加点击事件
        label.addEventListener('click', (e) => {
            e.preventDefault(); // 防止默认行为
            this.toggleCheckbox.checked = !this.toggleCheckbox.checked;
            // 手动触发change事件
            const event = new Event('change');
            this.toggleCheckbox.dispatchEvent(event);
        });
        
        // 根据OCR设置显示或隐藏工具栏
        this.toggleVisibility(this.ocrEnabled);
        
        // 设置工具栏位置
        this.updatePosition();
        
        // 监听窗口大小变化，更新位置
        window.addEventListener('resize', this.updatePosition.bind(this));
        
        // 创建一个MutationObserver来监听DOM变化
        this.observer = new MutationObserver(this.updatePosition.bind(this));
        this.observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
        
        // 添加暗色模式样式
        this.addStyles();
        
        console.log('增强视觉分析开关创建完成');
    }
    
    /**
     * 添加暗色模式的样式
     */
    addStyles() {
        // 检查是否已经存在样式
        const existingStyle = document.getElementById('enhanced-visual-toggle-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'enhanced-visual-toggle-styles';
        style.textContent = `
            .visual-tools-toolbar {
                position: fixed;
                background: #f5f5f5;
                border-radius: 8px;
                padding: 8px 12px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: center;
                z-index: 1000;
                transition: all 0.3s ease;
            }
            
            .toggle-container {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .toggle-label {
                font-size: 14px;
                color: #333;
                cursor: pointer;
            }
            
            .toggle-switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
            }
            
            .toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 34px;
            }
            
            .slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            
            input:checked + .slider {
                background-color: #2196F3;
            }
            
            input:focus + .slider {
                box-shadow: 0 0 1px #2196F3;
            }
            
            input:checked + .slider:before {
                transform: translateX(20px);
            }
        `;
        
        document.head.appendChild(style);
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
     * 更新工具栏位置，使其位于输入框上方
     */
    updatePosition() {
        if (!this.toolbar || this.toolbar.style.display === 'none') {
            return;
        }
        
        try {
            // 查找输入框容器
            const inputContainer = document.querySelector('.message-input-container');
            if (!inputContainer) {
                console.log('未找到消息输入容器，使用默认位置');
                return;
            }
            
            // 获取输入框的位置和尺寸
            const inputRect = inputContainer.getBoundingClientRect();
            
            // 设置工具栏位置
            this.toolbar.style.left = `${inputRect.left + 10}px`;
            this.toolbar.style.bottom = `${window.innerHeight - inputRect.top + 10}px`;
            
            console.log('已更新增强视觉分析工具栏位置');
        } catch (error) {
            console.error('更新工具栏位置时出错:', error);
        }
    }
    
    /**
     * 控制工具栏可见性
     * @param {boolean} visible - 是否可见
     */
    toggleVisibility(visible) {
        this.isVisible = visible;
        if (this.toolbar) {
            this.toolbar.style.display = visible ? 'flex' : 'none';
            
            // 如果变为可见，更新位置
            if (visible) {
                setTimeout(() => this.updatePosition(), 0);
            }
            
            console.log(`增强视觉分析工具栏${visible ? '显示' : '隐藏'}`);
        }
    }

    /**
     * 处理开关状态变化
     * @param {Event} event - 事件对象
     */
    async handleToggleChange(event) {
        try {
            console.log('增强视觉分析开关状态变更为:', event.target.checked);
            const newValue = event.target.checked;
            
            // 获取CSRF令牌
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            if (!csrfToken) {
                throw new Error('无法获取CSRF令牌');
            }
            
            // 保存设置到后端
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
            
            // 更新状态
            this.enhancedVisualEnabled = data.enhanced_visual || newValue;
            this.toggleCheckbox.checked = this.enhancedVisualEnabled;
            
            // 显示成功提示
            showToast(`增强视觉分析已${this.enhancedVisualEnabled ? '启用' : '禁用'}`, 'success');
        } catch (error) {
            console.error('更新增强视觉分析设置时出错:', error);
            
            // 回滚UI状态
            this.toggleCheckbox.checked = this.enhancedVisualEnabled;
            
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
                this.ocrEnabled = isOcrEnabled;
                this.toggleVisibility(isOcrEnabled);
                console.log('OCR设置已更改:', isOcrEnabled);
                
                // 如果OCR开启且开关未初始化或不可见，重新创建开关
                if (isOcrEnabled && (!this.initialized || !this.isVisible)) {
                    this.createToolbar();
                }
            }
        });
        
        // 同时也监听ocrSettingChanged事件（兼容性考虑）
        window.addEventListener('ocrSettingChanged', (event) => {
            const isOcrEnabled = event.detail.enabled;
            this.ocrEnabled = isOcrEnabled;
            this.toggleVisibility(isOcrEnabled);
            console.log('OCR设置已更改(通过ocrSettingChanged):', isOcrEnabled);
            
            // 如果OCR开启且开关未初始化或不可见，重新创建开关
            if (isOcrEnabled && (!this.initialized || !this.isVisible)) {
                this.createToolbar();
            }
        });
        
        console.log('已设置OCR设置变化监听器');
    }

    /**
     * 检查OCR设置状态
     */
    checkOcrSetting() {
        try {
            this.toggleVisibility(this.ocrEnabled);
            
            // 如果OCR已启用但开关不可见，尝试重新创建开关
            if (this.ocrEnabled && !this.isVisible) {
                setTimeout(() => {
                    this.createToolbar();
                    this.toggleVisibility(this.ocrEnabled);
                }, 500); // 添加短暂延迟确保DOM已完全加载
            }
            
            console.log('OCR设置状态检查完成:', this.ocrEnabled);
        } catch (error) {
            console.error('检查OCR设置状态时出错:', error);
        }
    }

    /**
     * 监听输入框内容变化
     */
    listenForInputChanges() {
        try {
            // 查找输入框元素
            const userInput = document.getElementById('user-input');
            if (!userInput) {
                console.log('未找到用户输入框，无法监听输入变化');
                return;
            }
            
            // 监听输入事件 - 内容输入时触发
            userInput.addEventListener('input', () => {
                this.updatePosition();
            });
            
            // 创建 ResizeObserver 监听输入框大小变化
            const resizeObserver = new ResizeObserver(() => {
                this.updatePosition();
            });
            
            // 开始观察输入框大小变化
            resizeObserver.observe(userInput);
            
            // 监听消息输入容器的变化
            const messageInputContainer = document.querySelector('.message-input-container');
            if (messageInputContainer) {
                const containerObserver = new MutationObserver(() => {
                    this.updatePosition();
                });
                
                containerObserver.observe(messageInputContainer, { 
                    attributes: true, 
                    childList: true,
                    subtree: true,
                    characterData: true 
                });
            }
            
            console.log('已设置输入框变化监听器');
        } catch (error) {
            console.error('设置输入框变化监听器时出错:', error);
        }
    }
}

// 初始化组件
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('DOM已加载，准备初始化增强视觉分析开关');
        const enhancedVisualToggle = new EnhancedVisualToggle();
        enhancedVisualToggle.init();
        
        // 额外的初始化保障
        setTimeout(() => {
            // 如果5秒后开关仍未初始化且OCR已启用，则尝试重新初始化
            if (enhancedVisualToggle.ocrEnabled && 
                (!enhancedVisualToggle.toolbar || 
                 enhancedVisualToggle.toolbar.style.display === 'none')) {
                console.log('增强视觉分析开关未正确显示，尝试重新初始化');
                enhancedVisualToggle.init();
            }
        }, 5000);
    } catch (error) {
        console.error('初始化增强视觉分析开关组件时出错:', error);
    }
}); 