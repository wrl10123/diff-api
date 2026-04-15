"""
Flask应用配置和路由
"""
import json
from flask import Flask, request, jsonify, render_template
from models import db, Project, ApiGroup, ApiConfig, Environment, DiffRecord, TestCase, Variable
from diff_service import DiffService

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:WRLwrl123.@127.0.0.1:3306/mydata'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'diffapi-secret-key-2024'

db.init_app(app)
diff_service = DiffService()


# ==================== 排序工具函数 ====================

SORT_MAP = {
    'name_asc': lambda m: m.name.asc(),
    'name_desc': lambda m: m.name.desc(),
    'time_asc': lambda m: m.created_at.asc(),
    'time_desc': lambda m: m.created_at.desc(),
    'default': lambda m: m.sort_order.asc(),  # 默认按sort_order
}

def apply_sort(query, model, sort_key):
    """根据排序键应用排序，默认 sort_order asc, created_at desc"""
    if sort_key in SORT_MAP:
        query = query.order_by(SORT_MAP[sort_key](model))
    else:
        # 默认排序：sort_order升序 -> created_at降序
        if hasattr(model, 'sort_order'):
            query = query.order_by(model.sort_order.asc())
        query = query.order_by(model.created_at.desc())
    return query


# ==================== 项目管理 ====================

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """获取所有项目"""
    sort_key = request.args.get('sort', 'default')
    query = apply_sort(Project.query, Project, sort_key)
    projects = query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'sort_order': p.sort_order or 0,
        'created_at': p.created_at.isoformat() if p.created_at else None
    } for p in projects])


