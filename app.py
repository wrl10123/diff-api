"""
Flask应用配置和路由
"""
from typing import Any, Dict, List, Optional, Union
from flask import Flask, request, jsonify, render_template, Response
from sqlalchemy.orm import Query
from models import db, Project, ApiGroup, ApiConfig, Environment, DiffRecord, TestCase, Variable
from diff_service import DiffService
from utils import to_json, from_json, parse_json_field, safe_json_dumps

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

def apply_sort(query: Query, model: Any, sort_key: str) -> Query:
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
def get_projects() -> Response:
    """获取所有项目"""
    sort_key: str = request.args.get('sort', 'default')
    query = apply_sort(Project.query, Project, sort_key)
    projects: List[Project] = query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'sort_order': p.sort_order or 0,
        'created_at': p.created_at.isoformat() if p.created_at else None
    } for p in projects])


@app.route('/api/projects', methods=['POST'])
def create_project() -> Response:
    """创建项目"""
    data: Dict[str, Any] = request.json or {}
    project = Project(
        name=data.get('name', ''),
        description=data.get('description', '')
    )
    db.session.add(project)
    db.session.commit()
    return jsonify({'id': project.id, 'name': project.name})


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id: int) -> Response:
    """更新项目"""
    project: Project = Project.query.get_or_404(project_id)
    data: Dict[str, Any] = request.json or {}
    project.name = data.get('name', project.name)
    project.description = data.get('description', project.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id: int) -> Response:
    """删除项目"""
    project: Project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 目录管理 ====================

