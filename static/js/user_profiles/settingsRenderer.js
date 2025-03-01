import { showToast } from '../utils/toast.js';

export class SettingsRenderer {
    constructor() {
        this.currentSection = 'general';
        this.settings = null;  // 初始化为 null，等待从服务器加载
    }

    async initialize() {
        try {
            // 先加载设置
            await this.loadSettings();
            // 确保设置加载完成后再创建和渲染模态框
            if (this.settings) {
                // 创建新的模态框
                this.createModal();
                this.render();
                this.attachEventListeners();
                // 显示模态框
                this.showModal();
            } else {
                showToast('加载设置失败', 'error');
            }
        } catch (error) {
            console.error('初始化设置失败:', error);
            showToast('初始化设置失败', 'error');
        }
    }

    createModal() {
        // 如果已经存在模态框，先移除
        if (this.modalContainer && this.modalContainer.parentNode) {
            document.body.removeChild(this.modalContainer);
        }

        // 创建模态框容器
        this.modalContainer = document.createElement('div');
        this.modalContainer.className = 'settings-modal';
        this.modalContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // 创建模态框内容容器
        this.container = document.createElement('div');
        this.container.className = 'settings-container';
        this.container.style.cssText = `
            background: var(--bg-color, #ffffff);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            width: 80%;
            max-width: 900px;
            height: 80%;
            max-height: 600px;
            position: relative;
            transform: translateY(-20px);
            opacity: 0;
            transition: all 0.3s ease;
        `;

        // 添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.className = 'settings-close-btn';
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-color);
            z-index: 1;
            padding: 5px 10px;
            border-radius: 4px;
        `;
        closeButton.addEventListener('click', () => this.closeModal());

        this.container.appendChild(closeButton);
        this.modalContainer.appendChild(this.container);
        document.body.appendChild(this.modalContainer);
    }

    showModal() {
        // 显示模态框时的动画
        requestAnimationFrame(() => {
            this.modalContainer.style.opacity = '1';
            this.container.style.transform = 'translateY(0)';
            this.container.style.opacity = '1';
        });

        // 添加ESC键关闭功能
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        // 点击背景关闭
        this.modalContainer.addEventListener('click', (e) => {
            if (e.target === this.modalContainer) {
                this.closeModal();
            }
        });
    }

    closeModal() {
        // 关闭模态框时的动画
        this.container.style.transform = 'translateY(-20px)';
        this.container.style.opacity = '0';
        this.modalContainer.style.opacity = '0';

        // 移除事件监听器
        document.removeEventListener('keydown', this.escHandler);

        // 动画结束后移除模态框元素，但保留实例
        setTimeout(() => {
            if (this.modalContainer && this.modalContainer.parentNode) {
                document.body.removeChild(this.modalContainer);
            }
            // 不重置 this.settings，保持状态
        }, 300);
    }

    async loadSettings() {
        try {
            // 初始化设置对象
            this.settings = {
                image_compression: false,
                dark_theme: false,
                enable_ocr: true
            };

            // 加载图片压缩设置
            const compressionResponse = await fetch('/api/user/settings/image_compression');
            if (compressionResponse.ok) {
                const data = await compressionResponse.json();
                this.settings.image_compression = data.image_compression;
            }

            // 加载夜间主题设置
            const themeResponse = await fetch('/api/user/settings/dark_theme');
            if (themeResponse.ok) {
                const data = await themeResponse.json();
                this.settings.dark_theme = data.dark_theme;
                // 应用主题设置
                document.body.classList.toggle('dark-theme', this.settings.dark_theme);
                // 保存主题设置到本地存储，用于页面加载时立即应用
                localStorage.setItem('theme', this.settings.dark_theme ? 'dark' : 'light');
            }
            
            // 加载OCR功能设置
            const ocrResponse = await fetch('/api/user/settings/ocr_model');
            if (ocrResponse.ok) {
                const data = await ocrResponse.json();
                this.settings.enable_ocr = data.enable_ocr;
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            showToast('加载设置失败', 'error');
            this.settings = null;
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="settings-content-wrapper" style="height: 100%; overflow: hidden; display: flex;">
                <div class="settings-sidebar">
                    <ul class="settings-menu">
                        <li class="settings-menu-item active" data-section="general">
                            通用设置
                        </li>
                        <li class="settings-menu-item" data-section="model-features">
                            模型功能
                        </li>
                    </ul>
                </div>
                <div class="settings-content">
                    <div class="settings-section" id="general-settings" style="display: block;">
                        <h2>通用设置</h2>
                        <div class="setting-item">
                            <div class="setting-label">
                                <div>图片压缩上传</div>
                                <div class="setting-description">自动压缩图片，可以加快上传速度</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="image-compression-toggle" 
                                       ${this.settings.image_compression ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-label">
                                <div>夜间主题</div>
                                <div class="setting-description">切换深色主题，保护眼睛</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="dark-theme-toggle"
                                       ${this.settings.dark_theme ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-section" id="model-features-settings" style="display: none;">
                        <h2>模型功能</h2>
                        <div class="setting-item">
                            <div class="setting-label">
                                <div>OCR功能</div>
                                <div class="setting-description">开启后，非视觉模型也可以识别图片中的文字</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="ocr-toggle"
                                       ${this.settings.enable_ocr ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // 图片压缩设置切换
        const compressionToggle = document.getElementById('image-compression-toggle');
        if (compressionToggle) {
            compressionToggle.addEventListener('change', async (e) => {
                try {
                    const response = await fetch('/api/user/settings/image_compression', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            image_compression: e.target.checked
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // 更新本地状态
                        this.settings.image_compression = data.image_compression;
                        showToast('图片压缩设置已更新', 'success');
                    } else {
                        throw new Error('更新设置失败');
                    }
                } catch (error) {
                    console.error('更新图片压缩设置失败:', error);
                    showToast('更新设置失败', 'error');
                    // 恢复原状态
                    e.target.checked = !e.target.checked;
                }
            });
        }

        // 夜间主题切换
        const themeToggle = document.getElementById('dark-theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', async (e) => {
                try {
                    const response = await fetch('/api/user/settings/dark_theme', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            dark_theme: e.target.checked
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // 更新本地状态
                        this.settings.dark_theme = data.dark_theme;
                        // 应用主题设置
                        document.body.classList.toggle('dark-theme', data.dark_theme);
                        // 保存主题设置到本地存储
                        localStorage.setItem('theme', data.dark_theme ? 'dark' : 'light');
                        showToast('夜间主题设置已更新', 'success');
                    } else {
                        throw new Error('更新设置失败');
                    }
                } catch (error) {
                    console.error('更新夜间主题设置失败:', error);
                    showToast('更新设置失败', 'error');
                    // 恢复原状态
                    e.target.checked = !e.target.checked;
                    document.body.classList.toggle('dark-theme', !e.target.checked);
                }
            });
        }
        
        // OCR功能切换
        const ocrToggle = document.getElementById('ocr-toggle');
        if (ocrToggle) {
            ocrToggle.addEventListener('change', async (e) => {
                try {
                    const response = await fetch('/api/user/settings/ocr_model', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            enable_ocr: e.target.checked
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // 更新本地状态
                        this.settings.enable_ocr = data.enable_ocr;
                        showToast('OCR功能设置已更新', 'success');
                        
                        // 触发设置更新事件，通知其他组件（如增强视觉分析开关）
                        const settingsEvent = new CustomEvent('settings-updated', {
                            detail: {
                                setting: 'enable_ocr',
                                value: data.enable_ocr
                            }
                        });
                        document.dispatchEvent(settingsEvent);
                    } else {
                        throw new Error('更新设置失败');
                    }
                } catch (error) {
                    console.error('更新OCR功能设置失败:', error);
                    showToast('更新设置失败', 'error');
                    // 恢复原状态
                    e.target.checked = !e.target.checked;
                }
            });
        }

        // 侧边栏菜单项点击
        const menuItems = document.querySelectorAll('.settings-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                menuItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.currentSection = item.dataset.section;
                
                // 显示对应的设置部分，隐藏其他部分
                const sections = document.querySelectorAll('.settings-section');
                sections.forEach(section => {
                    section.style.display = 'none';
                });
                
                const activeSection = document.getElementById(`${this.currentSection}-settings`);
                if (activeSection) {
                    activeSection.style.display = 'block';
                }
            });
        });
    }
}
