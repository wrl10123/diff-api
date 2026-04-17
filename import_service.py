"""
导入服务模块 - 统一入口
"""
from typing import Any, Dict
from services.openapi_import import openapi_importer
from services.postman_import import postman_importer


class ImportService:
    """导入服务统一入口"""
    
    def import_openapi(self, folder_id: int, openapi_spec: Any) -> Dict[str, Any]:
        """导入 OpenAPI/Swagger 规范"""
        return openapi_importer.import_spec(folder_id, openapi_spec)
    
    def import_postman(self, folder_id: int, collection: Any) -> Dict[str, Any]:
        """导入 Postman Collection"""
        return postman_importer.import_collection(folder_id, collection)


import_service = ImportService()
