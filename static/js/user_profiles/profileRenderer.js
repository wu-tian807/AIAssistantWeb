import { showToast } from '../utils/toast.js';

export class ProfileRenderer {
    constructor() {
        this.modal = null;
        this.profileForm = null;
        this.imagePreview = null;
        this.selectedFile = null;
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    }

    async showProfileModal() {
        // 创建模态窗口
        this.modal = document.createElement('div');
        this.modal.className = 'profile-modal';
        
        // 创建模态窗口内容
        const modalContent = document.createElement('div');
        modalContent.className = 'profile-modal-content';
        
        // 添加标题
        const title = document.createElement('h2');
        title.textContent = '个人资料设置';
        modalContent.appendChild(title);
        
        // 创建表单
        this.profileForm = document.createElement('form');
        this.profileForm.className = 'profile-form';
        // 阻止表单默认提交行为
        this.profileForm.onsubmit = (e) => {
            e.preventDefault();
            return false;
        };
        
        // 添加头像预览和上传区域
        const avatarSection = document.createElement('div');
        avatarSection.className = 'avatar-section';
        
        this.imagePreview = document.createElement('img');
        this.imagePreview.className = 'profile-avatar-preview';
        this.imagePreview.src = '/static/icons/users/default_profile.svg';
        
        // 获取当前头像
        try {
            const response = await fetch('/api/user/profile_icon');
            if (response.ok) {
                const data = await response.json();
                if (data.icon_base64) {
                    this.imagePreview.src = `data:image/png;base64,${data.icon_base64}`;
                }
            }
        } catch (error) {
            console.error('获取头像失败:', error);
        }
        
        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';  // 确保类型是 button
        uploadButton.className = 'upload-avatar-btn';
        uploadButton.textContent = '更换头像';
        uploadButton.onclick = () => this.selectFile();
        
        avatarSection.appendChild(this.imagePreview);
        avatarSection.appendChild(uploadButton);
        
        // 添加用户名输入
        const nameSection = document.createElement('div');
        nameSection.className = 'name-section';
        
        const nameLabel = document.createElement('label');
        nameLabel.textContent = '显示名称';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'display-name-input';
        nameInput.placeholder = '请输入显示名称';
        // 处理回车键事件
        nameInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveProfile(nameInput.value);
                return false;
            }
        };
        
        // 获取当前用户名
        try {
            const response = await fetch('/api/user/display_name');
            if (response.ok) {
                const data = await response.json();
                nameInput.value = data.display_name || '';
            }
        } catch (error) {
            console.error('获取用户名失败:', error);
        }
        
        nameSection.appendChild(nameLabel);
        nameSection.appendChild(nameInput);
        
        // 添加按钮区域
        const buttonSection = document.createElement('div');
        buttonSection.className = 'button-section';
        
        const saveButton = document.createElement('button');
        saveButton.type = 'button';  // 确保类型是 button
        saveButton.className = 'save-profile-btn';
        saveButton.textContent = '保存';
        saveButton.onclick = () => this.saveProfile(nameInput.value);
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';  // 确保类型是 button
        cancelButton.className = 'cancel-profile-btn';
        cancelButton.textContent = '取消';
        cancelButton.onclick = () => this.closeModal();
        
        buttonSection.appendChild(saveButton);
        buttonSection.appendChild(cancelButton);
        
        // 组装表单
        this.profileForm.appendChild(avatarSection);
        this.profileForm.appendChild(nameSection);
        this.profileForm.appendChild(buttonSection);
        
        modalContent.appendChild(this.profileForm);
        this.modal.appendChild(modalContent);
        
        // 添加到页面
        document.body.appendChild(this.modal);
        
        // 添加点击外部关闭功能
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }

    selectFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => this.handleFileSelect(e);
        input.click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件', 'error');
            return;
        }

        // 验证文件大小（5MB）
        if (file.size > 5 * 1024 * 1024) {
            showToast('图片大小不能超过5MB', 'error');
            return;
        }

        this.selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imagePreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async saveProfile(displayName) {
        try {
            const saveButton = this.profileForm.querySelector('.save-profile-btn');
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';

            // 保存头像
            if (this.selectedFile) {
                const formData = new FormData();
                formData.append('icon', this.selectedFile);

                const response = await fetch('/api/user/upload_profile_icon', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': this.csrfToken || ''
                    },
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || '上传头像失败');
                }

                // 获取新的头像数据
                const iconData = await response.json();
                if (iconData.icon_base64) {
                    // 更新所有页面上的用户头像
                    const userIcons = document.querySelectorAll('.user-profile-btn img');
                    userIcons.forEach(icon => {
                        icon.src = `data:image/png;base64,${iconData.icon_base64}`;
                    });
                }
            }

            // 保存显示名称
            const nameResponse = await fetch('/api/user/display_name', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken || ''
                },
                body: JSON.stringify({ display_name: displayName })
            });

            if (!nameResponse.ok) {
                const errorData = await nameResponse.json();
                throw new Error(errorData.error || '保存显示名称失败');
            }

            // 获取更新后的显示名称
            const nameData = await nameResponse.json();
            console.log('显示名称更新成功:', nameData);

            // 更新页面上的显示名称（如果有显示的话）
            const displayNameElements = document.querySelectorAll('.user-display-name');
            displayNameElements.forEach(element => {
                element.textContent = nameData.display_name || '';
            });

            showToast('保存成功');
            this.closeModal();

        } catch (error) {
            console.error('保存失败:', error);
            showToast(error.message || '保存失败，请重试', 'error');
        } finally {
            const saveButton = this.profileForm.querySelector('.save-profile-btn');
            saveButton.disabled = false;
            saveButton.textContent = '保存';
        }
    }

    closeModal() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
    }
}
