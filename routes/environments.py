"""
环境管理路由
"""
from typing import Any, Dict, List, Optional
from flask import request, jsonify, Response
from models import db, Environment
from routes import environments_bp
from utils import sanitize_input, safe_json_dumps, validate_json_field
from routes.projects import apply_sort


@environments_bp.route('/projects/<int:project_id>/environments', methods=['GET'])
def get_environments(project_id: int) -> Response:
    """获取项目的所有环境"""
    sort_key: str = request.args.get('sort', 'default')
    query = Environment.query.filter_by(project_id=project_id)
    query = apply_sort(query, Environment, sort_key)
    envs: List[Environment] = query.all()
    return jsonify([e.to_dict() for e in envs])


@environments_bp.route('/projects/<int:project_id>/environments', methods=['POST'])
def create_environment(project_id: int) -> Response:
    """创建环境"""
    data: Dict[str, Any] = request.json or {}
    name: str = sanitize_input(data.get('name', ''), max_length=50)
    base_url: str = sanitize_input(data.get('base_url', ''), max_length=500)
    if not name or not base_url:
        return jsonify({'success': False, 'error': '环境名称和基础URL不能为空'}), 400
    
    default_headers: str = safe_json_dumps(validate_json_field(data.get('default_headers')))
    default_body: str = safe_json_dumps(validate_json_field(data.get('default_body')))
    description: str = sanitize_input(data.get('description', ''), max_length=200)
    
    env: Environment = Environment(
        project_id=project_id,
        name=name,
        base_url=base_url,
        default_headers=default_headers,
        default_body=default_body,
        description=description
    )
    db.session.add(env)
    db.session.commit()
    return jsonify({'success': True, 'id': env.id})


@environments_bp.route('/environments/<int:env_id>', methods=['PUT'])
def update_environment(env_id: int) -> Response:
    """更新环境"""
    env: Environment = Environment.query.get_or_404(env_id)
    data: Dict[str, Any] = request.json or {}
    if 'name' in data:
        env.name = sanitize_input(data['name'], max_length=50)
    if 'base_url' in data:
        env.base_url = sanitize_input(data['base_url'], max_length=500)
    if 'default_headers' in data:
        env.default_headers = safe_json_dumps(validate_json_field(data['default_headers']))
    if 'default_body' in data:
        env.default_body = safe_json_dumps(validate_json_field(data['default_body']))
    if 'description' in data:
        env.description = sanitize_input(data['description'], max_length=200)
    db.session.commit()
    return jsonify({'success': True})


@environments_bp.route('/environments/<int:env_id>', methods=['DELETE'])
def delete_environment(env_id: int) -> Response:
    """删除环境"""
    env: Environment = Environment.query.get_or_404(env_id)
    db.session.delete(env)
    db.session.commit()
    return jsonify({'success': True})


@environments_bp.route('/environments/reorder', methods=['PUT'])
def reorder_environments() -> Response:
    """重新排序环境"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, eid in enumerate(ids):
        env: Optional[Environment] = Environment.query.get(eid)
        if env:
            env.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})
