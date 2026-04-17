"""
路由模块初始化
"""
from flask import Blueprint

# 创建各功能模块的Blueprint
projects_bp = Blueprint('projects', __name__)
folders_bp = Blueprint('folders', __name__)
apis_bp = Blueprint('apis', __name__)
environments_bp = Blueprint('environments', __name__)
test_cases_bp = Blueprint('test_cases', __name__)
variables_bp = Blueprint('variables', __name__)
diff_bp = Blueprint('diff', __name__)
import_bp = Blueprint('import', __name__)

# 导入各路由模块
from . import projects, folders, apis, environments, test_cases, variables, diff, import_routes, error_log


def register_blueprints(app):
    """注册所有Blueprint到Flask应用"""
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(folders_bp, url_prefix='/api')
    app.register_blueprint(apis_bp, url_prefix='/api')
    app.register_blueprint(environments_bp, url_prefix='/api')
    app.register_blueprint(test_cases_bp, url_prefix='/api')
    app.register_blueprint(variables_bp, url_prefix='/api')
    app.register_blueprint(diff_bp, url_prefix='/api')
    app.register_blueprint(import_bp, url_prefix='/api')