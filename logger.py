"""
日志配置模块
"""
import os
import time
import logging
from logging.handlers import RotatingFileHandler
from flask import request, g, jsonify


def setup_logging(app):
    """配置应用日志"""
    log_level = logging.DEBUG if app.debug else logging.INFO
    
    # 日志目录
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # 清除现有处理器
    app.logger.handlers.clear()
    
    # 文件处理器 - 按大小轮转
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'app.log'),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    ))
    
    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s: %(message)s'
    ))
    
    # 添加处理器
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(log_level)
    
    # 请求日志中间件
    @app.before_request
    def before_request():
        if not request.path.startswith('/static'):
            g.start_time = time.time()
            app.logger.debug(f'--> {request.method} {request.path}')
    
    @app.after_request
    def after_request(response):
        if not request.path.startswith('/static'):
            duration = time.time() - g.get('start_time', time.time())
            app.logger.debug(f'<-- {request.method} {request.path} {response.status_code} ({duration*1000:.0f}ms)')
        return response
    
    # 全局异常处理
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error(f'Unhandled exception: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': '服务器内部错误'}), 500
    
    app.logger.info('Application logging configured')