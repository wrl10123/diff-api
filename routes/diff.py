"""
对比执行路由
"""
from typing import Any, Dict, List
from flask import request, jsonify, Response
from models import db, DiffRecord
from routes import diff_bp
from utils import build_url
from diff_service import DiffService


diff_service = DiffService()


@diff_bp.route('/diff/execute', methods=['POST'])
def execute_diff() -> Response:
    """执行对比"""
    data: Dict[str, Any] = request.json or {}
    
    url1 = data.get('url1', '')
    url2 = data.get('url2', '')
    query_params1 = data.get('query_params1', {})
    query_params2 = data.get('query_params2', {})
    
    if query_params1:
        url1 = build_url(url1, query_params1)
    if query_params2:
        url2 = build_url(url2, query_params2)
    
    try:
        result: Dict[str, Any] = diff_service.diff(
            url1=url1,
            url2=url2,
            method=data.get('method', 'POST'),
            headers1=data.get('headers1'),
            headers2=data.get('headers2'),
            body1=data.get('body1'),
            body2=data.get('body2')
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@diff_bp.route('/diff/history', methods=['GET'])
def get_diff_history() -> Response:
    """获取对比历史"""
    records: List[DiffRecord] = DiffRecord.query.order_by(DiffRecord.created_at.desc()).limit(50).all()
    return jsonify([r.to_dict() for r in records])


@diff_bp.route('/diff/history/<int:record_id>', methods=['DELETE'])
def delete_diff_record(record_id: int) -> Response:
    """删除对比记录"""
    record: DiffRecord = DiffRecord.query.get_or_404(record_id)
    db.session.delete(record)
    db.session.commit()
    return jsonify({'success': True})