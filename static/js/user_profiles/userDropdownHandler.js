import { showToast } from '../utils/toast.js';
import { ProfileRenderer } from './profileRenderer.js';

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

// 用户配置初始化函数
export async function initializeUserProfile() {
    const userProfileBtn = document.querySelector('.user-profile-btn');
    const profileDropdown = document.querySelector('.profile-dropdown');
    const profileIcon = document.querySelector('.user-profile-btn img');

    if (!userProfileBtn || !profileDropdown || !profileIcon) {
        console.error('找不到用户配置相关的DOM元素');
        return;
    }

    // 获取并显示用户头像
    const profileIconData = await fetchProfileIcon();
    await updateProfileIcon(profileIconData);

    let isDropdownVisible = false;

    // 切换下拉菜单显示状态
    userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isDropdownVisible = !isDropdownVisible;
        
        if (isDropdownVisible) {
            profileDropdown.style.display = 'block';
            // 使用 requestAnimationFrame 确保 display 更改已经生效
            requestAnimationFrame(() => {
                profileDropdown.classList.add('show');
            });
        } else {
            hideDropdown();
        }
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        if (isDropdownVisible) {
            hideDropdown();
        }
    });

    // 隐藏下拉菜单的函数
    function hideDropdown() {
        isDropdownVisible = false;
        profileDropdown.classList.remove('show');
        // 等待动画完成后隐藏
        setTimeout(() => {
            if (!isDropdownVisible) { // 再次检查，避免用户快速点击导致的问题
                profileDropdown.style.display = 'none';
            }
        }, 200); // 与 CSS 动画时长匹配
    }

    // 阻止下拉菜单内部点击事件冒泡
    profileDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // 处理下拉菜单项点击
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', async () => {
            const action = item.getAttribute('data-action');
            try {
                switch (action) {
                    case 'profile':
                        await handleProfile();
                        break;
                    case 'settings':
                        await handleSettings();
                        break;
                    case 'logout':
                        await handleLogout();
                        break;
                }
            } catch (error) {
                console.error('处理用户操作时出错:', error);
                showToast('操作失败，请重试', 'error');
            }
            hideDropdown();
        });
    });
}

// 处理个人档案
async function handleProfile() {
    try {
        const profileRenderer = new ProfileRenderer();
        await profileRenderer.showProfileModal();
    } catch (error) {
        console.error('打开个人资料失败:', error);
        showToast('无法打开个人资料，请稍后重试', 'error');
    }
}

// 处理设置
async function handleSettings() {
    try {
        const response = await fetch('/settings');
        if (response.ok) {
            window.location.href = '/settings';
        } else {
            throw new Error('无法访问设置页面');
        }
    } catch (error) {
        console.error('访问设置页面失败:', error);
        showToast('无法访问设置页面，请稍后重试', 'error');
    }
}

// 处理退出登录
async function handleLogout() {
    if (await confirmLogout()) {
        try {
            // 直接使用 GET 请求访问 /logout 路由
            window.location.href = '/logout';
        } catch (error) {
            console.error('退出登录失败:', error);
            showToast('退出登录失败，请重试', 'error');
        }
    }
}

// 确认退出登录
function confirmLogout() {
    return new Promise((resolve) => {
        const result = confirm('确定要退出登录吗？');
        resolve(result);
    });
}