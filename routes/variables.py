"""
变量管理路由
"""
from typing import Any, Dict, List, Optional
from flask import request, jsonify, Response
from models import db, Variable
from routes import variables_bp
from utils import sanitize_input


@variables_bp.route('/projects/<int:project_id>/variables', methods=['GET'])
def get_variables(project_id: int) -> Response:
    """获取项目的所有变量"""
    variables: List[Variable] = Variable.query.filter_by(project_id=project_id).all()
    return jsonify([v.to_dict() for v in variables])


@variables_bp.route('/projects/<int:project_id>/variables', methods=['POST'])
def create_variable(project_id: int) -> Response:
    """创建变量"""
    data: Dict[str, Any] = request.json or {}
    name: str = sanitize_input(data.get('name', ''), max_length=50)
    if not name:
        return jsonify({'success': False, 'error': '变量名不能为空'}), 400
    
    value: str = data.get('value', '')
    description: str = sanitize_input(data.get('description', ''), max_length=200)
    
    var: Variable = Variable(
        project_id=project_id,
        name=name,
        value=value,
        description=description
    )
    db.session.add(var)
    db.session.commit()
    return jsonify({'success': True, 'id': var.id})


@variables_bp.route('/variables/<int:var_id>', methods=['PUT'])
def update_variable(var_id: int) -> Response:
    """更新变量"""
    var: Variable = Variable.query.get_or_404(var_id)
    data: Dict[str, Any] = request.json or {}
    if 'name' in data:
        var.name = sanitize_input(data['name'], max_length=50)
    if 'value' in data:
        var.value = data['value']
    if 'description' in data:
        var.description = sanitize_input(data['description'], max_length=200)
    db.session.commit()
    return jsonify({'success': True})


@variables_bp.route('/variables/<int:var_id>', methods=['DELETE'])
def delete_variable(var_id: int) -> Response:
    """删除变量"""
    var: Variable = Variable.query.get_or_404(var_id)
    db.session.delete(var)
    db.session.commit()
    return jsonify({'success': True})