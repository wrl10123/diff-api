# 数据库变更记录

## 目录说明

| 文件 | 说明 |
|------|------|
| `001_init.sql` | 初始建表语句（v1.0） |
| `002_add_sort_order.sql` | 变更：为4张表添加 sort_order 排序字段（v1.1） |
| `schema.sql` | 当前完整表结构快照（始终与 models.py 保持一致） |

## 使用方式

- **全新部署**：直接执行 `schema.sql` 即可
- **从旧版本升级**：按编号顺序执行迁移脚本（001 → 002 → ...）
- **查看当前结构**：参考 `schema.sql`

## 变更历史

| 版本 | 日期 | 变更内容 | 脚本 |
|------|------|----------|------|
| v1.0 | - | 初始建表，5张表：projects, api_groups, api_configs, environments, diff_records | `001_init.sql` |
| v1.1 | 2026-04-09 | 为 projects / api_groups / api_configs / environments 添加 sort_order 字段，支持拖拽排序 | `002_add_sort_order.sql` |

## 表关系

```
projects (项目)
  ├── api_groups (分组) ──┬── api_configs (API配置)
  │                       │       │
  │                       │       └── diff_records (对比记录)
  │                       │
  └── environments (环境)
```
