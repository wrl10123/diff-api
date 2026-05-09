"""
配置管理模块 - 使用环境变量管理敏感配置
"""
import os
from pathlib import Path


def get_env(key: str, default: str = None, required: bool = False) -> str:
    """获取环境变量"""
    value = os.environ.get(key, default)
    if required and not value:
        raise ValueError(f"环境变量 {key} 未设置")
    return value


def get_bool(key: str, default: bool = False) -> bool:
    """获取布尔类型环境变量"""
    value = os.environ.get(key, '').lower()
    if value in ('true', '1', 'yes', 'on'):
        return True
    if value in ('false', '0', 'no', 'off'):
        return False
    return default


def get_int(key: str, default: int = 0) -> int:
    """获取整数类型环境变量"""
    value = os.environ.get(key)
    if value:
        try:
            return int(value)
        except ValueError:
            pass
    return default


class Config:
    """基础配置"""
    SECRET_KEY = get_env('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # 数据库配置
    DB_HOST = get_env('DB_HOST', '127.0.0.1')
    DB_PORT = get_int('DB_PORT', 3306)
    DB_USER = get_env('DB_USER', 'root')
    DB_PASSWORD = get_env('DB_PASSWORD', '')
    DB_NAME = get_env('DB_NAME', 'diffapi')
    
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = True
    
    # 应用配置
    DEBUG = get_bool('DEBUG', True)
    HOST = get_env('HOST', '127.0.0.1')
    PORT = get_int('PORT', 5000)
    
    # 请求超时
    REQUEST_TIMEOUT = get_int('REQUEST_TIMEOUT', 30)


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True


class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    
    @property
    def SECRET_KEY(self):
        key = get_env('SECRET_KEY', required=True)
        return key


class TestingConfig(Config):
    """测试环境配置"""
    TESTING = True


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}


def get_config() -> Config:
    """根据环境获取配置"""
    env = get_env('FLASK_ENV', 'development')
    return config_by_name.get(env, DevelopmentConfig)()
