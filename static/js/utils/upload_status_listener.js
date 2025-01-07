// 创建一个立即执行的函数来避免全局变量污染
(() => {
    let eventSource = null;

    function initUploadStatusListener() {
        // 如果已经存在连接，先关闭它
        if (eventSource) {
            eventSource.close();
        }

        // 创建新的 EventSource 连接
        eventSource = new EventSource('/api/upload-status/stream');

        // 处理接收到的消息
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (!data || Object.keys(data).length === 0) {
                    // 心跳包，忽略
                    return;
                }

                console.log('收到上传状态:', data);
                const { action, fileName, fileSize, error, message } = data;

                // 根据不同的动作类型处理状态
                switch (action) {
                    case 'showUploadStart':
                        window.uploadStatusManager.showUploadStart(fileName, fileSize);
                        break;
                    case 'showUploadSuccess':
                        window.uploadStatusManager.showUploadSuccess(message);
                        break;
                    case 'showUploadError':
                        window.uploadStatusManager.showUploadError(error);
                        break;
                }
            } catch (error) {
                console.error('处理上传状态消息出错:', error);
            }
        };

        // 处理错误
        eventSource.onerror = function(error) {
            console.error('上传状态连接错误:', error);
            // 如果连接关闭，尝试重新连接
            if (eventSource.readyState === EventSource.CLOSED) {
                console.log('连接已关闭，5秒后尝试重新连接...');
                setTimeout(initUploadStatusListener, 5000);
            }
        };

        // 处理连接打开
        eventSource.onopen = function() {
            console.log('上传状态连接已建立');
        };
    }

    // 页面加载完成后初始化监听器
    document.addEventListener('DOMContentLoaded', initUploadStatusListener);

    // 页面卸载时关闭连接
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });
})(); 