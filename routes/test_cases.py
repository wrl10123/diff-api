"""
测试用例管理路由
"""
from typing import Any, Dict, List, Optional
from flask import request, jsonify, Response
from models import db, TestCase
from routes import test_cases_bp
from utils import sanitize_input, safe_json_dumps, validate_json_field, dump_json


@test_cases_bp.route('/apis/<int:api_id>/test-cases', methods=['GET'])
def get_test_cases(api_id: int) -> Response:
    """获取API的所有测试用例"""
    cases: List[TestCase] = TestCase.query.filter_by(api_id=api_id).order_by(TestCase.updated_at.desc()).all()
    return jsonify([c.to_dict() for c in cases])


@test_cases_bp.route('/apis/<int:api_id>/test-cases', methods=['POST'])
def create_test_case(api_id: int) -> Response:
    """创建测试用例"""
    from models import ApiConfig
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    data: Dict[str, Any] = request.json or {}
    
    name: str = sanitize_input(data.get('name', '未命名用例'), max_length=100)
    
    tc: TestCase = TestCase(
        api_id=api_id,
        name=name,
        env1_id=data.get('env1_id'),
        env2_id=data.get('env2_id'),
        url1=sanitize_input(data.get('url1', ''), max_length=500),
        url2=sanitize_input(data.get('url2', ''), max_length=500),
        method=sanitize_input(data.get('method', 'POST'), max_length=10),
        headers1=dump_json(data.get('headers1')),
        headers2=dump_json(data.get('headers2')),
        body1=dump_json(data.get('body1')),
        body2=dump_json(data.get('body2')),
        diff_result=dump_json(data.get('diff_result'))
    )
    db.session.add(tc)
    db.session.commit()
    return jsonify({'success': True, 'id': tc.id})


@test_cases_bp.route('/test-cases/<int:tc_id>', methods=['PUT'])
def update_test_case(tc_id: int) -> Response:
    """更新测试用例"""
    tc: TestCase = TestCase.query.get_or_404(tc_id)
    data: Dict[str, Any] = request.json or {}
    
    if 'name' in data:
        tc.name = sanitize_input(data['name'], max_length=100)
    if 'env1_id' in data:
        tc.env1_id = data['env1_id']
    if 'env2_id' in data:
        tc.env2_id = data['env2_id']
    if 'url1' in data:
        tc.url1 = sanitize_input(data['url1'], max_length=500)
    if 'url2' in data:
        tc.url2 = sanitize_input(data['url2'], max_length=500)
    if 'method' in data:
        tc.method = sanitize_input(data['method'], max_length=10)
    if 'headers1' in data:
        tc.headers1 = dump_json(data['headers1'])
    if 'headers2' in data:
        tc.headers2 = dump_json(data['headers2'])
    if 'body1' in data:
        tc.body1 = dump_json(data['body1'])
    if 'body2' in data:
        tc.body2 = dump_json(data['body2'])
    if 'diff_result' in data:
        tc.diff_result = dump_json(data['diff_result'])
    db.session.commit()
    return jsonify({'success': True})


@test_cases_bp.route('/test-cases/<int:tc_id>', methods=['DELETE'])
def delete_test_case(tc_id: int) -> Response:
    """删除测试用例"""
    tc: TestCase = TestCase.query.get_or_404(tc_id)
    db.session.delete(tc)
    db.session.commit()
    return jsonify({'success': True})


@test_cases_bp.route('/test-cases/reorder', methods=['PUT'])
def reorder_test_cases() -> Response:
    """重新排序测试用例"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, tc_id in enumerate(ids):
        tc: Optional[TestCase] = TestCase.query.get(tc_id)
        if tc:
            tc.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})
