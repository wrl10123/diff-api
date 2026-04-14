"""
数据库初始化脚本
"""
import pymysql


def init_database():
    """创建数据库和表"""
    # 连接MySQL服务器
    conn = pymysql.connect(
        host='localhost',
        user='root',
        password='root',
        charset='utf8mb4'
    )
    
    try:
        with conn.cursor() as cursor:
            # 创建数据库
            cursor.execute("CREATE DATABASE IF NOT EXISTS diffapi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print("✅ 数据库 diffapi 创建成功")
        
        conn.commit()
    finally:
        conn.close()
    
    print("\n请确保MySQL的root密码为 'root'，如果密码不同，请修改 app.py 中的连接字符串:")
    print("app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:root@localhost:3306/diffapi'")


if __name__ == '__main__':
    init_database()