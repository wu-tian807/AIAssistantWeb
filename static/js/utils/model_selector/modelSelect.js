let modelSettingRenderer = null;

export function setModelSettingRenderer(renderer) {
    modelSettingRenderer = renderer;
}

export function getLastAssistantModel(conversation) {
    // 找到最后一条助手消息的模型信息
    let lastAssistantModel = null;
    console.log('开始查找最后一条助手消息，总消息数:', conversation.messages.length);
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
        const msg = conversation.messages[i];
        console.log(`检查消息 ${i}:`, {
            role: msg.role,
            hasVersions: !!msg.versions,
            currentVersion: msg.currentVersion,
            modelId: msg.modelId,
            modelIcon: msg.modelIcon
        });
        if (msg.role === 'assistant') {
            if (msg.versions && msg.versions[msg.currentVersion]) {
                const version = msg.versions[msg.currentVersion];
                console.log('找到版本信息:', version);
                lastAssistantModel = {
                    modelId: version.modelId,
                    modelIcon: version.modelIcon
                };
            } else if (msg.modelId) {
                console.log('使用消息本身的模型信息:', {
                    modelId: msg.modelId,
                    modelIcon: msg.modelIcon
                });
                lastAssistantModel = {
                    modelId: msg.modelId,
                    modelIcon: msg.modelIcon
                };
            }
            break;
        }
    }
    return lastAssistantModel;
}

