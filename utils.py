"""
工具函数模块 - 提供JSON序列化/反序列化等公共功能
"""
import json
from typing import Any, Optional, Union


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
        JSON字符串
    """
    result = to_json(data, ensure_ascii=False)
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
