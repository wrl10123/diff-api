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
    """应用排序"""
    if sort_key in SORT_MAP:
        return query.order_by(SORT_MAP[sort_key](model))
    return query.order_by(model.sort_order.asc())


# ==================== 页面路由 ====================

@app.route('/')
def index() -> str:
    """首页"""
    return render_template('index.html')


# ==================== 项目管理 ====================

@app.route('/api/projects', methods=['GET'])
def get_projects() -> Response:
    """获取所有项目"""
    sort_key: str = request.args.get('sort', 'default')
    query = Project.query
    query = apply_sort(query, Project, sort_key)
    projects: List[Project] = query.all()
    return jsonify([p.to_dict() for p in projects])


@app.route('/api/projects', methods=['POST'])
def create_project() -> Response:
    """创建项目"""
    data: Dict[str, Any] = request.json or {}
    name: str = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': '项目名称不能为空'}), 400
    
    project: Project = Project(name=name, description=data.get('description', ''))
    db.session.add(project)
    db.session.commit()
    return jsonify({'success': True, 'id': project.id})


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


@app.route('/api/projects/reorder', methods=['PUT'])
def reorder_projects() -> Response:
    """重新排序项目"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, pid in enumerate(ids):
        project: Optional[Project] = Project.query.get(pid)
        if project:
            project.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})


# ==================== 目录管理 ====================

@app.route('/api/projects/<int:project_id>/folders', methods=['GET'])
def get_project_folders(project_id: int) -> Response:
    """获取项目的目录树"""
    sort_key: str = request.args.get('sort', 'default')
    folders: List[ApiGroup] = ApiGroup.query.filter_by(project_id=project_id).all()
    
    # 构建树形结构
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
    
    # 组装树
    tree: List[Dict[str, Any]] = []
    for node in folder_map.values():
        if node['parent_id'] and node['parent_id'] in folder_map:
            folder_map[node['parent_id']]['children'].append(node)
        else:
            tree.append(node)
    
    return jsonify(tree)


@app.route('/api/projects/<int:project_id>/folders', methods=['POST'])
def create_folder(project_id: int) -> Response:
    """创建目录"""
    data: Dict[str, Any] = request.json or {}
    name: str = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': '目录名称不能为空'}), 400
    
    folder: ApiGroup = ApiGroup(
        project_id=project_id,
        name=name,
        description=data.get('description', ''),
        parent_id=data.get('parent_id')
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify({'success': True, 'id': folder.id})


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


@app.route('/api/groups/reorder', methods=['PUT'])
def reorder_groups() -> Response:
    """重新排序目录"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, gid in enumerate(ids):
        group: Optional[ApiGroup] = ApiGroup.query.get(gid)
        if group:
            group.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})


# ==================== OpenAPI导入（增强版） ====================

@app.route('/api/folders/<int:folder_id>/import-openapi', methods=['POST'])
def import_openapi_folder(folder_id: int) -> Response:
    """从OpenAPI/Swagger JSON导入API到指定目录（支持多层级目录和测试用例）"""
    folder: ApiGroup = ApiGroup.query.get_or_404(folder_id)
    return _import_openapi_impl(folder_id)


@app.route('/api/groups/<int:group_id>/import-openapi', methods=['POST'])
def import_openapi(group_id: int) -> Response:
    """从OpenAPI/Swagger JSON导入API（兼容旧API）"""
    return _import_openapi_impl(group_id)