export function updateModelSelect(modelId, modelSelect) {
    if (!modelSelect) return;
    
    // 更新原生选择框
    modelSelect.value = modelId;
    
    // 更新自定义选择框
    const customSelect = modelSelect.parentElement.querySelector('.custom-select');
    if (customSelect) {
        const selectedOption = modelSelect.options[modelSelect.selectedIndex];
        if (selectedOption) {
            // 更新显示的文本
            const selectedText = customSelect.querySelector('.selected-text');
            if (selectedText) {
                selectedText.textContent = selectedOption.textContent;
            }
            
            // 更新选中的选项样式
            const allItems = customSelect.querySelectorAll('.option-item');
            allItems.forEach(item => item.classList.remove('selected'));
            const selectedItem = customSelect.querySelector(`[data-value="${modelId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
    }
    
    // 触发 change 事件以更新图标
    const event = new Event('change');
    modelSelect.dispatchEvent(event);
    
    // 检查模型是否支持思考力度调整
    if (modelSettingRenderer) {
        modelSettingRenderer.checkReasoningEffortSupport(modelId);
    }
}

// 获取可用模型列表
export async function fetchModels() {
    try {
        const response = await fetch('/api/models');
        const models = await response.json();
        console.log('Received models from backend:', models);
        const select = document.getElementById('model-select');
        const customSelect = select.parentElement.querySelector('.custom-select');
        
        // 清空现有选项
        select.innerHTML = '<option value="" disabled selected>选择模型...</option>';
        
        // 如果存在自定义选择器，清空其选项
        if (customSelect) {
            const optionsContainer = customSelect.querySelector('.select-options');
            if (optionsContainer) {
                optionsContainer.innerHTML = '';
            }
        }
        
        // 添加xAI模型组
        if (models.xai && models.xai.models.length > 0) {
            const xaiGroup = document.createElement('optgroup');
            xaiGroup.label = 'xAI Models';
            
            // 如果存在自定义选择器，创建组
            if (customSelect) {
                const group = document.createElement('div');
                group.className = 'option-group';
                
                const label = document.createElement('div');
                label.className = 'group-label';
                label.textContent = 'xAI Models';
                group.appendChild(label);
                
                models.xai.models.forEach(model => {
                    // 创建原始option
                    const option = document.createElement('option');
                    option.setAttribute('data-model-icon', 'xai');
                    option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        option.setAttribute('data-reasoner', model.reasoner);
                    }
                    option.value = model.id;
                    option.textContent = `${model.name} - ${model.description}`;
                    xaiGroup.appendChild(option);
                    
                    // 创建自定义选项
                    const item = document.createElement('div');
                    item.className = 'option-item';
                    item.textContent = `${model.name} - ${model.description}`;
                    item.setAttribute('data-value', model.id);
                    item.setAttribute('data-model-icon', 'xai');
                    item.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        item.setAttribute('data-reasoner', model.reasoner);
                    }
                    
                    item.addEventListener('click', () => {
                        const allItems = customSelect.querySelectorAll('.option-item');
                        allItems.forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        const selectedText = customSelect.querySelector('.selected-text');
                        selectedText.textContent = item.textContent;
                        
                        select.value = model.id;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                        
                        customSelect.classList.remove('open');
                    });
                    
                    group.appendChild(item);
                });
                
                customSelect.querySelector('.select-options').appendChild(group);
            }
            
            select.appendChild(xaiGroup);
        }
        
        // 添加Google模型组
        if (models.google && models.google.models.length > 0) {
            const googleGroup = document.createElement('optgroup');
            googleGroup.label = 'Google Models';
            
            // 如果存在自定义选择器，创建组
            if (customSelect) {
                const group = document.createElement('div');
                group.className = 'option-group';
                
                const label = document.createElement('div');
                label.className = 'group-label';
                label.textContent = 'Google Models';
                group.appendChild(label);
                
                models.google.models.forEach(model => {
                    // 创建原始option
                    const option = document.createElement('option');
                    option.setAttribute('data-model-icon', 'google');
                    option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        option.setAttribute('data-reasoner', model.reasoner);
                    }
                    option.value = model.id;
                    option.textContent = `${model.name} - ${model.description}`;
                    googleGroup.appendChild(option);
                    
                    // 创建自定义选项
                    const item = document.createElement('div');
                    item.className = 'option-item';
                    item.textContent = `${model.name} - ${model.description}`;
                    item.setAttribute('data-value', model.id);
                    item.setAttribute('data-model-icon', 'google');
                    item.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        item.setAttribute('data-reasoner', model.reasoner);
                    }
                    
                    item.addEventListener('click', () => {
                        const allItems = customSelect.querySelectorAll('.option-item');
                        allItems.forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        const selectedText = customSelect.querySelector('.selected-text');
                        selectedText.textContent = item.textContent;
                        
                        select.value = model.id;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                        
                        customSelect.classList.remove('open');
                    });
                    
                    group.appendChild(item);
                });
                
                customSelect.querySelector('.select-options').appendChild(group);
            }
            
            select.appendChild(googleGroup);
        }

        // 添加DeepSeek模型组
        if (models.deepseek && models.deepseek.models.length > 0) {
            const deepseekGroup = document.createElement('optgroup');
            deepseekGroup.label = 'DeepSeek Models';
            
            // 如果存在自定义选择器，创建组
            if (customSelect) {
                const group = document.createElement('div');
                group.className = 'option-group';
                
                const label = document.createElement('div');
                label.className = 'group-label';
                label.textContent = 'DeepSeek Models';
                group.appendChild(label);
                
                models.deepseek.models.forEach(model => {
                    // 创建原始option
                    const option = document.createElement('option');
                    option.setAttribute('data-model-icon', 'deepseek');
                    option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        option.setAttribute('data-reasoner', model.reasoner);
                    }
                    option.value = model.id;
                    option.textContent = `${model.name} - ${model.description}`;
                    deepseekGroup.appendChild(option);
                    
                    // 创建自定义选项
                    const item = document.createElement('div');
                    item.className = 'option-item';
                    item.textContent = `${model.name} - ${model.description}`;
                    item.setAttribute('data-value', model.id);
                    item.setAttribute('data-model-icon', 'deepseek');
                    item.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        item.setAttribute('data-reasoner', model.reasoner);
                    }
                    
                    item.addEventListener('click', () => {
                        const allItems = customSelect.querySelectorAll('.option-item');
                        allItems.forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        const selectedText = customSelect.querySelector('.selected-text');
                        selectedText.textContent = item.textContent;
                        
                        select.value = model.id;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                        
                        customSelect.classList.remove('open');
                    });
                    
                    group.appendChild(item);
                });
                
                customSelect.querySelector('.select-options').appendChild(group);
            }
            
            select.appendChild(deepseekGroup);
        }
        
        // 添加DeepSeek模型组后，添加SiliconCloud模型组
        if (models.siliconcloud && models.siliconcloud.models.length > 0) {
            const siliconcloudGroup = document.createElement('optgroup');
            siliconcloudGroup.label = 'SiliconCloud Models';
            
            // 如果存在自定义选择器，创建组
            if (customSelect) {
                const group = document.createElement('div');
                group.className = 'option-group';
                
                const label = document.createElement('div');
                label.className = 'group-label';
                label.textContent = 'SiliconCloud Models';
                group.appendChild(label);
                
                models.siliconcloud.models.forEach(model => {
                    // 创建原始option
                    const option = document.createElement('option');
                    option.setAttribute('data-model-icon', 'siliconcloud');
                    option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        option.setAttribute('data-reasoner', model.reasoner);
                    }
                    option.value = model.id;
                    option.textContent = `${model.name} - ${model.description}`;
                    siliconcloudGroup.appendChild(option);
                    
                    // 创建自定义选项
                    const item = document.createElement('div');
                    item.className = 'option-item';
                    item.textContent = `${model.name} - ${model.description}`;
                    item.setAttribute('data-value', model.id);
                    item.setAttribute('data-model-icon', 'siliconcloud');
                    item.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        item.setAttribute('data-reasoner', model.reasoner);
                    }
                    
                    item.addEventListener('click', () => {
                        const allItems = customSelect.querySelectorAll('.option-item');
                        allItems.forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        const selectedText = customSelect.querySelector('.selected-text');
                        selectedText.textContent = item.textContent;
                        
                        select.value = model.id;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                        
                        customSelect.classList.remove('open');
                    });
                    
                    group.appendChild(item);
                });
                
                customSelect.querySelector('.select-options').appendChild(group);
            }
            
            select.appendChild(siliconcloudGroup);
        }
        //添加oaipro模型组
        if (models.oaipro && models.oaipro.models.length > 0) {
            const oaiproGroup = document.createElement('optgroup');
            oaiproGroup.label = 'OAIPro Models';
            
            // 如果存在自定义选择器，创建组
            if (customSelect) {
                const group = document.createElement('div');
                group.className = 'option-group';
                
                const label = document.createElement('div');
                label.className = 'group-label';
                label.textContent = 'OpenAI and Anthropic Models';
                group.appendChild(label);
                
                models.oaipro.models.forEach(model => {
                    // 创建原始option
                    const option = document.createElement('option');
                    option.setAttribute('data-model-icon', 'oaipro');
                    option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        option.setAttribute('data-reasoner', model.reasoner);
                    }
                    option.value = model.id;
                    option.textContent = `${model.name} - ${model.description}`;
                    oaiproGroup.appendChild(option);
                    
                    // 创建自定义选项
                    const item = document.createElement('div');
                    item.className = 'option-item';
                    item.textContent = `${model.name} - ${model.description}`;
                    item.setAttribute('data-value', model.id);
                    item.setAttribute('data-model-icon', 'oaipro');
                    item.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        item.setAttribute('data-reasoner', model.reasoner);
                    }
                    
                    item.addEventListener('click', () => {
                        const allItems = customSelect.querySelectorAll('.option-item');
                        allItems.forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        const selectedText = customSelect.querySelector('.selected-text');
                        selectedText.textContent = item.textContent;
                        
                        select.value = model.id;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                        
                        customSelect.classList.remove('open');
                    });
                    
                    group.appendChild(item);
                });
                
                customSelect.querySelector('.select-options').appendChild(group);
            }
            
            select.appendChild(oaiproGroup);
        }
        //添加yunwu模型组
        if (models.yunwu && models.yunwu.models.length > 0) {
            const yunwuGroup = document.createElement('optgroup');
            yunwuGroup.label = 'Yunwu Models';
            
            // 如果存在自定义选择器，创建组
            if (customSelect) {
                const group = document.createElement('div');
                group.className = 'option-group';
                
                const label = document.createElement('div');
                label.className = 'group-label';
                label.textContent = 'OpenAI and Anthropic Models';
                group.appendChild(label);
                
                models.yunwu.models.forEach(model => {
                    // 创建原始option
                    const option = document.createElement('option');
                    option.setAttribute('data-model-icon', 'yunwu');
                    option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        option.setAttribute('data-reasoner', model.reasoner);
                    }
                    option.value = model.id;
                    option.textContent = `${model.name} - ${model.description}`;
                    yunwuGroup.appendChild(option);
                    
                    // 创建自定义选项
                    const item = document.createElement('div');
                    item.className = 'option-item';
                    item.textContent = `${model.name} - ${model.description}`;
                    item.setAttribute('data-value', model.id);
                    item.setAttribute('data-model-icon', 'yunwu');
                    item.setAttribute('data-max-output-tokens', model.max_output_tokens);
                    // 添加reasoner属性，如果存在
                    if (model.reasoner !== undefined) {
                        item.setAttribute('data-reasoner', model.reasoner);
                    }
                    
                    item.addEventListener('click', () => {
                        const allItems = customSelect.querySelectorAll('.option-item');
                        allItems.forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        
                        const selectedText = customSelect.querySelector('.selected-text');
                        selectedText.textContent = item.textContent;
                        
                        select.value = model.id;
                        const event = new Event('change');
                        select.dispatchEvent(event);
                        
                        customSelect.classList.remove('open');
                    });
                    
                    group.appendChild(item);
                });
                
                customSelect.querySelector('.select-options').appendChild(group);
            }
            
            select.appendChild(yunwuGroup);
        }
        
                    
        
        // 设置默认选中的模型
        select.value = 'gemini-2.5-pro-exp-03-25';
        
        // 如果存在自定义选择器，更新选中的文本
        if (customSelect) {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption) {
                const selectedText = customSelect.querySelector('.selected-text');
                selectedText.textContent = selectedOption.textContent;
                
                const selectedItem = customSelect.querySelector(`[data-value="${selectedOption.value}"]`);
                if (selectedItem) {
                    const allItems = customSelect.querySelectorAll('.option-item');
                    allItems.forEach(i => i.classList.remove('selected'));
                    selectedItem.classList.add('selected');
                }
            }
        }
        
        // 触发change事件
        const event = new Event('change');
        select.dispatchEvent(event);
        
    } catch (error) {
        console.error('获取模型列表失败:', error);
    }
}

// 创建自定义下拉菜单
function createCustomSelect(select) {
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    
    // 创建触发器
    const trigger = document.createElement('div');
    trigger.className = 'select-trigger';
    
    // 创建选中文本
    const selectedText = document.createElement('span');
    selectedText.className = 'selected-text';
    selectedText.textContent = select.options[select.selectedIndex]?.textContent || '选择模型...';
    
    // 创建箭头
    const arrow = document.createElement('div');
    arrow.className = 'select-arrow';
    arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
        <path fill="#666" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
    </svg>`;
    
    trigger.appendChild(selectedText);
    trigger.appendChild(arrow);
    
    // 创建选项容器
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'select-options';
    
    // 将选项组添加到容器
    Array.from(select.children).forEach(child => {
        if (child.tagName === 'OPTGROUP') {
            const group = document.createElement('div');
            group.className = 'option-group';
            
            const label = document.createElement('div');
            label.className = 'group-label';
            label.textContent = child.label;
            group.appendChild(label);
            
            Array.from(child.children).forEach(option => {
                const item = document.createElement('div');
                item.className = 'option-item';
                item.textContent = option.textContent;
                item.setAttribute('data-value', option.value);
                item.setAttribute('data-model-icon', option.getAttribute('data-model-icon'));
                item.setAttribute('data-max-output-tokens', option.getAttribute('data-max-output-tokens'));
                
                if (option.selected) {
                    item.classList.add('selected');
                    selectedText.textContent = option.textContent;
                }
                
                item.addEventListener('click', () => {
                    // 更新选中状态
                    const allItems = optionsContainer.querySelectorAll('.option-item');
                    allItems.forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    
                    // 更新显示文本
                    selectedText.textContent = item.textContent;
                    
                    // 更新原始select的值
                    select.value = item.getAttribute('data-value');
                    
                    // 触发change事件
                    const event = new Event('change');
                    select.dispatchEvent(event);
                    
                    // 关闭下拉菜单
                    customSelect.classList.remove('open');
                });
                
                group.appendChild(item);
            });
            
            optionsContainer.appendChild(group);
        }
    });
    
    customSelect.appendChild(trigger);
    customSelect.appendChild(optionsContainer);
    
    // 点击触发器时切换下拉菜单
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });
    
    // 点击外部时关闭下拉菜单
    document.addEventListener('click', () => {
        customSelect.classList.remove('open');
    });
    
    return customSelect;
}

// 初始化自定义下拉菜单
function initializeCustomSelect() {
    const select = document.getElementById('model-select');
    if (!select) return;
    
    const customSelect = createCustomSelect(select);
    select.parentNode.insertBefore(customSelect, select);
}

// 在文件加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeCustomSelect();
});
