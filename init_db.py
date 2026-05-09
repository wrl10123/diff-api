"""
数据库初始化脚本
"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()


def init_database():
    """创建数据库和表"""
    # 从环境变量获取数据库配置
    db_host = os.environ.get('DB_HOST', 'localhost')
    db_user = os.environ.get('DB_USER', 'root')
    db_password = os.environ.get('DB_PASSWORD', '')
    db_name = os.environ.get('DB_NAME', 'diffapi')
    
    print(f"📦 使用配置: host={db_host}, user={db_user}, database={db_name}")
    
    # 连接MySQL服务器
    conn = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        charset='utf8mb4'
    )
    
    try:
        with conn.cursor() as cursor:
            # 创建数据库
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print("✅ 数据库创建成功")
        
        conn.commit()
    except Exception as e:
        print(f"❌ 数据库创建失败: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    init_database()