def _import_openapi_impl(group_id: int) -> Response:
    """OpenAPI导入实现 - 支持多层级目录和测试用例"""
    group: ApiGroup = ApiGroup.query.get_or_404(group_id)
    project_id: int = group.project_id
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

    # 统计信息
    stats = {
        'folders_created': 0,
        'apis_imported': 0,
        'test_cases_imported': 0,
        'skipped': 0
    }

    http_methods: set = {'get', 'post', 'put', 'delete', 'patch', 'head', 'options'}

    # 创建目录映射（用于缓存已创建的目录）
    folder_cache: Dict[str, int] = {}
    folder_cache['root'] = group_id

    def get_or_create_folder(folder_path: str, parent_id: Optional[int] = None) -> int:
        """获取或创建目录，支持层级路径（如：用户管理/登录相关）"""
        cache_key = f"{parent_id or group_id}:{folder_path}"
        if cache_key in folder_cache:
            return folder_cache[cache_key]

        # 处理层级路径
        path_parts = folder_path.split('/')
        current_parent = parent_id or group_id
        current_path = ""
        
        for part in path_parts:
            if not part.strip():
                continue
            current_path = f"{current_path}/{part}" if current_path else part
            cache_key_part = f"{current_parent}:{part}"
            
            if cache_key_part in folder_cache:
                current_parent = folder_cache[cache_key_part]
                continue
            
            # 查找是否已存在
            existing = ApiGroup.query.filter_by(
                project_id=project_id,
                name=part,
                parent_id=current_parent
            ).first()
            
            if existing:
                folder_cache[cache_key_part] = existing.id
                current_parent = existing.id
            else:
                # 创建新目录
                new_folder = ApiGroup(
                    project_id=project_id,
                    name=part,
                    description=f'从OpenAPI导入: {current_path}',
                    parent_id=current_parent
                )
                db.session.add(new_folder)
                db.session.flush()  # 获取ID
                folder_cache[cache_key_part] = new_folder.id
                current_parent = new_folder.id
                stats['folders_created'] += 1
        
        folder_cache[cache_key] = current_parent
        return current_parent

    def parse_folder_from_tags(tags: List[str]) -> Optional[str]:
        """从tags中解析目录路径"""
        if not tags:
            return None
        # 支持 tag 格式："目录名/子目录名" 或 "目录名"
        return tags[0] if tags else None

    def extract_headers_from_operation(operation: Dict[str, Any]) -> str:
        """从operation中提取请求头"""
        headers = {}
        
        # 从parameters中提取header
        parameters = operation.get('parameters', [])
        for param in parameters:
            if param.get('in') == 'header':
                headers[param.get('name')] = param.get('schema', {}).get('default', '')
        
        # 从requestBody中提取Content-Type
        request_body = operation.get('requestBody', {})
        content = request_body.get('content', {})
        if 'application/json' in content:
            headers['Content-Type'] = 'application/json'
        elif content:
            headers['Content-Type'] = list(content.keys())[0]
        
        return safe_json_dumps(headers) if headers else '{}'

    def extract_body_from_operation(operation: Dict[str, Any]) -> str:
        """从operation中提取请求体示例"""
        request_body = operation.get('requestBody', {})
        content = request_body.get('content', {})
        
        for content_type, content_def in content.items():
            schema = content_def.get('schema', {})
            example = content_def.get('example')
            examples = content_def.get('examples', {})
            
            if example:
                return safe_json_dumps(example)
            
            if examples:
                first_example = list(examples.values())[0]
                if isinstance(first_example, dict) and 'value' in first_example:
                    return safe_json_dumps(first_example['value'])
            
            # 从schema生成示例
            if schema:
                return _generate_example_from_schema(schema)
        
        return '{}'

    def _generate_example_from_schema(schema: Dict[str, Any]) -> str:
        """从schema生成示例数据"""
        schema_type = schema.get('type', 'object')
        
        if schema_type == 'object':
            properties = schema.get('properties', {})
            example = {}
            for prop_name, prop_schema in properties.items():
                example[prop_name] = _get_example_value(prop_schema)
            return safe_json_dumps(example)
        
        elif schema_type == 'array':
            items = schema.get('items', {})
            return safe_json_dumps([_get_example_value(items)])
        
        return '{}'

    def _get_example_value(prop_schema: Dict[str, Any]) -> Any:
        """根据属性schema获取示例值"""
        prop_type = prop_schema.get('type', 'string')
        example = prop_schema.get('example')
        
        if example is not None:
            return example
        
        if prop_type == 'string':
            return prop_schema.get('default', '')
        elif prop_type == 'integer' or prop_type == 'number':
            return prop_schema.get('default', 0)
        elif prop_type == 'boolean':
            return prop_schema.get('default', False)
        elif prop_type == 'array':
            return []
        elif prop_type == 'object':
            return {}
        
        return None

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue

        for method in http_methods:
            operation = path_item.get(method)
            if not operation or not isinstance(operation, dict):
                continue

            # 确定API所属目录
            target_group_id = group_id
            
            # 1. 优先使用 x-group 扩展字段
            x_group = operation.get('x-group') or path_item.get('x-group')
            if x_group:
                target_group_id = get_or_create_folder(x_group)
            else:
                # 2. 使用 tags 作为目录
                tags = operation.get('tags', [])
                folder_path = parse_folder_from_tags(tags)
                if folder_path:
                    target_group_id = get_or_create_folder(folder_path)

            # 检查是否已存在相同的API（同path+method）
            existing = ApiConfig.query.filter_by(
                group_id=target_group_id,
                path=path,
                method=method.upper()
            ).first()
            
            if existing:
                stats['skipped'] += 1
                continue

            # 提取API名称
            api_name = (
                operation.get('summary')
                or operation.get('operationId')
                or f'{method.upper()} {path}'
            )

            # 提取请求头和请求体
            headers = extract_headers_from_operation(operation)
            body = extract_body_from_operation(operation)

            api: ApiConfig = ApiConfig(
                group_id=target_group_id,
                name=api_name,
                path=path,
                method=method.upper(),
                headers=headers,
                body=body,
                description=operation.get('description', '')
            )
            db.session.add(api)
            db.session.flush()  # 获取API ID
            stats['apis_imported'] += 1

            # 导入测试用例（x-test-cases 扩展）
            x_test_cases = operation.get('x-test-cases', [])
            if x_test_cases:
                for tc in x_test_cases:
                    test_case = TestCase(
                        api_id=api.id,
                        project_id=project_id,
                        name=tc.get('name', f'用例_{stats["test_cases_imported"]+1}'),
                        env1_id=tc.get('env1_id'),
                        env2_id=tc.get('env2_id'),
                        url1=tc.get('url1', ''),
                        url2=tc.get('url2', ''),
                        headers1=safe_json_dumps(tc.get('headers1', {})),
                        headers2=safe_json_dumps(tc.get('headers2', {})),
                        body1=safe_json_dumps(tc.get('body1', {})),
                        body2=safe_json_dumps(tc.get('body2', {})),
                        method=tc.get('method', method.upper()),
                        diff_result=safe_json_dumps(tc.get('diff_result', {}))
                    )
                    db.session.add(test_case)
                    stats['test_cases_imported'] += 1

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'导入完成：创建{stats["folders_created"]}个目录，导入{stats["apis_imported"]}个API，{stats["test_cases_imported"]}个测试用例，跳过{stats["skipped"]}个重复项'
    })


