"""
API配置管理路由
"""
from typing import Any, Dict, List, Optional
from flask import request, jsonify, Response
from src.models import db, ApiConfig
from src.routes import apis_bp
from src.utils import sanitize_input, safe_json_dumps, validate_json_field
from src.routes.projects import apply_sort


@apis_bp.route('/folders/<int:folder_id>/apis', methods=['GET'])
def get_folder_apis(folder_id: int) -> Response:
    """获取目录下的所有API"""
    sort_key: str = request.args.get('sort', 'default')
    query = ApiConfig.query.filter_by(group_id=folder_id)
    query = apply_sort(query, ApiConfig, sort_key)
    apis: List[ApiConfig] = query.all()
    return jsonify([a.to_dict() for a in apis])


# 兼容旧API路由
@apis_bp.route('/groups/<int:group_id>/apis', methods=['GET'])
def get_group_apis_compat(group_id: int) -> Response:
    """获取分组下的所有API（兼容旧API）"""
    return get_folder_apis(group_id)


@apis_bp.route('/folders/<int:folder_id>/apis', methods=['POST'])
def create_api(folder_id: int) -> Response:
    """创建API"""
    data: Dict[str, Any] = request.json or {}
    name: str = sanitize_input(data.get('name', ''), max_length=100)
    path: str = sanitize_input(data.get('path', ''), max_length=500)
    if not name or not path:
        return jsonify({'success': False, 'error': 'API名称和Path不能为空'}), 400
    
    method: str = sanitize_input(data.get('method', 'GET'), max_length=10)
    if method not in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'):
        method = 'GET'
    
    headers: str = safe_json_dumps(validate_json_field(data.get('headers')))
    body: str = safe_json_dumps(validate_json_field(data.get('body')))
    query_params: str = safe_json_dumps(validate_json_field(data.get('query_params')))
    description: str = sanitize_input(data.get('description', ''), max_length=500)
    
    api: ApiConfig = ApiConfig(
        group_id=folder_id,
        name=name,
        path=path,
        method=method,
        headers=headers,
        body=body,
        query_params=query_params,
        description=description
    )
    db.session.add(api)
    db.session.commit()
    return jsonify({'success': True, 'id': api.id})


# 兼容旧API路由
@apis_bp.route('/groups/<int:group_id>/apis', methods=['POST'])
def create_api_compat(group_id: int) -> Response:
    """创建API（兼容旧API）"""
    return create_api(group_id)


@apis_bp.route('/apis/<int:api_id>', methods=['GET'])
def get_api(api_id: int) -> Response:
    """获取API详情"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    return jsonify(api.to_dict())


@apis_bp.route('/apis/<int:api_id>', methods=['PUT'])
def update_api(api_id: int) -> Response:
    """更新API"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    data: Dict[str, Any] = request.json or {}
    if 'name' in data:
        api.name = sanitize_input(data['name'], max_length=100)
    if 'path' in data:
        api.path = sanitize_input(data['path'], max_length=500)
    if 'method' in data:
        method = sanitize_input(data['method'], max_length=10)
        if method in ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'):
            api.method = method
    if 'headers' in data:
        api.headers = safe_json_dumps(validate_json_field(data['headers']))
    if 'body' in data:
        api.body = safe_json_dumps(validate_json_field(data['body']))
    if 'query_params' in data:
        api.query_params = safe_json_dumps(validate_json_field(data['query_params']))
    if 'description' in data:
        api.description = sanitize_input(data['description'], max_length=500)
    db.session.commit()
    return jsonify({'success': True})


@apis_bp.route('/apis/<int:api_id>', methods=['DELETE'])
def delete_api(api_id: int) -> Response:
    """删除API"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    db.session.delete(api)
    db.session.commit()
    return jsonify({'success': True})


@apis_bp.route('/apis/reorder', methods=['PUT'])
def reorder_apis() -> Response:
    """重新排序API"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, aid in enumerate(ids):
        api: Optional[ApiConfig] = ApiConfig.query.get(aid)
        if api:
            api.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})
