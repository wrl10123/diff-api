"""
导入路由 - OpenAPI 和 Postman 导入
"""
from typing import Any, Dict
from flask import request, jsonify, Response
from routes import import_bp
from import_service import import_service
from utils import from_json


@import_bp.route('/folders/<int:folder_id>/import-openapi', methods=['POST'])
def import_openapi(folder_id: int) -> Response:
    """从OpenAPI/Swagger导入API到指定目录"""
    data: Dict[str, Any] = request.json or {}
    openapi_spec = data.get('spec')
    
    if not openapi_spec:
        return jsonify({'success': False, 'error': '缺少OpenAPI规范内容'}), 400
    
    result = import_service.import_openapi(folder_id, openapi_spec)
    
    if result.get('success'):
        return jsonify(result)
    else:
        return jsonify(result), 400


# 兼容旧API路由
@import_bp.route('/groups/<int:group_id>/import-openapi', methods=['POST'])
def import_openapi_compat(group_id: int) -> Response:
    """从OpenAPI/Swagger导入API（兼容旧API）"""
    return import_openapi(group_id)


@import_bp.route('/folders/<int:folder_id>/import-postman', methods=['POST'])
def import_postman(folder_id: int) -> Response:
    """从Postman Collection导入API"""
    data: Dict[str, Any] = request.json or {}
    collection = data.get('collection')
    
    if not collection:
        return jsonify({'success': False, 'error': '缺少Postman Collection内容'}), 400
    
    result = import_service.import_postman(folder_id, collection)
    
    if result.get('success'):
        return jsonify(result)
    else:
        return jsonify(result), 400