# DiffAPI - 接口差异对比工具

基于 Flask 的 Web 应用，用于对比同一接口在不同环境（开发/测试/生产）下的 JSON 响应差异。支持左右并排视图、字段级高亮、OpenAPI 导入、拖拽排序等功能。

## 功能特性

- **多环境对比** — 向两个环境发送相同请求，深度比较响应差异
- **可视化 Diff 视图** — 左右并排展示原始 JSON，仅对差异行着色背景色：
  - 红色 (`sbd-del`)：该侧独有字段或值不同的字段
  - 黄绿色 (`sbd-mod`)：两侧值不一致的字段
- **项目管理** — 创建项目，管理分组、接口配置、环境地址
- **OpenAPI/Swagger 导入** — 支持 OpenAPI 2.0/3.x 规范批量导入接口
- **拖拽排序** — 项目、分组、接口、环境均支持拖拽重排
- **对比历史** — 保存最近 20 条对比记录，支持回溯查看
- **请求自定义** — 支持任意 HTTP 方法、自定义 Headers 和 Body（JSON/Key-Value 双模式）
- **自动建表** — 启动时自动检测并创建缺失表和字段

## 技术栈

| 层 | 技术 |
|---|------|
| 后端框架 | Python Flask >= 2.3.0 |
| ORM | Flask-SQLAlchemy >= 3.0.0 |
| 数据库 | MySQL (utf8mb4) |
| 数据库驱动 | PyMySQL >= 1.1.0 |
| HTTP 客户端 | requests >= 2.31.0 |
| 前端 | 原生 HTML + CSS + JavaScript（无框架依赖） |

## 项目结构

```
diffapi/
├── app.py                  # Flask 主应用（路由、配置、数据库初始化）
├── models.py               # SQLAlchemy 数据模型（5 张表）
├── diff_service.py         # 核心引擎：HTTP 请求 + 深度 JSON 对比
├── init_db.py              # 独立数据库初始化脚本
├── requirements.txt        # Python 依赖
│
├── database/               # 数据库迁移脚本
│   ├── schema.sql          # 当前完整表结构（全新部署用）
│   ├── 001_init.sql        # v1.0 初始建表
│   ├── 002_add_sort_order.sql  # v1.1 排序字段迁移
│   └── README.md           # 迁移文档与表关系图
│
├── templates/
│   └── index.html          # 单页应用模板
│
├── static/
│   ├── css/style.css       # 样式表
│   └── js/app.js           # 前端逻辑（Diff 渲染、交互等）
│
└── other/                  # 辅助脚本（非核心）
    ├── t1.py               # DeepDiff 原型
    ├── m.py / m1.py        # Mock 数据生成器
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置数据库

在 `app.py` 中修改数据库连接字符串：

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://用户名:密码@主机:端口/diffapi?charset=utf8mb4'
```

或使用 `init_db.py` 脚本创建数据库：

```bash
python init_db.py
```

> 首次启动时应用会自动执行 `db.create_all()` 创建缺失的表。

### 3. 启动服务

```bash
python app.py
```

默认运行在 `http://127.0.0.1:5000`

## 使用流程

1. **创建项目** — 点击「新建项目」输入项目名称
2. **添加环境** — 在项目下添加环境（如 dev、test、prod），填写各环境的 Base URL
3. **创建分组** — 在项目下创建接口分组
4. **配置接口** — 在分组中添加接口，设置请求路径、方法、Headers、Body
5. **执行对比** — 选择两个环境，点击「开始对比」，查看差异结果
6. **导入接口**（可选）— 通过 OpenAPI/Swagger JSON 批量导入接口定义

## 数据库设计

### 表关系

```
projects (项目)
  ├── api_groups (分组)     [FK: project_id → CASCADE]
  │    └── api_configs (接口) [FK: group_id → CASCADE]
  │         └── diff_records (对比记录) [FK: api_id → CASCADE]
  │
  └── environments (环境)    [FK: project_id → CASCADE]
```

### 主要字段说明

| 表 | 关键字段 | 说明 |
|----|---------|------|
| `projects` | name, description, sort_order | 项目基本信息 |
| `api_groups` | project_id, name, sort_order | 分组归属项目 |
| `api_configs` | group_id, path, method, headers, body | 接口路径/方法/参数（headers/body 为 JSON 文本） |
| `environments` | project_id, base_url, default_headers | 环境 URL 与默认头 |
| `diff_records` | api_id, env1_url, env2_url, env1_response, env2_response, diff_result | 对比记录（响应文本截取前 2000 字符） |

完整 DDL 见 `database/schema.sql`。

## API 接口

所有接口返回 JSON 格式，基础路径为 `/api`。

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects?sort=` | 获取项目列表（支持排序） |
| POST | `/api/projects` | 创建项目 |
| PUT | `/api/projects/<id>` | 更新项目 |
| DELETE | `/api/projects/<id>` | 删除项目（级联删除） |
| PUT | `/api/projects/reorder` | 批量排序 `{ids: [...]}` |

### 分组管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/<pid>/groups` | 获取分组列表 |
| POST | `/api/projects/<pid>/groups` | 创建分组 |
| PUT | `/api/groups/<id>` | 更新分组 |
| DELETE | `/api/groups/<id>` | 删除分组 |
| POST | `/api/groups/<id>/import-openapi` | 导入 OpenAPI/Swagger |
| PUT | `/api/groups/reorder` | 批量排序 |

### 接口管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/groups/<gid>/apis` | 获取接口列表 |
| POST | `/api/groups/<gid>/apis` | 创建接口 |
| GET | `/api/apis/<id>` | 获取接口详情 |
| PUT | `/api/apis/<id>` | 更新接口 |
| DELETE | `/api/apis/<id>` | 删除接口 |
| PUT | `/api/apis/reorder` | 批量排序 |

### 环境管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/<pid>/environments` | 获取环境列表 |
| POST | `/api/projects/<pid/environments` | 创建环境 |
| PUT | `/api/environments/<id>` | 更新环境 |
| DELETE | `/api/environments/<id>` | 删除环境 |
| PUT | `/api/environments/reorder` | 批量排序 |

### 对比功能

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/diff` | 执行对比（传入两个环境 URL + 请求参数） |
| GET | `/api/diff/records/<api_id>` | 获取某接口的对比历史（最近 20 条） |

## Diff 引擎说明

核心对比逻辑位于 `diff_service.py` 的 `DiffService` 类：

- **HTTP 请求**：向两个目标 URL 发送相同方法/Headers/Body，超时 30 秒
- **GET 特殊处理**：Body 参数转为 query string 传递
- **深度对比**递归遍历 JSON 结构，检测：
  - 类型变化（如 string → number）
  - 新增字段（env2 有而 env1 无）
  - 删除字段（env1 有而 env2 无）
  - 值变更（记录前后值）
  - 数组元素逐位比较
- **前端渲染**：使用 `JSON.stringify(obj, null, 2)` 保持原始格式，通过路径匹配算法对差异行着色

## 开发日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | - | 初始版本：项目管理、环境管理、接口 CRUD、Diff 对比、OpenAPI 导入 |
| v1.1 | 2026-04-09 | 添加拖拽排序功能（sort_order 字段）、服务器端排序 |
| v1.2 | - | Diff 结果优化：保留原始 JSON 格式、仅对差异行背景着色、同步滚动对比视图 |

## License

MIT
