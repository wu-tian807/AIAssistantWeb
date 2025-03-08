# gunicorn配置文件
import multiprocessing

# 基本设置
bind = "127.0.0.1:5000"  # 绑定到127.0.0.1:5000
workers = 4  # 设置4个工作进程
timeout = 3600
worker_class = "gevent"  # 使用gevent工作类

# 日志设置
accesslog = "gunicorn_access.log"
errorlog = "gunicorn_error.log"
loglevel = "info"

# Unicode处理设置
worker_tmp_dir = "/dev/shm"  # 使用共享内存提高性能

# 优化设置
worker_connections = 1000
keepalive = 2

# 重启设置
max_requests = 1000
max_requests_jitter = 50
