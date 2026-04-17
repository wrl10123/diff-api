"""
错误日志路由
"""
from flask import request, jsonify, Response
from routes import diff_bp
import logging

logger = logging.getLogger(__name__)


@diff_bp.route('/log/error', methods=['POST'])
def log_client_error() -> Response:
    """记录前端错误"""
    data = request.json or {}
    logger.error(
        f"Client Error: {data.get('type')} - {data.get('message')} "
        f"[Context: {data.get('context')}] [URL: {data.get('url')}]"
    )
    return jsonify({'success': True})
