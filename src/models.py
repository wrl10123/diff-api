"""
数据库模型定义
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.dialects.mysql import LONGTEXT

db = SQLAlchemy()


class Project(db.Model):
    """项目表"""
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, comment='项目名称')
    description = db.Column(db.String(500), comment='项目描述')
    sort_order = db.Column(db.Integer, default=0, comment='排序序号')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    # 关联
    groups = db.relationship('ApiGroup', backref='project', lazy='dynamic', cascade='all, delete-orphan')
    environments = db.relationship('Environment', backref='project', lazy='dynamic', cascade='all, delete-orphan')
    variables = db.relationship('Variable', backref='project', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ApiGroup(db.Model):
    """API目录表（支持嵌套）"""
    __tablename__ = 'api_groups'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, comment='项目ID')
    parent_id = db.Column(db.Integer, db.ForeignKey('api_groups.id'), nullable=True, comment='父目录ID')
    name = db.Column(db.String(100), nullable=False, comment='目录名称')
    description = db.Column(db.String(500), comment='目录描述')
    sort_order = db.Column(db.Integer, default=0, comment='排序序号')
    is_expanded = db.Column(db.Boolean, default=True, comment='是否展开')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    # 关联
    apis = db.relationship('ApiConfig', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    children = db.relationship('ApiGroup', backref=db.backref('parent', remote_side=[id]), lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'parent_id': self.parent_id,
            'name': self.name,
            'description': self.description,
            'sort_order': self.sort_order,
            'is_expanded': self.is_expanded,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ApiConfig(db.Model):
    """API配置表"""
    __tablename__ = 'api_configs'

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('api_groups.id'), nullable=False, comment='分组ID')
    name = db.Column(db.String(100), nullable=False, comment='API名称')
    path = db.Column(db.String(500), nullable=False, comment='路径（不含查询参数）')
    query_params = db.Column(db.Text, comment='URL查询参数(JSON对象，如{"page": "1", "size": "10"})')
    method = db.Column(db.String(10), default='POST', comment='请求方法')
    headers = db.Column(db.Text, comment='请求头(JSON字符串)')
    body = db.Column(db.Text, comment='请求体(JSON字符串)')
    description = db.Column(db.String(500), comment='描述')
    sort_order = db.Column(db.Integer, default=0, comment='排序序号')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    # 关联
    test_cases = db.relationship('TestCase', backref='api', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'name': self.name,
            'path': self.path,
            'query_params': self.query_params,
            'method': self.method,
            'headers': self.headers,
            'body': self.body,
            'description': self.description,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Environment(db.Model):
    """环境配置表"""
    __tablename__ = 'environments'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, comment='项目ID')
    name = db.Column(db.String(50), nullable=False, comment='环境名称，如dev/test/prod')
    base_url = db.Column(db.String(500), nullable=False, comment='环境基础URL')
    default_headers = db.Column(db.Text, comment='默认请求头(JSON字符串)')
    default_body = db.Column(db.Text, comment='默认请求体(JSON字符串)')
    description = db.Column(db.String(200), comment='环境描述')
    sort_order = db.Column(db.Integer, default=0, comment='排序序号')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'base_url': self.base_url,
            'default_headers': self.default_headers,
            'default_body': self.default_body,
            'description': self.description,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DiffRecord(db.Model):
    """对比记录表"""
    __tablename__ = 'diff_records'

    id = db.Column(db.Integer, primary_key=True)
    api_id = db.Column(db.Integer, db.ForeignKey('api_configs.id'), nullable=False, comment='API配置ID')
    env1_url = db.Column(db.String(500), nullable=False, comment='环境1 URL')
    env2_url = db.Column(db.String(500), nullable=False, comment='环境2 URL')
    env1_response = db.Column(db.Text, comment='环境1响应')
    env2_response = db.Column(db.Text, comment='环境2响应')
    diff_result = db.Column(LONGTEXT, comment='对比结果(JSON)')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')

    def to_dict(self):
        return {
            'id': self.id,
            'api_id': self.api_id,
            'env1_url': self.env1_url,
            'env2_url': self.env2_url,
            'env1_response': self.env1_response,
            'env2_response': self.env2_response,
            'diff_result': self.diff_result,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class TestCase(db.Model):
    """测试用例表 — 保存某API的对比参数（环境、Headers、Body、结果）"""
    __tablename__ = 'test_cases'

    id = db.Column(db.Integer, primary_key=True)
    api_id = db.Column(db.Integer, db.ForeignKey('api_configs.id', ondelete='CASCADE'), nullable=False, comment='API配置ID')
    name = db.Column(db.String(100), nullable=False, default='未命名用例', comment='用例名称')
    env1_id = db.Column(db.Integer, comment='环境1 ID（关联environments表）')
    env2_id = db.Column(db.Integer, comment='环境2 ID（关联environments表）')
    url1 = db.Column(db.String(500), nullable=False, comment='环境1完整URL')
    url2 = db.Column(db.String(500), nullable=False, comment='环境2完整URL')
    method = db.Column(db.String(10), default='POST', comment='请求方法')
    headers1 = db.Column(db.Text, comment='环境1请求头(JSON字符串)')
    headers2 = db.Column(db.Text, comment='环境2请求头(JSON字符串)')
    body1 = db.Column(db.Text, comment='环境1请求体(JSON字符串)')
    body2 = db.Column(db.Text, comment='环境2请求体(JSON字符串)')
    diff_result = db.Column(LONGTEXT, comment='最近一次对比结果(JSON)')
    sort_order = db.Column(db.Integer, default=0, comment='排序序号')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    def to_dict(self):
        return {
            'id': self.id,
            'api_id': self.api_id,
            'name': self.name,
            'env1_id': self.env1_id,
            'env2_id': self.env2_id,
            'url1': self.url1,
            'url2': self.url2,
            'method': self.method,
            'headers1': self.headers1,
            'headers2': self.headers2,
            'body1': self.body1,
            'body2': self.body2,
            'diff_result': self.diff_result,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Variable(db.Model):
    """全局变量表"""
    __tablename__ = 'variables'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False, comment='项目ID')
    name = db.Column(db.String(100), nullable=False, comment='变量名')
    value = db.Column(db.Text, comment='变量值')
    description = db.Column(db.String(500), comment='描述')
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    __table_args__ = (
        db.UniqueConstraint('project_id', 'name', name='uq_project_variable'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'value': self.value,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