def build_folder_tree(folders: List[ApiGroup], apis_by_folder: Dict[int, List[ApiConfig]], sort_key: str = 'default') -> List[Dict[str, Any]]:
    """构建目录树结构"""
    folder_map: Dict[int, Dict[str, Any]] = {}
    for f in folders:
        folder_map[f.id] = {
            'id': f.id,
            'name': f.name,
            'description': f.description,
            'parent_id': f.parent_id,
            'sort_order': f.sort_order or 0,
            'created_at': f.created_at.isoformat() if f.created_at else None,
            'children': [],
            'apis': apis_by_folder.get(f.id, [])
        }
    # 构建树
    roots: List[Dict[str, Any]] = []
    for f in folders:
        node = folder_map[f.id]
        if f.parent_id and f.parent_id in folder_map:
            folder_map[f.parent_id]['children'].append(node)
        else:
            roots.append(node)
    # 递归排序
    def sort_tree(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if sort_key == 'name_asc':
            nodes.sort(key=lambda x: x['name'])
        elif sort_key == 'name_desc':
            nodes.sort(key=lambda x: x['name'], reverse=True)
        elif sort_key == 'time_desc':
            nodes.sort(key=lambda x: x['created_at'] or '', reverse=True)
        elif sort_key == 'time_asc':
            nodes.sort(key=lambda x: x['created_at'] or '')
        else:
            nodes.sort(key=lambda x: x['sort_order'])
        for node in nodes:
            if node['children']:
                sort_tree(node['children'])
        return nodes
    return sort_tree(roots)


@app.route('/api/projects/<int:project_id>/folders', methods=['GET'])
def get_folders(project_id: int) -> Response:
    """获取项目下的目录树（包含API）"""
    sort_key: str = request.args.get('sort', 'default')
    # 获取所有目录
    folders: List[ApiGroup] = ApiGroup.query.filter_by(project_id=project_id).all()
    # 获取所有API并按目录分组
    apis: List[ApiConfig] = ApiConfig.query.filter(
        ApiConfig.group_id.in_([f.id for f in folders])
    ).all() if folders else []
    apis_by_folder: Dict[int, List[Dict[str, Any]]] = {}
    for a in apis:
        if a.group_id not in apis_by_folder:
            apis_by_folder[a.group_id] = []
        apis_by_folder[a.group_id].append({
            'id': a.id,
            'name': a.name,
            'path': a.path,
            'method': a.method,
            'headers': a.headers,
            'body': a.body,
            'description': a.description,
            'sort_order': a.sort_order or 0,
            'created_at': a.created_at.isoformat() if a.created_at else None
        })
    # 应用排序
    if sort_key == 'name_asc':
        for folder_id in apis_by_folder:
            apis_by_folder[folder_id].sort(key=lambda x: x['name'])
    elif sort_key == 'name_desc':
        for folder_id in apis_by_folder:
            apis_by_folder[folder_id].sort(key=lambda x: x['name'], reverse=True)
    elif sort_key == 'time_desc':
        for folder_id in apis_by_folder:
            apis_by_folder[folder_id].sort(key=lambda x: x['created_at'] or '', reverse=True)
    elif sort_key == 'time_asc':
        for folder_id in apis_by_folder:
            apis_by_folder[folder_id].sort(key=lambda x: x['created_at'] or '')
    else:
        for folder_id in apis_by_folder:
            apis_by_folder[folder_id].sort(key=lambda x: x['sort_order'])
    tree = build_folder_tree(folders, apis_by_folder, sort_key)
    return jsonify(tree)


@app.route('/api/projects/<int:project_id>/folders', methods=['POST'])
def create_folder(project_id: int) -> Response:
    """创建目录"""
    data: Dict[str, Any] = request.json or {}
    folder = ApiGroup(
        project_id=project_id,
        name=data.get('name', ''),
        description=data.get('description', ''),
        parent_id=data.get('parent_id')
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify({'id': folder.id, 'name': folder.name})


@app.route('/api/folders/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id: int) -> Response:
    """更新目录"""
    folder: ApiGroup = ApiGroup.query.get_or_404(folder_id)
    data: Dict[str, Any] = request.json or {}
    folder.name = data.get('name', folder.name)
    folder.description = data.get('description', folder.description)
    if 'parent_id' in data:
        # 防止循环引用
        new_parent = data['parent_id']
        if new_parent == folder_id:
            return jsonify({'success': False, 'error': '不能将自己设为父目录'}), 400
        # 检查是否将父目录设为自己的子目录
        if new_parent:
            parent = ApiGroup.query.get(new_parent)
            if parent and parent.parent_id == folder_id:
                return jsonify({'success': False, 'error': '不能将子目录设为父目录'}), 400
        folder.parent_id = new_parent
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/folders/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id: int) -> Response:
    """删除目录（会级联删除子目录和API）"""
    folder: ApiGroup = ApiGroup.query.get_or_404(folder_id)
    db.session.delete(folder)
    db.session.commit()
    return jsonify({'success': True})


# 兼容旧的分组API（重定向到新API）
@app.route('/api/projects/<int:project_id>/groups', methods=['GET'])
def get_groups(project_id: int) -> Response:
    """获取项目下的所有分组（兼容旧API，返回扁平列表）"""
    sort_key: str = request.args.get('sort', 'default')
    query = apply_sort(ApiGroup.query.filter_by(project_id=project_id), ApiGroup, sort_key)
    groups: List[ApiGroup] = query.all()
    return jsonify([{
        'id': g.id,
        'name': g.name,
        'description': g.description,
        'parent_id': g.parent_id,
        'sort_order': g.sort_order or 0,
        'created_at': g.created_at.isoformat() if g.created_at else None
    } for g in groups])


@app.route('/api/projects/<int:project_id>/groups', methods=['POST'])
def create_group(project_id: int) -> Response:
    """创建分组（兼容旧API）"""
    return create_folder(project_id)


@app.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id: int) -> Response:
    """更新分组（兼容旧API）"""
    return update_folder(group_id)


@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id: int) -> Response:
    """删除分组（兼容旧API）"""
    return delete_folder(group_id)


@app.route('/api/folders/<int:folder_id>/import-openapi', methods=['POST'])
def import_openapi_folder(folder_id: int) -> Response:
    """从OpenAPI/Swagger JSON导入API到指定目录"""
    folder: ApiGroup = ApiGroup.query.get_or_404(folder_id)
    return _import_openapi_impl(folder_id)


@app.route('/api/groups/<int:group_id>/import-openapi', methods=['POST'])
def import_openapi(group_id: int) -> Response:
    """从OpenAPI/Swagger JSON导入API（兼容旧API）"""
    return _import_openapi_impl(group_id)


