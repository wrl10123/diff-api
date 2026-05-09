"""
OpenAPI/Swagger 导入服务
"""
from typing import Any, Dict
from src.models import db, ApiGroup, ApiConfig, TestCase
from src.utils import from_json, safe_json_dumps


class OpenAPIImporter:
    """OpenAPI/Swagger 导入器"""
    
    def import_spec(self, folder_id: int, openapi_spec: Any) -> Dict[str, Any]:
        """
        导入 OpenAPI/Swagger 规范
        
        Args:
            folder_id: 目标目录ID
            openapi_spec: OpenAPI 规范内容
        
        Returns:
            导入结果统计
        """
        folder = ApiGroup.query.get_or_404(folder_id)
        project_id = folder.project_id
        
        if isinstance(openapi_spec, str):
            openapi_spec = from_json(openapi_spec)
            if openapi_spec == {}:
                return {'success': False, 'error': 'JSON格式错误'}
        
        paths = openapi_spec.get('paths', {})
        if not paths:
            return {'success': False, 'error': 'OpenAPI规范中未找到paths定义'}
        
        stats = {
            'folders_created': 0,
            'apis_imported': 0,
            'test_cases_imported': 0,
            'skipped': 0
        }
        
        http_methods = {'get', 'post', 'put', 'delete', 'patch', 'head', 'options'}
        folder_cache = {'root': folder_id}
        
        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue
            
            for method in http_methods:
                operation = path_item.get(method)
                if not operation or not isinstance(operation, dict):
                    continue
                
                target_group_id = self._get_target_folder(
                    operation, path_item, folder_id, project_id, folder_cache, stats
                )
                
                existing = ApiConfig.query.filter_by(
                    group_id=target_group_id,
                    path=path,
                    method=method.upper()
                ).first()
                
                if existing:
                    stats['skipped'] += 1
                    continue
                
                api_name = (
                    operation.get('summary')
                    or operation.get('operationId')
                    or f'{method.upper()} {path}'
                )
                
                api = ApiConfig(
                    group_id=target_group_id,
                    name=api_name,
                    path=path,
                    query_params=self._extract_query_params(operation),
                    method=method.upper(),
                    headers=self._extract_headers(operation),
                    body=self._extract_body(operation),
                    description=operation.get('description', '')
                )
                db.session.add(api)
                db.session.flush()
                stats['apis_imported'] += 1
                
                self._import_test_cases(api.id, operation, stats)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'导入完成：创建{stats["folders_created"]}个目录，导入{stats["apis_imported"]}个API，{stats["test_cases_imported"]}个测试用例，跳过{stats["skipped"]}个重复项'
        }
    
    def _get_target_folder(self, operation, path_item, root_folder_id, project_id, folder_cache, stats):
        """确定API所属目录"""
        x_group = operation.get('x-group') or path_item.get('x-group')
        if x_group:
            return self._get_or_create_folder(x_group, root_folder_id, project_id, folder_cache, stats)
        
        tags = operation.get('tags', [])
        if tags:
            return self._get_or_create_folder(tags[0], root_folder_id, project_id, folder_cache, stats)
        
        return root_folder_id
    
    def _get_or_create_folder(self, folder_path, root_id, project_id, cache, stats):
        """获取或创建目录"""
        cache_key = f"{root_id}:{folder_path}"
        if cache_key in cache:
            return cache[cache_key]
        
        path_parts = folder_path.split('/')
        current_parent = root_id
        current_path = ""
        
        for part in path_parts:
            if not part.strip():
                continue
            current_path = f"{current_path}/{part}" if current_path else part
            cache_key_part = f"{current_parent}:{part}"
            
            if cache_key_part in cache:
                current_parent = cache[cache_key_part]
                continue
            
            existing = ApiGroup.query.filter_by(
                project_id=project_id,
                name=part,
                parent_id=current_parent
            ).first()
            
            if existing:
                cache[cache_key_part] = existing.id
                current_parent = existing.id
            else:
                new_folder = ApiGroup(
                    project_id=project_id,
                    name=part,
                    description=f'从OpenAPI导入: {current_path}',
                    parent_id=current_parent
                )
                db.session.add(new_folder)
                db.session.flush()
                cache[cache_key_part] = new_folder.id
                current_parent = new_folder.id
                stats['folders_created'] += 1
        
        cache[cache_key] = current_parent
        return current_parent
    
    def _import_test_cases(self, api_id, operation, stats):
        """导入测试用例"""
        x_test_cases = operation.get('x-test-cases', [])
        for tc in x_test_cases:
            test_case = TestCase(
                api_id=api_id,
                name=tc.get('name', f'用例_{stats["test_cases_imported"]+1}'),
                env1_id=tc.get('env1_id'),
                env2_id=tc.get('env2_id'),
                url1=tc.get('url1', ''),
                url2=tc.get('url2', ''),
                headers1=safe_json_dumps(tc.get('headers1', {})),
                headers2=safe_json_dumps(tc.get('headers2', {})),
                body1=safe_json_dumps(tc.get('body1', {})),
                body2=safe_json_dumps(tc.get('body2', {})),
                method=tc.get('method', 'POST'),
                diff_result=safe_json_dumps(tc.get('diff_result', {}))
            )
            db.session.add(test_case)
            stats['test_cases_imported'] += 1
    
    def _extract_headers(self, operation: Dict[str, Any]) -> str:
        headers = {}
        for param in operation.get('parameters', []):
            if param.get('in') == 'header':
                headers[param.get('name')] = param.get('schema', {}).get('default', '')
        
        request_body = operation.get('requestBody', {})
        content = request_body.get('content', {})
        if 'application/json' in content:
            headers['Content-Type'] = 'application/json'
        elif content:
            headers['Content-Type'] = list(content.keys())[0]
        
        return safe_json_dumps(headers) if headers else '{}'
    
    def _extract_body(self, operation: Dict[str, Any]) -> str:
        request_body = operation.get('requestBody', {})
        content = request_body.get('content', {})
        
        for content_type, content_def in content.items():
            example = content_def.get('example')
            if example:
                return safe_json_dumps(example)
            
            examples = content_def.get('examples', {})
            if examples:
                first_example = list(examples.values())[0]
                if isinstance(first_example, dict) and 'value' in first_example:
                    return safe_json_dumps(first_example['value'])
            
            schema = content_def.get('schema', {})
            if schema:
                return self._generate_example_from_schema(schema)
        
        return '{}'
    
    def _extract_query_params(self, operation: Dict[str, Any]) -> str:
        query_params = {}
        for param in operation.get('parameters', []):
            if param.get('in') == 'query':
                param_name = param.get('name')
                if param_name:
                    query_params[param_name] = param.get('schema', {}).get('default', '')
        return safe_json_dumps(query_params) if query_params else '{}'
    
    def _generate_example_from_schema(self, schema: Dict[str, Any]) -> str:
        schema_type = schema.get('type', 'object')
        
        if schema_type == 'object':
            properties = schema.get('properties', {})
            example = {}
            for prop_name, prop_schema in properties.items():
                example[prop_name] = self._get_example_value(prop_schema)
            return safe_json_dumps(example)
        
        elif schema_type == 'array':
            items = schema.get('items', {})
            return safe_json_dumps([self._get_example_value(items)])
        
        return '{}'
    
    def _get_example_value(self, prop_schema: Dict[str, Any]) -> Any:
        prop_type = prop_schema.get('type', 'string')
        example = prop_schema.get('example')
        
        if example is not None:
            return example
        
        if prop_type == 'string':
            return prop_schema.get('default', '')
        elif prop_type in ('integer', 'number'):
            return prop_schema.get('default', 0)
        elif prop_type == 'boolean':
            return prop_schema.get('default', False)
        elif prop_type == 'array':
            return []
        elif prop_type == 'object':
            return {}
        
        return None


openapi_importer = OpenAPIImporter()
