# gunicorn.conf.py
import multiprocessing

# 监听地址和端口
bind = "0.0.0.0:8000"

# 优化工作进程数，考虑到4核CPU
workers = 4  # 4核CPU，每核1个worker

# 工作模式改为gevent，更适合长连接场景
worker_class = "gevent"
worker_connections = 1000

# 超时设置
timeout = 300

# 进程名称前缀
proc_name = "ai_chat_app"

# 访问日志和错误日志
accesslog = "logs/access.log"
errorlog = "logs/error.log"
loglevel = "info"

# 后台运行
daemon = True

# 优化重启设置
graceful_timeout = 120
keepalive = 5

# 限制请求大小（100MB）
limit_request_line = 0
limit_request_fields = 100
limit_request_field_size = 0

# 优化缓冲区
forwarded_allow_ips = '*' 