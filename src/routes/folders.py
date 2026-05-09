"""
目录管理路由 - 统一使用 folders 命名
"""
from typing import Any, Dict, List, Optional
from flask import request, jsonify, Response
from src.models import db, ApiGroup
from src.routes import folders_bp
from src.utils import sanitize_input, validate_id


@folders_bp.route('/projects/<int:project_id>/folders', methods=['GET'])
def get_project_folders(project_id: int) -> Response:
    """获取项目的目录树"""
    folders: List[ApiGroup] = ApiGroup.query.filter_by(project_id=project_id).all()
    
    folder_map: Dict[int, Dict[str, Any]] = {}
    for f in folders:
        folder_map[f.id] = {
            'id': f.id,
            'name': f.name,
            'description': f.description,
            'parent_id': f.parent_id,
            'children': [],
            'apis': [a.to_dict() for a in f.apis]
        }
    
    tree: List[Dict[str, Any]] = []
    for node in folder_map.values():
        if node['parent_id'] and node['parent_id'] in folder_map:
            folder_map[node['parent_id']]['children'].append(node)
        else:
            tree.append(node)
    
    return jsonify(tree)


@folders_bp.route('/projects/<int:project_id>/folders', methods=['POST'])
def create_folder(project_id: int) -> Response:
    """创建目录"""
    data: Dict[str, Any] = request.json or {}
    name: str = sanitize_input(data.get('name', ''), max_length=100)
    if not name:
        return jsonify({'success': False, 'error': '目录名称不能为空'}), 400
    
    description: str = sanitize_input(data.get('description', ''), max_length=500)
    parent_id: Optional[int] = validate_id(data.get('parent_id'))
    
    folder: ApiGroup = ApiGroup(
        project_id=project_id,
        name=name,
        description=description,
        parent_id=parent_id
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify({'success': True, 'id': folder.id})


@folders_bp.route('/folders/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id: int) -> Response:
    """更新目录"""
    folder: ApiGroup = ApiGroup.query.get_or_404(folder_id)
    data: Dict[str, Any] = request.json or {}
    if 'name' in data:
        folder.name = sanitize_input(data['name'], max_length=100)
    if 'description' in data:
        folder.description = sanitize_input(data['description'], max_length=500)
    if 'parent_id' in data:
        new_parent = validate_id(data['parent_id'])
        if new_parent == folder_id:
            return jsonify({'success': False, 'error': '不能将自己设为父目录'}), 400
        if new_parent:
            parent = ApiGroup.query.get(new_parent)
            if parent and parent.parent_id == folder_id:
                return jsonify({'success': False, 'error': '不能将子目录设为父目录'}), 400
        folder.parent_id = new_parent
    db.session.commit()
    return jsonify({'success': True})


@folders_bp.route('/folders/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id: int) -> Response:
    """删除目录（会级联删除子目录和API）"""
    folder: ApiGroup = ApiGroup.query.get_or_404(folder_id)
    db.session.delete(folder)
    db.session.commit()
    return jsonify({'success': True})


@folders_bp.route('/folders/reorder', methods=['PUT'])
def reorder_folders() -> Response:
    """重新排序目录"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, gid in enumerate(ids):
        group: Optional[ApiGroup] = ApiGroup.query.get(gid)
        if group:
            group.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})


# 兼容旧API路由 /groups/reorder
@folders_bp.route('/groups/reorder', methods=['PUT'])
def reorder_groups_compat() -> Response:
    """重新排序目录（兼容旧API）"""
    return reorder_folders()