def _import_openapi_impl(group_id: int) -> Response:
    """OpenAPI导入实现"""
    group: ApiGroup = ApiGroup.query.get_or_404(group_id)
    data: Dict[str, Any] = request.json or {}
    openapi_spec: Any = data.get('spec')

    if not openapi_spec:
        return jsonify({'success': False, 'error': '缺少OpenAPI规范内容'}), 400

    if isinstance(openapi_spec, str):
        openapi_spec = from_json(openapi_spec)
        if openapi_spec == {}:
            return jsonify({'success': False, 'error': 'JSON格式错误'}), 400

    paths = openapi_spec.get('paths', {})
    if not paths:
        return jsonify({'success': False, 'error': 'OpenAPI规范中未找到paths定义'}), 400

    # 获取该分组已有的path集合，用于去重
    existing_paths = set(
        a.path for a in ApiConfig.query.filter_by(group_id=group_id).all()
    )

    imported: int = 0
    skipped: int = 0

    http_methods: set = {'get', 'post', 'put', 'delete', 'patch', 'head', 'options'}

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

            api: ApiConfig = ApiConfig(
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
def get_apis(group_id: int) -> Response:
    """获取分组下的所有API"""
    sort_key: str = request.args.get('sort', 'default')
    query = apply_sort(ApiConfig.query.filter_by(group_id=group_id), ApiConfig, sort_key)
    apis: List[ApiConfig] = query.all()
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
def create_api(group_id: int) -> Response:
    """创建API配置"""
    data: Dict[str, Any] = request.json or {}
    api: ApiConfig = ApiConfig(
        group_id=group_id,
        name=data.get('name', ''),
        path=data.get('path', ''),
        method=data.get('method', 'POST'),
        headers=to_json(data.get('headers', {})) if isinstance(data.get('headers'), dict) else data.get('headers', ''),
        body=to_json(data.get('body', {})) if isinstance(data.get('body'), dict) else data.get('body', ''),
        description=data.get('description', '')
    )
    db.session.add(api)
    db.session.commit()
    return jsonify({'id': api.id, 'name': api.name})


@app.route('/api/apis/<int:api_id>', methods=['PUT'])
def update_api(api_id: int) -> Response:
    """更新API配置"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    data: Dict[str, Any] = request.json or {}
    api.name = data.get('name', api.name)
    api.path = data.get('path', api.path)
    api.method = data.get('method', api.method)
    if 'headers' in data:
        api.headers = to_json(data['headers']) if isinstance(data['headers'], dict) else data['headers']
    if 'body' in data:
        api.body = to_json(data['body']) if isinstance(data['body'], dict) else data['body']
    api.description = data.get('description', api.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/<int:api_id>', methods=['DELETE'])
def delete_api(api_id: int) -> Response:
    """删除API配置"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    db.session.delete(api)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/<int:api_id>', methods=['GET'])
def get_api(api_id: int) -> Response:
    """获取单个API配置"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
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
def get_environments(project_id: int) -> Response:
    """获取项目下的所有环境"""
    sort_key: str = request.args.get('sort', 'default')
    query = apply_sort(Environment.query.filter_by(project_id=project_id), Environment, sort_key)
    envs: List[Environment] = query.all()
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
def create_environment(project_id: int) -> Response:
    """创建环境"""
    data: Dict[str, Any] = request.json or {}
    env: Environment = Environment(
        project_id=project_id,
        name=data.get('name', ''),
        base_url=data.get('base_url', ''),
        default_headers=to_json(data.get('default_headers', {})) if isinstance(data.get('default_headers'), dict) else data.get('default_headers', ''),
        default_body=to_json(data.get('default_body', {})) if isinstance(data.get('default_body'), dict) else data.get('default_body', ''),
        description=data.get('description', '')
    )
    db.session.add(env)
    db.session.commit()
    return jsonify({'id': env.id, 'name': env.name})


@app.route('/api/environments/<int:env_id>', methods=['PUT'])
def update_environment(env_id: int) -> Response:
    """更新环境"""
    env: Environment = Environment.query.get_or_404(env_id)
    data: Dict[str, Any] = request.json or {}
    env.name = data.get('name', env.name)
    env.base_url = data.get('base_url', env.base_url)
    if 'default_headers' in data:
        env.default_headers = to_json(data['default_headers']) if isinstance(data['default_headers'], dict) else data['default_headers']
    if 'default_body' in data:
        env.default_body = to_json(data['default_body']) if isinstance(data['default_body'], dict) else data['default_body']
    env.description = data.get('description', env.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/environments/<int:env_id>', methods=['DELETE'])
def delete_environment(env_id: int) -> Response:
    """删除环境"""
    env: Environment = Environment.query.get_or_404(env_id)
    db.session.delete(env)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 变量管理 ====================

@app.route('/api/projects/<int:project_id>/variables', methods=['GET'])
def get_variables(project_id: int) -> Response:
    """获取项目下的所有变量"""
    variables: List[Variable] = Variable.query.filter_by(project_id=project_id).order_by(Variable.name).all()
    return jsonify([{
        'id': v.id,
        'name': v.name,
        'value': v.value,
        'description': v.description or '',
        'created_at': v.created_at.isoformat() if v.created_at else None,
        'updated_at': v.updated_at.isoformat() if v.updated_at else None
    } for v in variables])


@app.route('/api/projects/<int:project_id>/variables', methods=['POST'])
def create_variable(project_id: int) -> Response:
    """创建变量"""
    data: Dict[str, Any] = request.json or {}
    name: str = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': '变量名不能为空'}), 400
    
    existing: Optional[Variable] = Variable.query.filter_by(project_id=project_id, name=name).first()
    if existing:
        return jsonify({'success': False, 'error': '变量名已存在'}), 400
    
    variable: Variable = Variable(
        project_id=project_id,
        name=name,
        value=data.get('value', ''),
        description=data.get('description', '')
    )
    db.session.add(variable)
    db.session.commit()
    return jsonify({'success': True, 'id': variable.id, 'name': variable.name})


@app.route('/api/variables/<int:var_id>', methods=['PUT'])
def update_variable(var_id: int) -> Response:
    """更新变量"""
    variable: Variable = Variable.query.get_or_404(var_id)
    data: Dict[str, Any] = request.json or {}
    
    new_name: str = data.get('name', '').strip()
    if new_name and new_name != variable.name:
        existing: Optional[Variable] = Variable.query.filter_by(project_id=variable.project_id, name=new_name).first()
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
def delete_variable(var_id: int) -> Response:
    """删除变量"""
    variable: Variable = Variable.query.get_or_404(var_id)
    db.session.delete(variable)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 排序/拖拽重排 ====================

@app.route('/api/projects/reorder', methods=['PUT'])
def reorder_projects() -> Response:
    """批量更新项目排序"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        project: Optional[Project] = Project.query.get(item_id)
        if project:
            project.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/reorder', methods=['PUT'])
def reorder_groups() -> Response:
    """批量更新分组排序"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        group: Optional[ApiGroup] = ApiGroup.query.get(item_id)
        if group:
            group.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/reorder', methods=['PUT'])
def reorder_apis() -> Response:
    """批量更新API排序"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        api: Optional[ApiConfig] = ApiConfig.query.get(item_id)
        if api:
            api.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/environments/reorder', methods=['PUT'])
def reorder_environments() -> Response:
    """批量更新环境排序"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        env: Optional[Environment] = Environment.query.get(item_id)
        if env:
            env.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/test-cases/reorder', methods=['PUT'])
def reorder_test_cases() -> Response:
    """批量更新测试用例排序"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    for idx, item_id in enumerate(ids):
        tc: Optional[TestCase] = TestCase.query.get(item_id)
        if tc:
            tc.sort_order = idx
    db.session.commit()
    return jsonify({'success': True})


# ==================== API对比 ====================

@app.route('/api/diff', methods=['POST'])
def diff_apis() -> Response:
    """执行API对比"""
    data: Dict[str, Any] = request.json or {}

    api_id: Optional[int] = data.get('api_id')
    method: str = data.get('method', 'POST')
    headers1: Dict[str, Any] = data.get('headers1', {})
    headers2: Dict[str, Any] = data.get('headers2', {})
    body1: Dict[str, Any] = data.get('body1', {})
    body2: Dict[str, Any] = data.get('body2', {})
    url1: str = data.get('url1', '')
    url2: str = data.get('url2', '')

    # 如果有API配置，补充默认值
    if api_id:
        api = ApiConfig.query.get_or_404(api_id)
        if not url1:
            url1 = api.path
        if not url2:
            url2 = api.path
        if not headers1:
            headers1 = from_json(api.headers, {})
        if not headers2:
            headers2 = from_json(api.headers, {})
        if not body1:
            body1 = from_json(api.body, {})
        if not body2:
            body2 = from_json(api.body, {})
        method = method or api.method

    # 执行对比
    result: Dict[str, Any] = diff_service.diff(url1, url2, method, headers1, headers2, body1, body2)

    # 保存对比记录（响应数据截取前2000字符存库）
    if api_id and result.get('success'):
        record: DiffRecord = DiffRecord(
            api_id=api_id,
            env1_url=url1,
            env2_url=url2,
            env1_response=safe_json_dumps(result.get('response1'), max_length=2000),
            env2_response=safe_json_dumps(result.get('response2'), max_length=2000),
            diff_result=safe_json_dumps(result.get('diff'), max_length=2000)
        )
        db.session.add(record)
        db.session.commit()

    return jsonify(result)


@app.route('/api/diff/records/<int:api_id>', methods=['GET'])
def get_diff_records(api_id: int) -> Response:
    """获取API的对比历史记录"""
    records: List[DiffRecord] = DiffRecord.query.filter_by(api_id=api_id).order_by(DiffRecord.created_at.desc()).limit(20).all()
    return jsonify([{
        'id': r.id,
        'env1_url': r.env1_url,
        'env2_url': r.env2_url,
        'diff_result': r.diff_result,
        'created_at': r.created_at.isoformat() if r.created_at else None
    } for r in records])


# ==================== 测试用例管理 ====================

def _truncate(s: str, max_len: int = 2000) -> str:
    """截取字符串到指定长度（已废弃，请使用safe_json_dumps）"""
    s = s or ''
    return s[:max_len] if len(s) > max_len else s


@app.route('/api/apis/<int:api_id>/test-cases', methods=['POST'])
def save_test_case(api_id: int) -> Response:
    """保存/更新测试用例（根据id判断是新建还是更新）"""
    try:
        data: Dict[str, Any] = request.json or {}
    except Exception as e:
        return jsonify({'success': False, 'error': '请求体解析失败: ' + str(e)}), 400

    tc_id: Optional[int] = data.get('id')  # 有id则更新，无则新建

    def _dump(val: Any) -> str:
        return to_json(val, ensure_ascii=False) if isinstance(val, dict) else (val or '')

    tc: TestCase
    if tc_id:
        # 更新已有用例
        tc = TestCase.query.get_or_404(tc_id)
        if data.get('name') is not None:
            tc.name = data['name']
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
        if data.get('diff_result') is not None:
            tc.diff_result = safe_json_dumps(data['diff_result'], max_length=2000)
    else:
        # 新建
        tc = TestCase(
            api_id=api_id,
            name=data.get('name', '未命名用例'),
            env1_id=data.get('env1_id'),
            env2_id=data.get('env2_id'),
            url1=data.get('url1', ''),
            url2=data.get('url2', ''),
            method=data.get('method', 'POST'),
            headers1=_dump(data.get('headers1')),
            headers2=_dump(data.get('headers2')),
            body1=_dump(data.get('body1')),
            body2=_dump(data.get('body2')),
            diff_result=safe_json_dumps(data.get('diff_result'), max_length=2000) if data.get('diff_result') else None
        )
        db.session.add(tc)

    db.session.commit()
    return jsonify({'success': True, 'id': tc.id})


@app.route('/api/apis/<int:api_id>/test-cases', methods=['GET'])
def get_test_cases(api_id: int) -> Response:
    """获取某API下的所有测试用例"""
    cases: List[TestCase] = TestCase.query.filter_by(api_id=api_id).order_by(TestCase.updated_at.desc()).all()
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
def delete_test_case(tc_id: int) -> Response:
    """删除测试用例"""
    tc: TestCase = TestCase.query.get_or_404(tc_id)
    db.session.delete(tc)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 前端页面 ====================

@app.route('/')
def index() -> str:
    return render_template('index.html')


# 初始化数据库
def init_db() -> None:
    with app.app_context():
        db.create_all()
        # 迁移：为已有表添加 sort_order 列（如果不存在）
        _ensure_column('projects', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('api_groups', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('api_configs', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('environments', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')
        _ensure_column('test_cases', 'sort_order', 'INT DEFAULT 0 COMMENT \'排序序号\'')


def _ensure_column(table: str, col_name: str, col_def: str) -> None:
    """检查列是否存在，不存在则添加"""
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    existing_cols: List[str] = [c['name'] for c in inspector.get_columns(table)]
    if col_name not in existing_cols:
        db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {col_name} {col_def}'))
        db.session.commit()
        print(f'[DB] 已为表 {table} 添加列 {col_name}')


# 全局错误处理器：返回JSON格式的错误信息，便于前端调试
@app.errorhandler(500)
def handle_500(e: Exception) -> Response:
    import traceback
    return jsonify({'success': False, 'error': '服务器内部错误: ' + str(e), 'trace': traceback.format_exc()}), 500

@app.errorhandler(404)
def handle_404(e: Exception) -> Response:
    return jsonify({'success': False, 'error': '接口不存在: ' + request.path}), 404


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