@app.route('/api/projects', methods=['POST'])
def create_project():
    """创建项目"""
    data = request.json
    project = Project(
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(project)
    db.session.commit()
    return jsonify({'id': project.id, 'name': project.name})


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """更新项目"""
    project = Project.query.get_or_404(project_id)
    data = request.json
    project.name = data.get('name', project.name)
    project.description = data.get('description', project.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """删除项目"""
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 分组管理 ====================

@app.route('/api/projects/<int:project_id>/groups', methods=['GET'])
def get_groups(project_id):
    """获取项目下的所有分组"""
    sort_key = request.args.get('sort', 'default')
    query = apply_sort(ApiGroup.query.filter_by(project_id=project_id), ApiGroup, sort_key)
    groups = query.all()
    return jsonify([{
        'id': g.id,
        'name': g.name,
        'description': g.description,
        'sort_order': g.sort_order or 0,
        'created_at': g.created_at.isoformat() if g.created_at else None
    } for g in groups])


@app.route('/api/projects/<int:project_id>/groups', methods=['POST'])
def create_group(project_id):
    """创建分组"""
    data = request.json
    group = ApiGroup(
        project_id=project_id,
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(group)
    db.session.commit()
    return jsonify({'id': group.id, 'name': group.name})


@app.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    """更新分组"""
    group = ApiGroup.query.get_or_404(group_id)
    data = request.json
    group.name = data.get('name', group.name)
    group.description = data.get('description', group.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    """删除分组"""
    group = ApiGroup.query.get_or_404(group_id)
    db.session.delete(group)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/<int:group_id>/import-openapi', methods=['POST'])
def import_openapi(group_id):
    """从OpenAPI/Swagger JSON导入API"""
    group = ApiGroup.query.get_or_404(group_id)
    data = request.json
    openapi_spec = data.get('spec')

    if not openapi_spec:
        return jsonify({'success': False, 'error': '缺少OpenAPI规范内容'}), 400

    if isinstance(openapi_spec, str):
        try:
            openapi_spec = json.loads(openapi_spec)
        except (json.JSONDecodeError, ValueError):
            return jsonify({'success': False, 'error': 'JSON格式错误'}), 400

    paths = openapi_spec.get('paths', {})
    if not paths:
        return jsonify({'success': False, 'error': 'OpenAPI规范中未找到paths定义'}), 400

    # 获取该分组已有的path集合，用于去重
    existing_paths = set(
        a.path for a in ApiConfig.query.filter_by(group_id=group_id).all()
    )

    imported = 0
    skipped = 0

    http_methods = {'get', 'post', 'put', 'delete', 'patch', 'head', 'options'}

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method in http_methods:
            operation = path_item.get(method)
            if not operation or not isinstance(operation, dict):
                continue

            # 跳过已存在的path
            if path in existing_paths:
                skipped += 1
                continue

            # 提取API名称：优先summary，其次operationId，最后用method+path
            api_name = (
                operation.get('summary')
                or operation.get('operationId')
                or f'{method.upper()} {path}'
            )

            api = ApiConfig(
                group_id=group_id,
                name=api_name,
                path=path,
                method=method.upper(),
                headers='',
                body='',
                description=operation.get('description', '')
            )
            db.session.add(api)
            existing_paths.add(path)  # 防止同path重复导入
            imported += 1

    db.session.commit()

    return jsonify({
        'success': True,
        'imported': imported,
        'skipped': skipped,
        'message': f'成功导入{imported}个API，跳过{skipped}个重复项'
    })


# ==================== API配置管理 ====================

@app.route('/api/groups/<int:group_id>/apis', methods=['GET'])
def get_apis(group_id):
    """获取分组下的所有API"""
    sort_key = request.args.get('sort', 'default')
    query = apply_sort(ApiConfig.query.filter_by(group_id=group_id), ApiConfig, sort_key)
    apis = query.all()
    return jsonify([{
        'id': a.id,
        'name': a.name,
        'path': a.path,
        'method': a.method,
        'headers': a.headers,
        'body': a.body,
        'description': a.description,
        'sort_order': a.sort_order or 0,
        'created_at': a.created_at.isoformat() if a.created_at else None
    } for a in apis])


@app.route('/api/groups/<int:group_id>/apis', methods=['POST'])
def create_api(group_id):
    """创建API配置"""
    data = request.json
    api = ApiConfig(
        group_id=group_id,
        name=data['name'],
        path=data['path'],
        method=data.get('method', 'POST'),
        headers=json.dumps(data.get('headers', {})) if isinstance(data.get('headers'), dict) else data.get('headers', ''),
        body=json.dumps(data.get('body', {})) if isinstance(data.get('body'), dict) else data.get('body', ''),
        description=data.get('description', '')
    )
    db.session.add(api)
    db.session.commit()
    return jsonify({'id': api.id, 'name': api.name})


@app.route('/api/apis/<int:api_id>', methods=['PUT'])
def update_api(api_id):
    """更新API配置"""
    api = ApiConfig.query.get_or_404(api_id)
    data = request.json
    api.name = data.get('name', api.name)
    api.path = data.get('path', api.path)
    api.method = data.get('method', api.method)
    if 'headers' in data:
        api.headers = json.dumps(data['headers']) if isinstance(data['headers'], dict) else data['headers']
    if 'body' in data:
        api.body = json.dumps(data['body']) if isinstance(data['body'], dict) else data['body']
    api.description = data.get('description', api.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/<int:api_id>', methods=['DELETE'])
def delete_api(api_id):
    """删除API配置"""
    api = ApiConfig.query.get_or_404(api_id)
    db.session.delete(api)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/<int:api_id>', methods=['GET'])
def get_api(api_id):
    """获取单个API配置"""
    api = ApiConfig.query.get_or_404(api_id)
    return jsonify({
        'id': api.id,
        'group_id': api.group_id,
        'name': api.name,
        'path': api.path,
        'method': api.method,
        'headers': api.headers,
        'body': api.body,
        'description': api.description
    })


# ==================== 环境管理 ====================

@app.route('/api/projects/<int:project_id>/environments', methods=['GET'])
def get_environments(project_id):
    """获取项目下的所有环境"""
    sort_key = request.args.get('sort', 'default')
    query = apply_sort(Environment.query.filter_by(project_id=project_id), Environment, sort_key)
    envs = query.all()
    return jsonify([{
        'id': e.id,
        'name': e.name,
        'base_url': e.base_url,
        'default_headers': e.default_headers,
        'default_body': e.default_body,
        'description': e.description,
        'sort_order': e.sort_order or 0,
        'created_at': e.created_at.isoformat() if e.created_at else None
    } for e in envs])


@app.route('/api/projects/<int:project_id>/environments', methods=['POST'])
def create_environment(project_id):
    """创建环境"""
    data = request.json
    env = Environment(
        project_id=project_id,
        name=data['name'],
        base_url=data['base_url'],
        default_headers=json.dumps(data.get('default_headers', {})) if isinstance(data.get('default_headers'), dict) else data.get('default_headers', ''),
        default_body=json.dumps(data.get('default_body', {})) if isinstance(data.get('default_body'), dict) else data.get('default_body', ''),
        description=data.get('description', '')
    )
    db.session.add(env)
    db.session.commit()
    return jsonify({'id': env.id, 'name': env.name})


@app.route('/api/environments/<int:env_id>', methods=['PUT'])
def update_environment(env_id):
    """更新环境"""
    env = Environment.query.get_or_404(env_id)
    data = request.json
    env.name = data.get('name', env.name)
    env.base_url = data.get('base_url', env.base_url)
    if 'default_headers' in data:
        env.default_headers = json.dumps(data['default_headers']) if isinstance(data['default_headers'], dict) else data['default_headers']
    if 'default_body' in data:
        env.default_body = json.dumps(data['default_body']) if isinstance(data['default_body'], dict) else data['default_body']
    env.description = data.get('description', env.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/environments/<int:env_id>', methods=['DELETE'])
def delete_environment(env_id):
    """删除环境"""
    env = Environment.query.get_or_404(env_id)
    db.session.delete(env)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 变量管理 ====================

@app.route('/api/projects/<int:project_id>/variables', methods=['GET'])
def get_variables(project_id):
    """获取项目下的所有变量"""
    variables = Variable.query.filter_by(project_id=project_id).order_by(Variable.name).all()
    return jsonify([{
        'id': v.id,
        'name': v.name,
        'value': v.value,
        'description': v.description or '',
        'created_at': v.created_at.isoformat() if v.created_at else None,
        'updated_at': v.updated_at.isoformat() if v.updated_at else None
    } for v in variables])


@app.route('/api/projects/<int:project_id>/variables', methods=['POST'])
def create_variable(project_id):
    """创建变量"""
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': '变量名不能为空'}), 400
    
    existing = Variable.query.filter_by(project_id=project_id, name=name).first()
    if existing:
        return jsonify({'success': False, 'error': '变量名已存在'}), 400
    
    variable = Variable(
        project_id=project_id,
        name=name,
        value=data.get('value', ''),
        description=data.get('description', '')
    )
    db.session.add(variable)
    db.session.commit()
    return jsonify({'success': True, 'id': variable.id, 'name': variable.name})


@app.route('/api/variables/<int:var_id>', methods=['PUT'])
def update_variable(var_id):
    """更新变量"""
    variable = Variable.query.get_or_404(var_id)
    data = request.json
    
    new_name = data.get('name', '').strip()
    if new_name and new_name != variable.name:
        existing = Variable.query.filter_by(project_id=variable.project_id, name=new_name).first()
        if existing:
            return jsonify({'success': False, 'error': '变量名已存在'}), 400
        variable.name = new_name
    
    if 'value' in data:
        variable.value = data['value']
    if 'description' in data:
        variable.description = data['description']
    
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/variables/<int:var_id>', methods=['DELETE'])
def delete_variable(var_id):
    """删除变量"""
    variable = Variable.query.get_or_404(var_id)
    db.session.delete(variable)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 排序/拖拽重排 ====================

@app.route('/api/projects/reorder', methods=['PUT'])
def reorder_projects():
    """批量更新项目排序"""
    data = request.json
    ids = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        project = Project.query.get(item_id)
        if project:
            project.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/reorder', methods=['PUT'])
def reorder_groups():
    """批量更新分组排序"""
    data = request.json
    ids = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        group = ApiGroup.query.get(item_id)
        if group:
            group.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/reorder', methods=['PUT'])
def reorder_apis():
    """批量更新API排序"""
    data = request.json
    ids = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        api = ApiConfig.query.get(item_id)
        if api:
            api.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/environments/reorder', methods=['PUT'])
def reorder_environments():
    """批量更新环境排序"""
    data = request.json
    ids = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        env = Environment.query.get(item_id)
        if env:
            env.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


# ==================== API对比 ====================

@app.route('/api/diff', methods=['POST'])
def diff_apis():
    """执行API对比"""
    data = request.json

    api_id = data.get('api_id')
    method = data.get('method', 'POST')
    headers1 = data.get('headers1', {})
    headers2 = data.get('headers2', {})
    body1 = data.get('body1', {})
    body2 = data.get('body2', {})
    url1 = data.get('url1', '')
    url2 = data.get('url2', '')

    # 如果有API配置，补充默认值
    if api_id:
        api = ApiConfig.query.get_or_404(api_id)
        if not url1:
            url1 = api.path
        if not url2:
            url2 = api.path
        if not headers1:
            headers1 = json.loads(api.headers or '{}')
        if not headers2:
            headers2 = json.loads(api.headers or '{}')
        if not body1:
            body1 = json.loads(api.body or '{}')
        if not body2:
            body2 = json.loads(api.body or '{}')
        method = method or api.method

    # 执行对比
    result = diff_service.diff(url1, url2, method, headers1, headers2, body1, body2)

    # 保存对比记录（响应数据截取前2000字符存库）
    if api_id and result['success']:
        record = DiffRecord(
            api_id=api_id,
            env1_url=url1,
            env2_url=url2,
            env1_response=_truncate(json.dumps(result.get('response1'))),
            env2_response=_truncate(json.dumps(result.get('response2'))),
            diff_result=_truncate(json.dumps(result.get('diff')))
        )
        db.session.add(record)
        db.session.commit()

    return jsonify(result)


@app.route('/api/diff/records/<int:api_id>', methods=['GET'])
def get_diff_records(api_id):
    """获取API的对比历史记录"""
    records = DiffRecord.query.filter_by(api_id=api_id).order_by(DiffRecord.created_at.desc()).limit(20).all()
    return jsonify([{
        'id': r.id,
        'env1_url': r.env1_url,
        'env2_url': r.env2_url,
        'diff_result': r.diff_result,
        'created_at': r.created_at.isoformat() if r.created_at else None
    } for r in records])


# ==================== 测试用例管理 ====================

def _truncate(s, max_len=2000):
    """截取字符串到指定长度"""
    s = s or ''
    return s[:max_len] if len(s) > max_len else s


@app.route('/api/apis/<int:api_id>/test-cases', methods=['POST'])
def save_test_case(api_id):
    """保存/更新测试用例（根据id判断是新建还是更新）"""
    data = request.json
    tc_id = data.get('id')  # 有id则更新，无则新建

    def _dump(val):
        return json.dumps(val) if isinstance(val, dict) else (val or '')

    if tc_id:
        # 更新已有用例
        tc = TestCase.query.get_or_404(tc_id)
        tc.name = data.get('name', tc.name)
        tc.url1 = data.get('url1', tc.url1)
        tc.url2 = data.get('url2', tc.url2)
        tc.method = data.get('method', tc.method)
        tc.headers1 = _dump(data.get('headers1'))
        tc.headers2 = _dump(data.get('headers2'))
        tc.body1 = _dump(data.get('body1'))
        tc.body2 = _dump(data.get('body2'))
        tc.env1_id = data.get('env1_id')
        tc.env2_id = data.get('env2_id')
        # 如果有对比结果也更新
        if data.get('diff_result'):
            tc.diff_result = _truncate(json.dumps(data['diff_result']))
    else:
        # 新建
        tc = TestCase(
            api_id=api_id,
            name=data.get('name', '未命名用例'),
            env1_id=data.get('env1_id'),
            env2_id=data.get('env2_id'),
            url1=data['url1'],
            url2=data['url2'],
            method=data.get('method', 'POST'),
            headers1=_dump(data.get('headers1')),
            headers2=_dump(data.get('headers2')),
            body1=_dump(data.get('body1')),
            body2=_dump(data.get('body2')),
            diff_result=_truncate(json.dumps(data.get('diff_result'))) if data.get('diff_result') else None
        )
        db.session.add(tc)

    db.session.commit()
    return jsonify({'success': True, 'id': tc.id})


@app.route('/api/apis/<int:api_id>/test-cases', methods=['GET'])
def get_test_cases(api_id):
    """获取某API下的所有测试用例"""
    cases = TestCase.query.filter_by(api_id=api_id).order_by(TestCase.updated_at.desc()).all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'env1_id': c.env1_id,
        'env2_id': c.env2_id,
        'url1': c.url1,
        'url2': c.url2,
        'method': c.method,
        'headers1': c.headers1,
        'headers2': c.headers2,
        'body1': c.body1,
        'body2': c.body2,
        'updated_at': c.updated_at.isoformat() if c.updated_at else None
    } for c in cases])


@app.route('/api/test-cases/<int:tc_id>', methods=['DELETE'])
def delete_test_case(tc_id):
    """删除测试用例"""
    tc = TestCase.query.get_or_404(tc_id)
    db.session.delete(tc)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 前端页面 ====================

@app.route('/')
def index():
    return render_template('index.html')


# 初始化数据库
def init_db():
    with app.app_context():
        db.create_all()
        # 迁移：为已有表添加 sort_order 列（如果不存在）
        _ensure_column('projects', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('api_groups', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('api_configs', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('environments', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')


def _ensure_column(table, col_name, col_def):
    """检查列是否存在，不存在则添加"""
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    existing_cols = [c['name'] for c in inspector.get_columns(table)]
    if col_name not in existing_cols:
        db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {col_name} {col_def}'))
        db.session.commit()
        print(f'[DB] 已为表 {table} 添加列 {col_name}')


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
