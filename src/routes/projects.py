"""
项目管理路由
"""
from typing import Any, Dict, List, Optional
from flask import request, jsonify, Response
from sqlalchemy.orm import Query
from src.models import db, Project
from src.routes import projects_bp
from src.utils import sanitize_input

SORT_MAP = {
    'name_asc': lambda m: m.name.asc(),
    'name_desc': lambda m: m.name.desc(),
    'time_asc': lambda m: m.created_at.asc(),
    'time_desc': lambda m: m.created_at.desc(),
    'default': lambda m: m.sort_order.asc(),
}


def apply_sort(query: Query, model: Any, sort_key: str) -> Query:
    """应用排序"""
    if sort_key in SORT_MAP:
        return query.order_by(SORT_MAP[sort_key](model))
    return query.order_by(model.sort_order.asc())


@projects_bp.route('/projects', methods=['GET'])
def get_projects() -> Response:
    """获取所有项目"""
    sort_key: str = request.args.get('sort', 'default')
    query = Project.query
    query = apply_sort(query, Project, sort_key)
    projects: List[Project] = query.all()
    return jsonify([p.to_dict() for p in projects])


@projects_bp.route('/projects', methods=['POST'])
def create_project() -> Response:
    """创建项目"""
    data: Dict[str, Any] = request.json or {}
    name: str = sanitize_input(data.get('name', ''), max_length=100)
    if not name:
        return jsonify({'success': False, 'error': '项目名称不能为空'}), 400
    
    description: str = sanitize_input(data.get('description', ''), max_length=500)
    
    project: Project = Project(name=name, description=description)
    db.session.add(project)
    db.session.commit()
    return jsonify({'success': True, 'id': project.id})


@projects_bp.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id: int) -> Response:
    """更新项目"""
    project: Project = Project.query.get_or_404(project_id)
    data: Dict[str, Any] = request.json or {}
    if 'name' in data:
        project.name = sanitize_input(data['name'], max_length=100)
    if 'description' in data:
        project.description = sanitize_input(data['description'], max_length=500)
    db.session.commit()
    return jsonify({'success': True})


@projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id: int) -> Response:
    """删除项目"""
    project: Project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'success': True})


@projects_bp.route('/projects/reorder', methods=['PUT'])
def reorder_projects() -> Response:
    """重新排序项目"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, pid in enumerate(ids):
        project: Optional[Project] = Project.query.get(pid)
        if project:
            project.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})
