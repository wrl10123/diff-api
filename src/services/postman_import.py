"""
Postman Collection 导入服务
"""
import re
import json
from typing import Any, Dict
from src.models import db, ApiGroup, ApiConfig, Variable
from src.utils import from_json, safe_json_dumps


class PostmanImporter:
    """Postman Collection 导入器"""
    
    def import_collection(self, folder_id: int, collection: Any) -> Dict[str, Any]:
        """
        导入 Postman Collection
        
        Args:
            folder_id: 目标目录ID
            collection: Postman Collection 内容
        Returns:
            导入结果统计
        """
        folder = ApiGroup.query.get_or_404(folder_id)
        project_id = folder.project_id
        
        if isinstance(collection, str):
            collection = from_json(collection)
            if collection == {}:
                return {'success': False, 'error': 'JSON格式错误'}
        
        stats = {
            'folders_created': 0,
            'apis_imported': 0,
            'variables_imported': 0,
            'skipped': 0
        }
        
        folder_cache = {'root': folder_id}
        
        items = collection.get('item', [])
        for item in items:
            self._process_item(item, folder_id, project_id, folder_cache, stats)
        
        self._import_variables(collection, project_id, stats)
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'导入完成：创建{stats["folders_created"]}个目录，导入{stats["apis_imported"]}个API，{stats["variables_imported"]}个变量，跳过{stats["skipped"]}个重复项'
        }
    
    def _process_item(self, item: Dict[str, Any], parent_id: int, project_id: int, cache: Dict, stats: Dict):
        """递归处理Postman item"""
        if item.get('item'):
            folder_name = item.get('name', '未命名文件夹')
            new_folder_id = self._get_or_create_folder(folder_name, parent_id, project_id, cache, stats)
            for sub_item in item['item']:
                self._process_item(sub_item, new_folder_id, project_id, cache, stats)
        elif item.get('request'):
            self._import_request(item, parent_id, stats)
    
    def _get_or_create_folder(self, name: str, parent_id: int, project_id: int, cache: Dict, stats: Dict) -> int:
        """获取或创建目录"""
        cache_key = f"{parent_id}:{name}"
        if cache_key in cache:
            return cache[cache_key]
        
        existing = ApiGroup.query.filter_by(
            project_id=project_id,
            name=name,
            parent_id=parent_id
        ).first()
        
        if existing:
            cache[cache_key] = existing.id
            return existing.id
        
        new_folder = ApiGroup(
            project_id=project_id,
            name=name,
            description='从Postman导入',
            parent_id=parent_id
        )
        db.session.add(new_folder)
        db.session.flush()
        cache[cache_key] = new_folder.id
        stats['folders_created'] += 1
        return new_folder.id
    
    def _import_request(self, item: Dict[str, Any], group_id: int, stats: Dict):
        """导入单个请求"""
        request_data = item.get('request', {})
        name = item.get('name', '未命名请求')
        
        url_data = request_data.get('url', {})
        url = url_data if isinstance(url_data, str) else url_data.get('raw', '')
        
        path = url
        if '://' in url:
            parts = url.split('/', 3)
            path = '/' + parts[3] if len(parts) > 3 else '/'
        
        path = self._remove_variables(path)
        method = request_data.get('method', 'GET').upper()
        
        existing = ApiConfig.query.filter_by(
            group_id=group_id,
            path=path,
            method=method
        ).first()
        
        if existing:
            stats['skipped'] += 1
            return
        
        headers = self._extract_headers(request_data)
        body = self._extract_body(request_data)
        query_params = self._extract_query_params(url_data)
        
        api = ApiConfig(
            group_id=group_id,
            name=name,
            path=path,
            query_params=safe_json_dumps(query_params) if query_params else '{}',
            method=method,
            headers=safe_json_dumps(headers),
            body=safe_json_dumps(body),
            description=item.get('description', '')
        )
        db.session.add(api)
        stats['apis_imported'] += 1
    
    def _extract_headers(self, request_data: Dict) -> Dict:
        headers = {}
        for h in request_data.get('header', []):
            if h.get('key') and h.get('value'):
                headers[h['key']] = self._remove_variables(h['value'])
        return headers
    
    def _extract_body(self, request_data: Dict) -> Dict:
        body = {}
        body_data = request_data.get('body', {})
        
        if body_data.get('mode') == 'raw' and body_data.get('raw'):
            try:
                body = from_json(body_data['raw'])
                body = self._remove_variables(body)
            except (json.JSONDecodeError, ValueError):
                body = {'raw': self._remove_variables(body_data['raw'])}
        elif body_data.get('mode') == 'urlencoded':
            for item in body_data.get('urlencoded', []):
                if item.get('key'):
                    body[item['key']] = self._remove_variables(item.get('value', ''))
        elif body_data.get('mode') == 'formdata':
            for item in body_data.get('formdata', []):
                if item.get('key'):
                    body[item['key']] = self._remove_variables(item.get('value', ''))
        
        return body
    
    def _extract_query_params(self, url_data: Dict) -> Dict:
        query_params = {}
        if isinstance(url_data, dict):
            for q in url_data.get('query', []):
                if q.get('key'):
                    query_params[q['key']] = self._remove_variables(q.get('value', ''))
        return query_params
    
    def _import_variables(self, collection: Dict, project_id: int, stats: Dict):
        """导入变量"""
        variables = collection.get('variable', [])
        for var in variables:
            if var.get('key'):
                existing_var = Variable.query.filter_by(
                    project_id=project_id,
                    name=var['key']
                ).first()
                if not existing_var:
                    new_var = Variable(
                        project_id=project_id,
                        name=var['key'],
                        value=var.get('value', ''),
                        description=f"从Postman导入: {var.get('description', '')}"
                    )
                    db.session.add(new_var)
                    stats['variables_imported'] += 1
    
    def _remove_variables(self, value: Any) -> Any:
        """移除Postman风格的{{}}变量"""
        if isinstance(value, str):
            pattern = r'\{\{[^\}]*\}\}'
            return re.sub(pattern, '', value)
        elif isinstance(value, dict):
            return {k: self._remove_variables(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._remove_variables(item) for item in value]
        return value


postman_importer = PostmanImporter()
