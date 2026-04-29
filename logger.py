"""
日志配置模块
"""
import os
import time
import logging
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from flask import request, g, jsonify
from werkzeug.exceptions import HTTPException


def setup_logging(app):
    """配置应用日志"""
    log_level = logging.DEBUG if app.debug else logging.INFO
    
    # 日志目录
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # 清除现有处理器
    app.logger.handlers.clear()
    
    # 日志文件路径
    log_file = os.path.join(log_dir, f'app-{datetime.now().strftime("%Y-%m-%d")}.log')
    
    # 确保文件存在
    if not os.path.exists(log_file):
        open(log_file, 'w', encoding='utf-8').close()
    
    # 文件处理器 - 按日期命名
    file_handler = TimedRotatingFileHandler(
        log_file,
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    file_handler.suffix = '%Y-%m-%d.log'
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
    
    # 添加处理器到app.logger
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(log_level)
    
    # 配置 root logger，让所有模块都能使用
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    root_logger.setLevel(log_level)
    
    # 配置 SQLAlchemy SQL 日志输出到文件
    # sqlalchemy_logger = logging.getLogger('sqlalchemy.engine')
    # sqlalchemy_logger.handlers.clear()
    # sqlalchemy_logger.addHandler(file_handler)
    # sqlalchemy_logger.setLevel(logging.INFO)
    # sqlalchemy_logger.propagate = False
    
    # 请求日志中间件
    @app.before_request
    def before_request():
        if not request.path.startswith('/static') and not request.path.startswith('/@') and request.path != '/favicon.ico':
            g.start_time = time.time()
            app.logger.debug(f'--> {request.method} {request.path}')
    
    @app.after_request
    def after_request(response):
        if not request.path.startswith('/static') and not request.path.startswith('/@') and request.path != '/favicon.ico':
            duration = time.time() - g.get('start_time', time.time())
            app.logger.debug(f'<-- {request.method} {request.path} {response.status_code} ({duration*1000:.0f}ms)')
        return response
    
    # 全局异常处理
    @app.errorhandler(Exception)
    def handle_exception(e):
        if request.path.startswith('/@'):
            return jsonify({'success': False, 'error': 'Not found'}), 404
        if isinstance(e, HTTPException):
            return e
        app.logger.error(f'Unhandled exception: {str(e)}', exc_info=True)
        return jsonify({'success': False, 'error': '服务器内部错误'}), 500
    
    app.logger.info('Application logging configured')