/**
 * PWA增强功能 - 自定义启动屏和安装横幅
 */

// 立即执行函数，避免全局变量污染
(function() {
    // 检测是否为Android设备
    const isAndroid = /Android/.test(navigator.userAgent);
    
    // 检测是否为PWA模式（独立窗口模式）
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone || // iOS Safari
                  document.referrer.includes('android-app://');
    
    // 判断是否应该显示启动屏
    // 仅在非PWA模式下显示，避免已安装的PWA每次都显示启动屏
    const shouldShowSplash = !isPWA && !sessionStorage.getItem('splashShown');
    
    /**
     * 创建并显示启动屏
     */
    function createSplashScreen() {
        console.log('创建启动屏');
        
        // 创建启动屏容器
        const splashScreen = document.createElement('div');
        splashScreen.id = 'pwa-splash-screen';
        
        // 添加与iOS相同的启动背景
        const background = document.createElement('div');
        background.className = 'splash-background';
        splashScreen.appendChild(background);
        
        // 添加应用Logo
        const logo = document.createElement('img');
        logo.className = 'splash-logo';
        logo.src = '/static/icons/pwa/icon-192x192.png'; // 使用您的应用图标
        logo.alt = 'App Logo';
        splashScreen.appendChild(logo);
        
        // 添加加载动画
        const loader = document.createElement('div');
        loader.className = 'splash-loader';
        splashScreen.appendChild(loader);
        
        // 添加到页面
        document.body.appendChild(splashScreen);
        
        // 记录已显示启动屏
        sessionStorage.setItem('splashShown', 'true');
        
        // 在应用加载完成后淡出启动屏
        window.addEventListener('load', function() {
            // 延迟一点时间，确保应用已准备好
            setTimeout(() => {
                splashScreen.style.opacity = '0';
                
                // 完全淡出后移除元素
                setTimeout(() => {
                    if (document.body.contains(splashScreen)) {
                        document.body.removeChild(splashScreen);
                    }
                }, 500); // 与CSS过渡时间匹配
            }, 1000); // 启动屏显示至少1秒
        });
    }
    
    /**
     * 创建PWA安装横幅
     */
    function createInstallBanner() {
        console.log('准备安装横幅');
        
        // 存储install prompt事件
        let deferredPrompt;
        
        // 监听beforeinstallprompt事件
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('检测到安装机会');
            // 阻止Chrome自动显示的安装提示
            e.preventDefault();
            // 存储事件以便稍后使用
            deferredPrompt = e;
            
            // 如果我们已经存储了用户的首选项不再显示，则退出
            if (localStorage.getItem('installBannerDismissed')) {
                return;
            }
            
            // 等待页面完全加载再显示横幅
            window.addEventListener('load', () => {
                setTimeout(() => {
                    // 创建安装横幅HTML
                    const banner = document.createElement('div');
                    banner.className = 'pwa-install-banner';
                    banner.innerHTML = `
                        <div class="banner-icon">
                            <img src="/static/icons/pwa/icon-192x192.png" alt="App Icon">
                        </div>
                        <div class="banner-text">
                            <h3>安装AI助手</h3>
                            <p>添加到主屏幕，随时随地使用</p>
                        </div>
                        <div class="banner-actions">
                            <button class="install-btn" id="pwa-install-btn">安装</button>
                            <button class="dismiss-btn" id="pwa-dismiss-btn">稍后</button>
                        </div>
                    `;
                    
                    // 添加到页面
                    document.body.appendChild(banner);
                    
                    // 设置动画延迟显示
                    setTimeout(() => {
                        banner.classList.add('visible');
                    }, 500);
                    
                    // 添加安装按钮点击事件
                    document.getElementById('pwa-install-btn').addEventListener('click', () => {
                        // 隐藏横幅
                        banner.classList.remove('visible');
                        
                        // 触发安装提示
                        deferredPrompt.prompt();
                        
                        // 等待用户响应
                        deferredPrompt.userChoice.then((choiceResult) => {
                            if (choiceResult.outcome === 'accepted') {
                                console.log('用户接受安装');
                            } else {
                                console.log('用户拒绝安装');
                            }
                            // 不管用户如何选择，清除deferredPrompt
                            deferredPrompt = null;
                            
                            // 延迟后移除横幅
                            setTimeout(() => {
                                if (document.body.contains(banner)) {
                                    document.body.removeChild(banner);
                                }
                            }, 300);
                        });
                    });
                    
                    // 添加关闭按钮点击事件
                    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
                        // 隐藏横幅
                        banner.classList.remove('visible');
                        
                        // 记住用户选择
                        localStorage.setItem('installBannerDismissed', 'true');
                        
                        // 延迟后移除横幅
                        setTimeout(() => {
                            if (document.body.contains(banner)) {
                                document.body.removeChild(banner);
                            }
                        }, 300);
                    });
                }, 3000); // 页面加载3秒后显示
            });
        });
        
        // 检测已安装事件
        window.addEventListener('appinstalled', (evt) => {
            console.log('应用已安装');
            // 可以在这里添加安装成功后的逻辑
        });
    }
    
    // 初始化函数
    function init() {
        // 1. 如果需要，显示启动屏
        if (shouldShowSplash) {
            createSplashScreen();
        }
        
        // 2. 设置安装横幅
        if (isAndroid) {
            createInstallBanner();
        }
    }
    
    // 当DOM内容加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(); 