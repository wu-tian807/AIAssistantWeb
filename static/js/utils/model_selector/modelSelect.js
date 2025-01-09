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

export function updateModelSelect(modelId,modelSelect) {
    if (modelSelect) {
        modelSelect.value = modelId;
        // 触发 change 事件以更新图标
        const event = new Event('change');
        modelSelect.dispatchEvent(event);
    }
}

// 获取可用模型列表
export async function fetchModels() {
    try {
        const response = await fetch('/api/models');
        const models = await response.json();
        console.log('Received models from backend:', models);
        const select = document.getElementById('model-select');
        
        // 清空现有选项
        select.innerHTML = '<option value="" disabled selected>选择模型...</option>';
        
        // 添加xAI模型组
        if (models.xai && models.xai.models.length > 0) {
            const xaiGroup = document.createElement('optgroup');
            xaiGroup.label = 'xAI Models';
            models.xai.models.forEach(model => {
                const option = document.createElement('option');
                option.setAttribute('data-model-icon', 'xai');
                option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                option.value = model.id;
                option.textContent = `${model.name} - ${model.description}`;
                
                console.log('xAI option created:', {
                    html: option.outerHTML,
                    attributes: Array.from(option.attributes),
                    max_output_tokens: model.max_output_tokens
                });
                
                xaiGroup.appendChild(option);
            });
            select.appendChild(xaiGroup);
        }
        
        // 添加Google模型组
        if (models.google && models.google.models.length > 0) {
            const googleGroup = document.createElement('optgroup');
            googleGroup.label = 'Google Models';
            models.google.models.forEach(model => {
                const option = document.createElement('option');
                option.setAttribute('data-model-icon', 'google');
                option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                option.value = model.id;
                option.textContent = `${model.name} - ${model.description}`;
                
                console.log('Google option created:', {
                    html: option.outerHTML,
                    attributes: Array.from(option.attributes),
                    max_output_tokens: model.max_output_tokens
                });
                
                googleGroup.appendChild(option);
            });
            select.appendChild(googleGroup);
        }

        // 添加DeepSeek模型组
        if (models.deepseek && models.deepseek.models.length > 0) {
            const deepseekGroup = document.createElement('optgroup');
            deepseekGroup.label = 'DeepSeek Models';
            models.deepseek.models.forEach(model => {
                const option = document.createElement('option');
                option.setAttribute('data-model-icon', 'deepseek');
                option.setAttribute('data-max-output-tokens', model.max_output_tokens);
                option.value = model.id;
                option.textContent = `${model.name} - ${model.description}`;
                
                console.log('DeepSeek option created:', {
                    html: option.outerHTML,
                    attributes: Array.from(option.attributes),
                    max_output_tokens: model.max_output_tokens
                });
                
                deepseekGroup.appendChild(option);
            });
            select.appendChild(deepseekGroup);
        }
        
        // 在添加完所有选项后验证
        console.log('All options:', Array.from(select.getElementsByTagName('option')).map(opt => ({
            value: opt.value,
            modelIcon: opt.getAttribute('data-model-icon'),
            maxOutputTokens: opt.getAttribute('data-max-output-tokens'),
            html: opt.outerHTML
        })));
        
        // 设置默认选中的模型
        select.value = 'grok-2-vision-1212';
        
        // 触发 change 事件以更新设置
        const event = new Event('change');
        select.dispatchEvent(event);
    } catch (error) {
        console.error('获取模型列表失败:', error);
    }
}
