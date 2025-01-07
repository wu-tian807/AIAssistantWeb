# 部署指南

## 1. 服务器准备
- 推荐配置：
  - CPU: 2核心以上
  - 内存: 4GB以上
  - 硬盘: 40GB以上
  - 操作系统: Ubuntu 20.04/22.04 LTS

## 2. 环境配置
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要的系统包
sudo apt install python3-pip python3-venv nginx redis-server -y

# 创建应用目录
mkdir -p /var/www/ai-chat
cd /var/www/ai-chat

# 克隆代码
git clone https://github.com/your-username/ai-chat-app.git .

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

## 3. 配置文件设置
```bash
# 复制配置模板
cp config.example.py config.py

# 编辑配置文件
nano config.py
```

主要配置项：
- 设置安全的SECRET_KEY
- 配置数据库连接
- 添加邮件服务器信息
- 填写各AI服务的API密钥

## 4. Nginx配置
```bash
# 创建Nginx配置
sudo nano /etc/nginx/sites-available/ai-chat

# 配置内容
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件处理
    location /static {
        alias /var/www/ai-chat/static;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}

# 启用站点
sudo ln -s /etc/nginx/sites-available/ai-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL证书（推荐）
```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d your-domain.com
```

## 6. 启动应用
```bash
# 创建日志目录
mkdir -p logs

# 启动应用
gunicorn -c gunicorn.conf.py app:app

# 检查状态
ps aux | grep gunicorn
```

## 7. 设置开机自启
```bash
# 创建服务文件
sudo nano /etc/systemd/system/ai-chat.service

# 服务配置内容
[Unit]
Description=AI Chat Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/ai-chat
Environment="PATH=/var/www/ai-chat/venv/bin"
ExecStart=/var/www/ai-chat/venv/bin/gunicorn -c gunicorn.conf.py app:app

[Install]
WantedBy=multi-user.target

# 启用服务
sudo systemctl enable ai-chat
sudo systemctl start ai-chat
```

## 8. 维护命令
```bash
# 查看应用状态
sudo systemctl status ai-chat

# 重启应用
sudo systemctl restart ai-chat

# 查看日志
tail -f logs/error.log
tail -f logs/access.log
```

## 9. 注意事项
1. 确保服务器防火墙允许80和443端口
2. 定期备份数据库和用户上传的文件
3. 监控服务器资源使用情况
4. 设置日志轮转防止磁盘占满
5. 定期更新系统和依赖包

## 10. 性能优化建议
1. 启用Redis缓存
2. 配置CDN加速静态资源
3. 启用Nginx缓存
4. 优化数据库查询
5. 使用异步任务处理耗时操作

## 11. 安全建议
1. 使用强密码
2. 定期更新系统和依赖
3. 启用防火墙
4. 设置访问限制
5. 监控异常访问
6. 定期备份数据

## 12. 故障排除
1. 查看应用日志
2. 检查系统日志
3. 监控资源使用
4. 检查网络连接
5. 验证配置文件

如有问题，请查看日志文件或联系技术支持。 