# 数据库变更记录

## 目录说明

| 文件 | 说明 |
|------|------|
| `schema.sql` | 当前完整表结构快照（全新部署用） |
| `001_init.sql` | v1.0 初始建表 |
| `002_add_sort_order.sql` | v1.1 添加排序字段 |
| `003_add_folder_support.sql` | v1.2 添加目录嵌套支持 |
| `004_add_query_params.sql` | v1.3 添加查询参数字段 |

## 使用方式

- **全新部署**：直接执行 `schema.sql` 即可
- **从旧版本升级**：按编号顺序执行迁移脚本（001 → 002 → 003 → 004）
- **自动迁移**：重启 Flask 服务，`db.create_all()` 会自动创建缺失的列
- **手动迁移**：访问 `/api/db/migrate` 端点

## 变更历史

| 版本 | 日期 | 变更内容 | 脚本 |
|------|------|----------|------|
| v1.0 | - | 初始建表，5张表：projects, api_groups, api_configs, environments, diff_records | `001_init.sql` |
| v1.1 | 2026-04-09 | 为 projects / api_groups / api_configs / environments 添加 sort_order 字段，支持拖拽排序 | `002_add_sort_order.sql` |
| v1.2 | 2026-04-15 | api_groups 表添加 parent_id 和 is_expanded 字段，支持目录嵌套；新增 test_cases、variables 表 | `003_add_folder_support.sql` |
| v1.3 | 2026-04-17 | api_configs 表添加 query_params 和 project_id 字段，支持保存 URL 查询参数 | `004_add_query_params.sql` |

## 最新变更详情

### v1.3 (2026-04-17)

**变更内容**:
```sql
ALTER TABLE api_configs ADD COLUMN query_params TEXT COMMENT 'URL查询参数(JSON对象，如{"page": "1", "size": "10"})';
ALTER TABLE api_configs ADD COLUMN project_id INT COMMENT '项目ID';
```

**变更原因**:
- 支持保存 GET 请求的 URL 查询参数
- 导入 OpenAPI/Postman 时提取 query 类型的参数
- 对比执行时自动将 query_params 拼接到 URL

**相关代码变更**:
- `models.py` - ApiConfig 类添加 query_params 字段
- `app.py` - 导入逻辑和对比逻辑更新
- `static/js/modules/folder.js` - 渲染时添加 data-query-params 属性
- `static/js/modules/api.js` - 选择API时读取 query_params
- `static/js/modules/diff.js` - 对比时发送 query_params 到后端

**执行状态**: 已执行

### v1.2 (2026-04-15)

**变更内容**:
```sql
ALTER TABLE api_groups ADD COLUMN parent_id INT DEFAULT NULL COMMENT '父目录ID';
ALTER TABLE api_groups ADD COLUMN is_expanded TINYINT DEFAULT 1 COMMENT '是否展开';
```

**变更原因**:
- 支持多级目录结构
- 前端可保存目录展开状态

**相关代码变更**:
- `models.py` - ApiGroup 类添加 parent_id 和 is_expanded 字段
- `app.py` - 添加目录管理相关接口
- `static/js/modules/folder.js` - 目录树渲染和交互

**执行状态**: 已执行

## 表关系

```
projects (项目)
  ├── api_groups (目录/分组) ──┬── api_configs (API配置)
  │   │                        │       ├── query_params (URL查询参数)
  │   │                        │       ├── diff_records (对比记录)
  │   │                        │       └── test_cases (测试用例)
  │   │                        │
  │   └── children (子目录)    │
  │                            │
  ├── environments (环境)      │
  └── variables (全局变量)     │
```

## 检查表结构

```bash
python check_db.py
```

或在 MySQL 中执行：
```sql
DESCRIBE api_configs;
```
