import { saveConversation ,currentConversationId} from '../script.js';
export class ModelSettingRenderer {
    constructor(max_output_tokens, default_output_tokens, default_temperature) {
        // 首先定义预设值
        this.temperaturePresets = {
            "0.0": "代码生成/数学解题 - 输出最精确和确定性的结果",
            "0.7": "知识问答/技术咨询 - 保持准确性的同时提供适度的灵活性",
            "1.0": "数据抽取/分析 - 在结构化和创造性之间取得平衡",
            "1.3": "通用对话/翻译 - 增加回答的多样性和自然度",
            "1.5": "创意类写作/诗歌创作 - 提供更具创造性和独特性的输出",
            "2.0": "头脑风暴/艺术创作 - 产生最具实验性和意外性的结果"
        };

        // 思考力度预设及说明
        this.reasoningEffortPresets = {
            "high": "高 - 深入、全面的推理和思考过程",
            "medium": "中 - 平衡的推理深度与生成速度",
            "low": "低 - 更快的响应速度，较简单的推理过程"
        };

        // 保存所有设置参数
        this.settings = {
            max_output_tokens: max_output_tokens,
            default_output_tokens: default_output_tokens,
            default_temperature: default_temperature,
            current_output_tokens: Math.floor(max_output_tokens / 2),
            current_temperature: default_temperature,
            reasoning_effort: 'high'  // 默认使用high
        };

        // 添加变化跟踪
        this.hasUnsavedChanges = false;
        this.initialSettings = { ...this.settings };
        
        // 记录当前模型是否支持思考力度设置
        this.supportsReasoningEffort = false;

        // 初始化UI和事件监听
        this.initializeUI();
        this.setupEventListeners();
        
        // 监听模型选择变化
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', () => {
                console.log('模型选择已变更，检查思考力度支持状态:', modelSelect.value);
                this.checkReasoningEffortSupport(modelSelect.value);
            });
            
            // 初始检查当前选中的模型
            if (modelSelect.value) {
                console.log('初始化时检查思考力度支持状态:', modelSelect.value);
                this.checkReasoningEffortSupport(modelSelect.value);
            }
        }
    }

    // 检查是否有未保存的更改
    checkForChanges() {
        return (
            this.settings.current_output_tokens !== this.initialSettings.current_output_tokens ||
            this.settings.current_temperature !== this.initialSettings.current_temperature ||
            this.settings.reasoning_effort !== this.initialSettings.reasoning_effort
        );
    }

    // 保存当前设置作为初始值
    saveAsInitial() {
        this.initialSettings = { ...this.settings };
        this.hasUnsavedChanges = false;
        
        // 重新检查思考力度设置的可见性
        const modelSelect = document.getElementById('model-select');
        if (modelSelect && modelSelect.value) {
            console.log('保存设置时检查思考力度支持状态:', modelSelect.value);
            this.checkReasoningEffortSupport(modelSelect.value);
        }
    }

    initializeUI() {
        // 创建并添加按钮
        this.button = document.createElement('div');
        this.button.className = 'model-setting-button';
        this.button.innerHTML = '<i class="fas fa-sliders-h"></i>';
        document.body.appendChild(this.button);

        // 创建并添加侧边栏
        this.sidebar = document.createElement('div');
        this.sidebar.className = 'model-setting-sidebar';
        this.sidebar.innerHTML = `
            <div class="setting-header">
                模型参数设置
                <span class="setting-close">&times;</span>
            </div>
            <div class="setting-section">
                <div class="setting-title">最大输出Token</div>
                <div class="slider-container">
                    <input type="range" class="custom-slider" id="max-tokens-slider" 
                           min="1" max="${this.settings.max_output_tokens}" value="${this.settings.current_output_tokens}">
                    <div class="slider-value">${this.settings.current_output_tokens}</div>
                    <div class="max-value">最大值: ${this.settings.max_output_tokens}</div>
                </div>
            </div>
            <div class="setting-section">
                <div class="setting-title">Temperature (温度)</div>
                <div class="slider-container">
                    <input type="range" class="custom-slider" id="temperature-slider" 
                           min="0" max="2" step="0.1" value="${this.settings.current_temperature}">
                    <div class="slider-value">${this.settings.current_temperature}</div>
                </div>
                <div class="preset-description"></div>
            </div>
            <div class="setting-section reasoning-effort-section" style="display: none;">
                <div class="setting-title">思考力度</div>
                <div class="radio-container">
                    <label class="radio-label">
                        <input type="radio" name="reasoning-effort" value="high" checked>
                        <span class="radio-text">高</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="reasoning-effort" value="medium">
                        <span class="radio-text">中</span>
                    </label>
                    <label class="radio-label">
                        <input type="radio" name="reasoning-effort" value="low">
                        <span class="radio-text">低</span>
                    </label>
                </div>
                <div class="reasoning-preset-description">${this.reasoningEffortPresets['high']}</div>
            </div>
        `;
        document.body.appendChild(this.sidebar);

        // 创建并添加遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'model-setting-overlay';
        document.body.appendChild(this.overlay);

        // 获取滑块元素
        this.maxTokensSlider = document.getElementById('max-tokens-slider');
        this.temperatureSlider = document.getElementById('temperature-slider');
        this.presetDescription = this.sidebar.querySelector('.preset-description');
        this.maxValueDisplay = this.sidebar.querySelector('.max-value');
        
        // 获取思考力度相关元素
        this.reasoningEffortSection = this.sidebar.querySelector('.reasoning-effort-section');
        this.reasoningRadios = this.sidebar.querySelectorAll('input[name="reasoning-effort"]');
        this.reasoningPresetDescription = this.sidebar.querySelector('.reasoning-preset-description');

        // 初始化预设描述
        this.updatePresetDescription(this.settings.current_temperature);
        
        console.log('UI initialized with settings:', this.settings);
    }

    setupEventListeners() {
        // 按钮点击事件
        this.button.addEventListener('click', () => this.toggleSidebar());

        // 关闭按钮事件
        this.sidebar.querySelector('.setting-close').addEventListener('click', () => this.toggleSidebar());

        // 遮罩层点击事件
        this.overlay.addEventListener('click', () => this.toggleSidebar());

        // 最大Token滑块事件
        this.maxTokensSlider.addEventListener('input', (e) => {
            let value = parseInt(e.target.value);
            // 如果值超过最大限制，直接设为最大值
            if (value > this.settings.max_output_tokens) {
                value = this.settings.max_output_tokens;
                e.target.value = value;
            }
            this.settings.current_output_tokens = value;
            e.target.parentElement.querySelector('.slider-value').textContent = value;
            this.hasUnsavedChanges = true;
        });

        // Temperature滑块事件
        this.temperatureSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value).toFixed(1);
            this.settings.current_temperature = parseFloat(value);
            e.target.parentElement.querySelector('.slider-value').textContent = value;
            this.updatePresetDescription(value);
            this.hasUnsavedChanges = true;
        });
        
        // 思考力度单选按钮事件
        this.reasoningRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const value = e.target.value;
                this.settings.reasoning_effort = value;
                this.updateReasoningPresetDescription(value);
                this.hasUnsavedChanges = true;
            });
        });
    }
    
    // 更新思考力度预设描述
    updateReasoningPresetDescription(value) {
        if (this.reasoningEffortPresets[value]) {
            this.reasoningPresetDescription.textContent = this.reasoningEffortPresets[value];
        }
    }
    
    // 设置思考力度支持状态
    setReasoningEffortSupport(supports) {
        console.log('设置思考力度支持状态:', supports);
        console.log('思考力度区域元素:', this.reasoningEffortSection);
        this.supportsReasoningEffort = supports;
        if (supports) {
            console.log('显示思考力度区域');
            this.reasoningEffortSection.style.display = 'block';
        } else {
            console.log('隐藏思考力度区域');
            this.reasoningEffortSection.style.display = 'none';
        }
    }
    
    // 检查当前选择的模型是否支持思考力度调整
    async checkReasoningEffortSupport(modelId) {
        console.log('检查模型是否支持思考力度调整:', modelId);
        try {
            const response = await fetch(`/api/models/thinking_model/${modelId}`);
            const data = await response.json();
            console.log('API返回结果:', data);
            this.setReasoningEffortSupport(data.thinking_model);
        } catch (error) {
            console.error('检查思考力度支持失败:', error);
            this.setReasoningEffortSupport(false);
        }
    }

    toggleSidebar() {
        const isActive = this.sidebar.classList.contains('active');
        this.button.classList.toggle('active');
        this.sidebar.classList.toggle('active');
        this.overlay.classList.toggle('active');

        // 添加动画效果
        if (!isActive) {
            this.sidebar.style.transition = 'right 0.3s ease';
            this.button.style.transition = 'right 0.3s ease';
            // 打开时记录初始值
            this.saveAsInitial();
            
            // 再次检查当前模型是否支持思考力度
            const modelSelect = document.getElementById('model-select');
            if (modelSelect && modelSelect.value) {
                console.log('打开设置面板时检查思考力度支持:', modelSelect.value);
                this.checkReasoningEffortSupport(modelSelect.value);
                
                // 直接强制设置显示/隐藏状态
                if (this.supportsReasoningEffort) {
                    console.log('强制显示思考力度区域');
                    if (this.reasoningEffortSection) {
                        this.reasoningEffortSection.style.display = 'block';
                    }
                } else {
                    console.log('强制隐藏思考力度区域');
                    if (this.reasoningEffortSection) {
                        this.reasoningEffortSection.style.display = 'none';
                    }
                }
            }
        } else {
            // 关闭时检查是否需要保存
            if (this.checkForChanges()) {
                this.saveSettings();
            }
        }
    }

    // 新增保存设置的方法
    async saveSettings(retryCount = 3, delay = 1000) {
        if (!currentConversationId) return;

        const startTime = Date.now();
        for (let i = 0; i < retryCount; i++) {
            try {
                console.log(`[${new Date().toISOString()}] 尝试保存设置 (${i + 1}/${retryCount}):`, {
                    currentConversationId,
                    settings: this.settings,
                    networkType: navigator.connection?.type,
                    networkSpeed: navigator.connection?.downlink,
                    memory: performance?.memory?.usedJSHeapSize,
                });

                await saveConversation(currentConversationId, 'update');
                
                console.log(`[${new Date().toISOString()}] 保存成功，耗时: ${Date.now() - startTime}ms`);
                this.saveAsInitial();
                return;
            } catch (error) {
                const errorInfo = {
                    attempt: i + 1,
                    totalAttempts: retryCount,
                    errorType: error.name,
                    errorMessage: error.message,
                    errorStack: error.stack,
                    timeSinceStart: Date.now() - startTime,
                    browserInfo: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        onLine: navigator.onLine,
                        memory: performance?.memory?.usedJSHeapSize,
                        connection: {
                            type: navigator.connection?.type,
                            downlink: navigator.connection?.downlink,
                            rtt: navigator.connection?.rtt,
                        }
                    }
                };

                console.error(`[${new Date().toISOString()}] 保存设置失败:`, errorInfo);

                if (i < retryCount - 1) {
                    console.log(`[${new Date().toISOString()}] 等待 ${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`[${new Date().toISOString()}] 达到最大重试次数，保存失败`);
                }
            }
        }
    }

    updatePresetDescription(value) {
        if (!this.temperaturePresets) return;
        
        value = parseFloat(value);
        // 找到最接近的预设值
        const presetValues = Object.keys(this.temperaturePresets).map(Number);
        const closestValue = presetValues.reduce((prev, curr) => {
            return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
        });

        this.presetDescription.textContent = this.temperaturePresets[closestValue.toFixed(1)];
        
        // 移除所有可能的data属性
        this.presetDescription.removeAttribute('data-temp');
        this.presetDescription.removeAttribute('data-temp-range');
        
        // 设置温度范围的视觉效果
        if (presetValues.includes(value)) {
            // 如果是预设值，使用特定颜色
            this.presetDescription.setAttribute('data-temp', value.toFixed(1));
            this.presetDescription.classList.add('highlight');
        } else {
            // 如果不是预设值，使用渐变效果
            this.presetDescription.classList.remove('highlight');
            if (value < 0.7) {
                this.presetDescription.setAttribute('data-temp-range', 'low');
            } else if (value < 1.3) {
                this.presetDescription.setAttribute('data-temp-range', 'medium');
            } else {
                this.presetDescription.setAttribute('data-temp-range', 'high');
            }
        }
    }

    // 获取当前设置值
    getSettings() {
        return {
            maxTokens: parseInt(this.maxTokensSlider.value),
            temperature: parseFloat(this.temperatureSlider.value),
            max_output_tokens: this.settings.max_output_tokens,
            default_output_tokens: this.settings.default_output_tokens,
            default_temperature: this.settings.default_temperature,
            current_output_tokens: parseInt(this.maxTokensSlider.value),
            reasoning_effort: this.settings.reasoning_effort
        };
    }

    // 设置值
    setSettings(settings) {
        console.log('Setting new values:', settings);
        let hasChanges = false;
        
        // 更新内部设置对象
        if (settings.max_output_tokens !== undefined && 
            this.settings.max_output_tokens !== settings.max_output_tokens) {
            this.settings.max_output_tokens = settings.max_output_tokens;
            this.maxTokensSlider.max = settings.max_output_tokens;
            this.maxValueDisplay.textContent = `最大值: ${settings.max_output_tokens}`;
            hasChanges = true;

            // 如果当前值超过新的最大值，则调整为最大值
            if (this.settings.current_output_tokens > settings.max_output_tokens) {
                this.settings.current_output_tokens = settings.max_output_tokens;
                this.maxTokensSlider.value = settings.max_output_tokens;
                this.maxTokensSlider.parentElement.querySelector('.slider-value').textContent = settings.max_output_tokens;
            }
        }

        if (settings.default_output_tokens !== undefined && 
            this.settings.default_output_tokens !== settings.default_output_tokens) {
            this.settings.default_output_tokens = settings.default_output_tokens;
            hasChanges = true;
        }

        if (settings.default_temperature !== undefined && 
            this.settings.default_temperature !== settings.default_temperature) {
            this.settings.default_temperature = settings.default_temperature;
            hasChanges = true;
        }

        // 更新UI
        if (settings.maxTokens !== undefined) {
            const maxTokens = Math.min(settings.maxTokens, this.settings.max_output_tokens);
            if (this.settings.current_output_tokens !== maxTokens) {
                this.settings.current_output_tokens = maxTokens;
                this.maxTokensSlider.value = maxTokens;
                this.maxTokensSlider.parentElement.querySelector('.slider-value').textContent = maxTokens;
                hasChanges = true;
            }
        }

        // 更新 current_output_tokens（如果提供）
        if (settings.current_output_tokens !== undefined) {
            // 确保不超过最大值
            const safeTokens = Math.min(settings.current_output_tokens, this.settings.max_output_tokens);
            if (this.settings.current_output_tokens !== safeTokens) {
                this.settings.current_output_tokens = safeTokens;
                this.maxTokensSlider.value = safeTokens;
                this.maxTokensSlider.parentElement.querySelector('.slider-value').textContent = safeTokens;
                hasChanges = true;
            }
        }

        if (settings.temperature !== undefined && 
            this.settings.current_temperature !== settings.temperature) {
            this.settings.current_temperature = settings.temperature;
            this.temperatureSlider.value = settings.temperature;
            this.temperatureSlider.parentElement.querySelector('.slider-value').textContent = settings.temperature;
            this.updatePresetDescription(settings.temperature);
            hasChanges = true;
        }
        
        // 更新思考力度设置
        if (settings.reasoning_effort !== undefined &&
            this.settings.reasoning_effort !== settings.reasoning_effort) {
            this.settings.reasoning_effort = settings.reasoning_effort;
            // 更新单选按钮选中状态
            this.reasoningRadios.forEach(radio => {
                if (radio.value === settings.reasoning_effort) {
                    radio.checked = true;
                }
            });
            this.updateReasoningPresetDescription(settings.reasoning_effort);
            hasChanges = true;
        }
        
        console.log('Settings updated:', this.settings);

        if (hasChanges) {
            this.hasUnsavedChanges = true;
            // 如果设置面板是打开的，将新设置保存为初始值
            if (this.sidebar.classList.contains('active')) {
                this.saveAsInitial();
            }
        }
    }

    // 重置为默认值
    resetToDefaults() {
        const defaultSettings = {
            maxTokens: Math.floor(this.settings.max_output_tokens / 2),
            temperature: this.settings.default_temperature,
            reasoning_effort: 'high'
        };
        this.setSettings(defaultSettings);
    }
}
