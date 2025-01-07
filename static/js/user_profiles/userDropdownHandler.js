import { showToast } from '../utils/toast.js';
import { SettingsRenderer } from './settingsRenderer.js';
import { ProfileRenderer } from './profileRenderer.js';

// 创建一个单例的设置渲染器
let settingsRendererInstance = null;

// 获取用户头像
async function fetchProfileIcon() {
    try {
        const response = await fetch('/api/user/profile_icon');
        if (!response.ok) {
            throw new Error('获取头像失败');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('获取头像失败:', error);
        showToast('获取头像失败，使用默认头像', 'error');
        return null;
    }
}

// 更新头像显示
async function updateProfileIcon(profileIcon) {
    const imgElement = document.querySelector('.user-profile-btn img');
    if (!imgElement) {
        showToast('找不到头像元素', 'error');
        console.error('找不到头像元素');
        return;
    }

    if (profileIcon && profileIcon.icon_base64) {
        imgElement.src = `data:image/png;base64,${profileIcon.icon_base64}`;
    } else {
        // 使用默认头像
        imgElement.src = '/static/icons/users/default_profile.svg';
    }
}

// 在文件开头添加主题初始化函数
export async function initializeTheme() {
    try {
        // 首先检查本地存储中的主题设置
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        } else {
            // 如果本地没有设置，从服务器获取
            const response = await fetch('/api/user/settings/dark_theme');
            if (response.ok) {
                const data = await response.json();
                document.body.classList.toggle('dark-theme', data.dark_theme);
                localStorage.setItem('theme', data.dark_theme ? 'dark' : 'light');
            }
        }
    } catch (error) {
        console.error('初始化主题设置失败:', error);
    }
}

// 导出初始化函数
export async function initializeUserProfile() {
    try {
        // 获取并更新头像
        const profileIcon = await fetchProfileIcon();
        await updateProfileIcon(profileIcon);

        // 初始化主题
        await initializeTheme();

        // 添加用户下拉菜单事件监听器
        const userProfileBtn = document.querySelector('.user-profile-btn');
        const profileDropdown = document.querySelector('.profile-dropdown');

        if (userProfileBtn && profileDropdown) {
            userProfileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            });

            // 点击其他地方关闭下拉菜单
            document.addEventListener('click', () => {
                if (profileDropdown.classList.contains('show')) {
                    profileDropdown.classList.remove('show');
                }
            });

            // 设置按钮点击事件
            const settingsBtn = document.querySelector('[data-action="settings"]');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', async () => {
                    if (!settingsRendererInstance) {
                        settingsRendererInstance = new SettingsRenderer();
                    }
                    await settingsRendererInstance.initialize();
                });
            }

            // 个人资料按钮点击事件
            const profileBtn = document.querySelector('[data-action="profile"]');
            if (profileBtn) {
                profileBtn.addEventListener('click', async () => {
                    const profileRenderer = new ProfileRenderer();
                    await profileRenderer.showProfileModal();
                });
            }

            // 退出登录按钮点击事件
            const logoutBtn = document.querySelector('[data-action="logout"]');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    if (confirm('确定要退出登录吗？')) {
                        window.location.href = '/logout';
                    }
                });
            }
        }
    } catch (error) {
        console.error('初始化用户配置失败:', error);
        showToast('初始化用户配置失败', 'error');
    }
}