"""
API对比服务
"""
import requests
import json
import logging

logger = logging.getLogger(__name__)


class DiffService:
    """API差异对比服务"""
    
    def diff(self, url1, url2, method='POST', headers1=None, headers2=None, body1=None, body2=None):
        """
        执行两个API的对比
        
        Args:
            url1: 环境1 URL
            url2: 环境2 URL
            method: 请求方法
            headers1: 环境1请求头
            headers2: 环境2请求头
            body1: 环境1请求体
            body2: 环境2请求体
        
        Returns:
            dict: 包含success、response1、response2、diff等字段
        """
        if headers1 is None:
            headers1 = {}
        if headers2 is None:
            headers2 = {}
        if body1 is None:
            body1 = {}
        if body2 is None:
            body2 = {}
        
        # 打印请求信息
        logger.info(f'========== API对比开始 ==========')
        logger.info(f'环境1 URL: {url1}')
        logger.info(f'环境1 Body: {json.dumps(body1, ensure_ascii=False, indent=2)}')
        logger.info(f'环境2 URL: {url2}')
        logger.info(f'环境2 Body: {json.dumps(body2, ensure_ascii=False, indent=2)}')
        logger.info(f'请求方法: {method}')
        
        result = {
            'success': False,
            'response1': None,
            'response2': None,
            'diff': None,
            'error': None
        }
        
        # 发送请求到环境1
        try:
            response1 = self._send_request(url1, method, headers1, body1)
            result['response1'] = response1
        except Exception as e:
            result['error'] = f'环境1请求失败: {str(e)}'
            return result
        
        # 发送请求到环境2
        try:
            response2 = self._send_request(url2, method, headers2, body2)
            result['response2'] = response2
        except Exception as e:
            result['error'] = f'环境2请求失败: {str(e)}'
            return result
        
        # 执行对比
        diff = self._compare(response1, response2)
        result['diff'] = diff
        result['success'] = True
        
        return result
    
    def _send_request(self, url, method, headers, body):
        """发送HTTP请求"""
        # 确保 headers 中的所有值都是字符串
        str_headers = {}
        if headers:
            for key, value in headers.items():
                if value is not None:
                    str_headers[key] = str(value)
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=str_headers, params=body, timeout=30)
            elif method.upper() in ['POST', 'PUT', 'DELETE']:
                response = requests.request(method, url, headers=str_headers, json=body, timeout=30)
            else:
                response = requests.request(method, url, headers=str_headers, json=body, timeout=30)
            
            # 尝试解析JSON响应
            try:
                return response.json()
            except (json.JSONDecodeError, ValueError):
                return {'text': response.text, 'status_code': response.status_code}
        except requests.exceptions.Timeout:
            raise Exception('请求超时')
        except requests.exceptions.ConnectionError:
            raise Exception('连接失败')
        except Exception as e:
            raise Exception(f'请求异常: {str(e)}')
    
    def _compare(self, data1, data2):
        """
        对比两个JSON数据，返回差异
        
        Returns:
            dict: 包含added、removed、changed等差异信息
        """
        diff = {
            'added': [],      # 环境2新增的字段
            'removed': [],    # 环境2移除的字段
            'changed': [],    # 数值改变的字段
            'unchanged': []   # 相同的字段
        }
        
        self._deep_compare(data1, data2, '', diff)
        
        return diff
    
    def _deep_compare(self, data1, data2, path, diff):
        """递归对比数据"""
        # 如果两者类型不同
        if type(data1) != type(data2):
            diff['changed'].append({
                'path': path,
                'type_changed': True,
                'env1': {'type': type(data1).__name__, 'value': str(data1)[:100]},
                'env2': {'type': type(data2).__name__, 'value': str(data2)[:100]}
            })
            return
        
        # 如果是字典
        if isinstance(data1, dict):
            all_keys = set(data1.keys()) | set(data2.keys())
            for key in all_keys:
                new_path = f"{path}.{key}" if path else key
                
                if key not in data1:
                    diff['added'].append({'path': new_path, 'value': data2[key]})
                elif key not in data2:
                    diff['removed'].append({'path': new_path, 'value': data1[key]})
                else:
                    self._deep_compare(data1[key], data2[key], new_path, diff)
        
        # 如果是列表
        elif isinstance(data1, list):
            if len(data1) != len(data2):
                diff['changed'].append({
                    'path': path,
                    'env1_length': len(data1),
                    'env2_length': len(data2),
                    'env1': data1,
                    'env2': data2
                })
            else:
                for i, (item1, item2) in enumerate(zip(data1, data2)):
                    self._deep_compare(item1, item2, f"{path}[{i}]", diff)
        
        # 基础类型
        else:
            if data1 == data2:
                diff['unchanged'].append({'path': path, 'value': data1})
            else:
                diff['changed'].append({
                    'path': path,
                    'env1': data1,
                    'env2': data2
                })