# ==================== API配置管理 ====================

@app.route('/api/groups/<int:group_id>/apis', methods=['GET'])
def get_apis(group_id: int) -> Response:
    """获取分组下的所有API"""
    sort_key: str = request.args.get('sort', 'default')
    query = ApiConfig.query.filter_by(group_id=group_id)
    query = apply_sort(query, ApiConfig, sort_key)
    apis: List[ApiConfig] = query.all()
    return jsonify([a.to_dict() for a in apis])


@app.route('/api/groups/<int:group_id>/apis', methods=['POST'])
def create_api(group_id: int) -> Response:
    """创建API"""
    data: Dict[str, Any] = request.json or {}
    name: str = data.get('name', '').strip()
    path: str = data.get('path', '').strip()
    if not name or not path:
        return jsonify({'success': False, 'error': 'API名称和Path不能为空'}), 400
    
    api: ApiConfig = ApiConfig(
        group_id=group_id,
        name=name,
        path=path,
        method=data.get('method', 'GET'),
        headers=data.get('headers', ''),
        body=data.get('body', ''),
        description=data.get('description', '')
    )
    db.session.add(api)
    db.session.commit()
    return jsonify({'success': True, 'id': api.id})


@app.route('/api/apis/<int:api_id>', methods=['GET'])
def get_api(api_id: int) -> Response:
    """获取API详情"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    return jsonify(api.to_dict())


@app.route('/api/apis/<int:api_id>', methods=['PUT'])
def update_api(api_id: int) -> Response:
    """更新API"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    data: Dict[str, Any] = request.json or {}
    api.name = data.get('name', api.name)
    api.path = data.get('path', api.path)
    api.method = data.get('method', api.method)
    api.headers = data.get('headers', api.headers)
    api.body = data.get('body', api.body)
    api.description = data.get('description', api.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/<int:api_id>', methods=['DELETE'])
def delete_api(api_id: int) -> Response:
    """删除API"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    db.session.delete(api)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/apis/reorder', methods=['PUT'])
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


# ==================== 环境管理 ====================

@app.route('/api/projects/<int:project_id>/environments', methods=['GET'])
def get_environments(project_id: int) -> Response:
    """获取项目的所有环境"""
    sort_key: str = request.args.get('sort', 'default')
    query = Environment.query.filter_by(project_id=project_id)
    query = apply_sort(query, Environment, sort_key)
    envs: List[Environment] = query.all()
    return jsonify([e.to_dict() for e in envs])


@app.route('/api/projects/<int:project_id>/environments', methods=['POST'])
def create_environment(project_id: int) -> Response:
    """创建环境"""
    data: Dict[str, Any] = request.json or {}
    name: str = data.get('name', '').strip()
    base_url: str = data.get('base_url', '').strip()
    if not name or not base_url:
        return jsonify({'success': False, 'error': '环境名称和基础URL不能为空'}), 400
    
    env: Environment = Environment(
        project_id=project_id,
        name=name,
        base_url=base_url,
        default_headers=data.get('default_headers', '{}'),
        default_body=data.get('default_body', '{}'),
        description=data.get('description', '')
    )
    db.session.add(env)
    db.session.commit()
    return jsonify({'success': True, 'id': env.id})


@app.route('/api/environments/<int:env_id>', methods=['PUT'])
def update_environment(env_id: int) -> Response:
    """更新环境"""
    env: Environment = Environment.query.get_or_404(env_id)
    data: Dict[str, Any] = request.json or {}
    env.name = data.get('name', env.name)
    env.base_url = data.get('base_url', env.base_url)
    env.default_headers = data.get('default_headers', env.default_headers)
    env.default_body = data.get('default_body', env.default_body)
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


@app.route('/api/environments/reorder', methods=['PUT'])
def reorder_environments() -> Response:
    """重新排序环境"""
    data: Dict[str, Any] = request.json or {}
    ids: List[int] = data.get('ids', [])
    
    for idx, eid in enumerate(ids):
        env: Optional[Environment] = Environment.query.get(eid)
        if env:
            env.sort_order = idx
    
    db.session.commit()
    return jsonify({'success': True})


# ==================== 对比执行 ====================

@app.route('/api/diff/execute', methods=['POST'])
def execute_diff() -> Response:
    """执行对比"""
    data: Dict[str, Any] = request.json or {}
    
    try:
        result: Dict[str, Any] = diff_service.diff(
            url1=data.get('url1'),
            url2=data.get('url2'),
            method=data.get('method', 'POST'),
            headers1=data.get('headers1'),
            headers2=data.get('headers2'),
            body1=data.get('body1'),
            body2=data.get('body2')
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/diff/history', methods=['GET'])
def get_diff_history() -> Response:
    """获取对比历史"""
    records: List[DiffRecord] = DiffRecord.query.order_by(DiffRecord.created_at.desc()).limit(50).all()
    return jsonify([r.to_dict() for r in records])


@app.route('/api/diff/history/<int:record_id>', methods=['DELETE'])
def delete_diff_record(record_id: int) -> Response:
    """删除对比记录"""
    record: DiffRecord = DiffRecord.query.get_or_404(record_id)
    db.session.delete(record)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 测试用例管理 ====================

@app.route('/api/apis/<int:api_id>/test-cases', methods=['GET'])
def get_test_cases(api_id: int) -> Response:
    """获取API的所有测试用例"""
    cases: List[TestCase] = TestCase.query.filter_by(api_id=api_id).order_by(TestCase.updated_at.desc()).all()
    return jsonify([c.to_dict() for c in cases])


@app.route('/api/apis/<int:api_id>/test-cases', methods=['POST'])
def create_test_case(api_id: int) -> Response:
    """创建测试用例"""
    api: ApiConfig = ApiConfig.query.get_or_404(api_id)
    data: Dict[str, Any] = request.json or {}
    
    def _dump(val: Any) -> str:
        """将字典转为JSON字符串"""
        if isinstance(val, dict):
            return to_json(val, ensure_ascii=False)
        return val or '{}'
    
    tc: TestCase = TestCase(
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
        diff_result=_dump(data.get('diff_result'))
    )
    db.session.add(tc)
    db.session.commit()
    return jsonify({'success': True, 'id': tc.id})


@app.route('/api/test-cases/<int:tc_id>', methods=['PUT'])
def update_test_case(tc_id: int) -> Response:
    """更新测试用例"""
    tc: TestCase = TestCase.query.get_or_404(tc_id)
    data: Dict[str, Any] = request.json or {}
    
    def _dump(val: Any) -> str:
        """将字典转为JSON字符串"""
        if isinstance(val, dict):
            return to_json(val, ensure_ascii=False)
        return val or '{}'
    
    tc.name = data.get('name', tc.name)
    tc.env1_id = data.get('env1_id', tc.env1_id)
    tc.env2_id = data.get('env2_id', tc.env2_id)
    tc.url1 = data.get('url1', tc.url1)
    tc.url2 = data.get('url2', tc.url2)
    tc.method = data.get('method', tc.method)
    if 'headers1' in data:
        tc.headers1 = _dump(data['headers1'])
    if 'headers2' in data:
        tc.headers2 = _dump(data['headers2'])
    if 'body1' in data:
        tc.body1 = _dump(data['body1'])
    if 'body2' in data:
        tc.body2 = _dump(data['body2'])
    if 'diff_result' in data:
        tc.diff_result = _dump(data['diff_result'])
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/test-cases/<int:tc_id>', methods=['DELETE'])
def delete_test_case(tc_id: int) -> Response:
    """删除测试用例"""
    tc: TestCase = TestCase.query.get_or_404(tc_id)
    db.session.delete(tc)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/test-cases/reorder', methods=['PUT'])
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


# ==================== 变量管理 ====================

@app.route('/api/projects/<int:project_id>/variables', methods=['GET'])
def get_variables(project_id: int) -> Response:
    """获取项目的所有变量"""
    variables: List[Variable] = Variable.query.filter_by(project_id=project_id).all()
    return jsonify([v.to_dict() for v in variables])


@app.route('/api/projects/<int:project_id>/variables', methods=['POST'])
def create_variable(project_id: int) -> Response:
    """创建变量"""
    data: Dict[str, Any] = request.json or {}
    name: str = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'error': '变量名不能为空'}), 400
    
    var: Variable = Variable(
        project_id=project_id,
        name=name,
        value=data.get('value', ''),
        description=data.get('description', '')
    )
    db.session.add(var)
    db.session.commit()
    return jsonify({'success': True, 'id': var.id})


@app.route('/api/variables/<int:var_id>', methods=['PUT'])
def update_variable(var_id: int) -> Response:
    """更新变量"""
    var: Variable = Variable.query.get_or_404(var_id)
    data: Dict[str, Any] = request.json or {}
    var.name = data.get('name', var.name)
    var.value = data.get('value', var.value)
    var.description = data.get('description', var.description)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/variables/<int:var_id>', methods=['DELETE'])
def delete_variable(var_id: int) -> Response:
    """删除变量"""
    var: Variable = Variable.query.get_or_404(var_id)
    db.session.delete(var)
    db.session.commit()
    return jsonify({'success': True})


# ==================== 数据库迁移支持 ====================

@app.route('/api/db/migrate', methods=['POST'])
def db_migrate() -> Response:
    """执行数据库迁移（添加新列）"""
    try:
        from sqlalchemy import text
        
        # 检查并添加 sort_order 列
        columns_to_add = [
            ('projects', 'sort_order', 'INT DEFAULT 0'),
            ('api_groups', 'sort_order', 'INT DEFAULT 0'),
            ('api_configs', 'sort_order', 'INT DEFAULT 0'),
            ('environments', 'sort_order', 'INT DEFAULT 0'),
            ('test_cases', 'sort_order', 'INT DEFAULT 0'),
        ]
        
        for table, col_name, col_def in columns_to_add:
            try:
                db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {col_name} {col_def}'))
            except Exception as e:
                # 列已存在或其他错误，忽略
                print(f'添加列 {table}.{col_name} 失败（可能已存在）: {e}')
        
        # 检查并添加 test_cases.project_id 列
        try:
            db.session.execute(text('ALTER TABLE test_cases ADD COLUMN project_id INT'))
        except Exception as e:
            print(f'添加列 test_cases.project_id 失败（可能已存在）: {e}')
        
        # 检查并添加 api_configs.project_id 列
        try:
            db.session.execute(text('ALTER TABLE api_configs ADD COLUMN project_id INT'))
        except Exception as e:
            print(f'添加列 api_configs.project_id 失败（可能已存在）: {e}')
        
        db.session.commit()
        return jsonify({'success': True, 'message': '数据库迁移完成'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
