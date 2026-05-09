"""
数据库迁移模块 - 安全的数据库结构更新
"""
import re
from typing import List, Tuple
from sqlalchemy import inspect, text
from flask import Flask
from src.models import db


ALLOWED_TABLES = {
    'projects', 'api_groups', 'api_configs', 'environments', 
    'test_cases', 'diff_records', 'variables'
}

ALLOWED_COLUMN_TYPES = {
    'INT', 'INTEGER', 'TEXT', 'VARCHAR', 'STRING', 'BOOLEAN', 'DATETIME', 'LONGTEXT'
}


def _validate_identifier(identifier: str, max_length: int = 64) -> bool:
    if not identifier:
        return False
    if len(identifier) > max_length:
        return False
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', identifier):
        return False
    return True


def _validate_column_type(col_type: str) -> bool:
    col_type_upper = col_type.upper().strip()
    for allowed in ALLOWED_COLUMN_TYPES:
        if col_type_upper.startswith(allowed):
            return True
    return False


def column_exists(table_name: str, column_name: str) -> bool:
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(table_name: str) -> bool:
    inspector = inspect(db.engine)
    return table_name in inspector.get_table_names()


def safe_add_column(table_name: str, column_name: str, column_type: str) -> Tuple[bool, str]:
    if table_name not in ALLOWED_TABLES:
        return False, f"不允许修改表: {table_name}"
    
    if not _validate_identifier(table_name):
        return False, f"无效的表名: {table_name}"
    
    if not _validate_identifier(column_name):
        return False, f"无效的列名: {column_name}"
    
    if not _validate_column_type(column_type):
        return False, f"不允许的列类型: {column_type}"
    
    if not table_exists(table_name):
        return False, f"表不存在: {table_name}"
    
    if column_exists(table_name, column_name):
        return True, f"列已存在: {table_name}.{column_name}"
    
    try:
        sql = f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}'
        db.session.execute(text(sql))
        db.session.commit()
        return True, f"成功添加列: {table_name}.{column_name}"
    except Exception as e:
        db.session.rollback()
        return False, f"添加列失败: {str(e)}"


def safe_modify_column_type(table_name: str, column_name: str, new_type: str) -> Tuple[bool, str]:
    if table_name not in ALLOWED_TABLES:
        return False, f"不允许修改表: {table_name}"
    
    if not _validate_identifier(table_name):
        return False, f"无效的表名: {table_name}"
    
    if not _validate_identifier(column_name):
        return False, f"无效的列名: {column_name}"
    
    if not table_exists(table_name):
        return False, f"表不存在: {table_name}"
    
    if not column_exists(table_name, column_name):
        return False, f"列不存在: {table_name}.{column_name}"
    
    try:
        sql = f'ALTER TABLE {table_name} MODIFY COLUMN {column_name} {new_type}'
        db.session.execute(text(sql))
        db.session.commit()
        return True, f"成功修改列类型: {table_name}.{column_name} -> {new_type}"
    except Exception as e:
        db.session.rollback()
        return False, f"修改列类型失败: {str(e)}"


def run_migrations(app: Flask) -> List[dict]:
    results = []
    
    with app.app_context():
        migrations = [
            ('projects', 'sort_order', 'INT DEFAULT 0'),
            ('api_groups', 'sort_order', 'INT DEFAULT 0'),
            ('api_configs', 'sort_order', 'INT DEFAULT 0'),
            ('environments', 'sort_order', 'INT DEFAULT 0'),
            ('test_cases', 'sort_order', 'INT DEFAULT 0'),
            ('api_configs', 'query_params', 'TEXT'),
        ]
        
        for table, column, col_type in migrations:
            success, message = safe_add_column(table, column, col_type)
            results.append({
                'table': table,
                'column': column,
                'success': success,
                'message': message
            })
        
        type_modifications = [
            ('test_cases', 'diff_result', 'LONGTEXT'),
            ('diff_records', 'diff_result', 'LONGTEXT'),
            ('diff_records', 'env1_response', 'LONGTEXT'),
            ('diff_records', 'env2_response', 'LONGTEXT'),
        ]
        
        for table, column, new_type in type_modifications:
            success, message = safe_modify_column_type(table, column, new_type)
            results.append({
                'table': table,
                'column': column,
                'success': success,
                'message': message,
                'type': 'modify_column'
            })
    
    return results
