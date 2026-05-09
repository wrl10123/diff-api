"""
工具函数模块 - 提供JSON序列化/反序列化、输入验证等公共功能
"""
import html
import json
from typing import Any, Dict, Optional, Union


def sanitize_input(value: str, max_length: int = 1000) -> str:
    """
    清理用户输入，防止XSS攻击
    
    Args:
        value: 输入字符串
        max_length: 最大长度限制
    
    Returns:
        清理后的安全字符串
    """
    if not value:
        return ''
    value = str(value).strip()
    if len(value) > max_length:
        value = value[:max_length]
    return html.escape(value)


def validate_id(value: Any) -> Optional[int]:
    """
    验证ID参数
    
    Args:
        value: 待验证的值
    
    Returns:
        验证通过的整数ID，失败返回None
    """
    try:
        id_val = int(value)
        if id_val > 0:
            return id_val
    except (TypeError, ValueError):
        pass
    return None


def validate_json_field(value: Any, max_depth: int = 10) -> Dict:
    """
    验证JSON字段
    
    Args:
        value: 待验证的值
        max_depth: 最大嵌套深度
    
    Returns:
        验证后的字典
    """
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            result = from_json(value)
            if not isinstance(result, dict):
                return {}
            return result
        except Exception:
            return {}
    return {}


def to_json(obj: Any, ensure_ascii: bool = False, indent: Optional[int] = None) -> str:
    """
    将Python对象序列化为JSON字符串
    
    Args:
        obj: 要序列化的对象
        ensure_ascii: 是否转义非ASCII字符
        indent: 缩进空格数，None表示不格式化
    
    Returns:
        JSON字符串，失败时返回'{}'
    """
    if obj is None:
        return '{}'
    try:
        return json.dumps(obj, ensure_ascii=ensure_ascii, indent=indent)
    except (TypeError, ValueError):
        return '{}'


def from_json(json_str: Union[str, bytes, None], default: Any = None) -> Any:
    """
    将JSON字符串反序列化为Python对象
    
    Args:
        json_str: JSON字符串或字节
        default: 解析失败时的默认值
    
    Returns:
        解析后的Python对象，失败时返回default
    """
    if json_str is None or json_str == '':
        return default if default is not None else {}
    try:
        if isinstance(json_str, bytes):
            json_str = json_str.decode('utf-8')
        return json.loads(json_str)
    except (json.JSONDecodeError, ValueError, TypeError):
        return default if default is not None else {}


def parse_json_field(data: Union[str, dict, list, None]) -> Any:
    """
    解析可能是JSON字符串或已解析对象的字段
    
    Args:
        data: JSON字符串或已解析的对象
    
    Returns:
        解析后的对象，如果输入是对象则直接返回
    """
    if data is None:
        return {}
    if isinstance(data, (dict, list)):
        return data
    if isinstance(data, str):
        return from_json(data)
    return {}


def safe_json_dumps(data: Any, max_length: Optional[int] = None) -> str:
    """
    安全地将数据转为JSON字符串，可限制长度
    
    Args:
        data: 要序列化的数据
        max_length: 最大长度限制，超出则截断
    
    Returns:
        JSON字符串（格式化）
    """
    result = to_json(data, ensure_ascii=False, indent=2)
    if max_length and len(result) > max_length:
        result = result[:max_length]
    return result


def merge_dicts(base: dict, override: dict) -> dict:
    """
    合并两个字典，override中的键会覆盖base中的键
    
    Args:
        base: 基础字典
        override: 覆盖字典
    
    Returns:
        合并后的新字典
    """
    if not base:
        return override or {}
    if not override:
        return base
    return {**base, **override}


def dump_json(val: Any) -> str:
    """
    将字典转为JSON字符串，其他类型直接返回
    
    Args:
        val: 要处理的值
    
    Returns:
        JSON字符串（格式化，如果是字典）或原值（如果不是字典），None时返回'{}'
    """
    if isinstance(val, dict):
        return to_json(val, ensure_ascii=False, indent=2)
    return val or '{}'


def build_url(base_url: str, query_params: Dict[str, Any]) -> str:
    """
    构建带有查询参数的URL
    
    Args:
        base_url: 基础URL
        query_params: 查询参数字典
    
    Returns:
        带有查询参数的完整URL
    """
    if not query_params:
        return base_url
    from urllib.parse import urlencode, urlparse, urlunparse
    parsed = urlparse(base_url)
    existing_params = parsed.query
    new_params = urlencode(query_params, doseq=True)
    if existing_params:
        full_query = existing_params + '&' + new_params
    else:
        full_query = new_params
    return urlunparse(parsed._replace(query=full_query))
