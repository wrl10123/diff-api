# DiffAPI - API对比工具

基于 Flask 的 Web 应用，用于对比同一接口在不同环境（开发/测试/生产）下的 JSON 响应差异。支持左右并排视图、字段级高亮、OpenAPI/Postman 导入、拖拽排序等功能。

## 功能特性

- **多环境对比** — 向两个环境发送相同请求，深度比较响应差异
- **可视化 Diff 视图** — 左右并排展示原始 JSON，差异行着色：
  - 红色：仅左侧有
  - 蓝色：仅右侧有
  - 黄绿色：值不一致
- **项目管理** — 支持多级目录、接口配置、环境地址管理
- **导入功能** — 支持 OpenAPI/Swagger 2.0/3.x 和 Postman Collection 导入
- **拖拽排序** — 基于 SortableJS，支持项目、目录、接口、环境拖拽重排
- **测试用例** — 保存对比参数，支持快速回放
- **变量系统** — 支持 `{{变量名}}` 占位符自动替换
- **URL参数展示** — 自动解析并展示 Query Params，支持一键复制完整URL

## 技术栈

| 层 | 技术 |
|---|------|
| 后端框架 | Python Flask 2.3+ |
| ORM | Flask-SQLAlchemy 3.0+ |
| 数据库迁移 | Flask-Migrate |
| 数据库 | MySQL (utf8mb4) |
| HTTP 客户端 | requests |
| 前端拖拽 | SortableJS |
| 前端 | 原生 ES6 模块化 |

## 项目结构

```
diffapi/
├── app.py                 # Flask 主入口
├── config.py              # 配置管理（环境变量）
├── models.py              # SQLAlchemy 数据模型
├── diff_service.py        # API对比服务
├── import_service.py      # 导入服务入口
├── utils.py               # 工具函数
├── logger.py              # 日志配置
├── migrations.py          # 数据库迁移模块
├── requirements.txt       # Python 依赖
│
├── routes/                # 路由模块
│   ├── __init__.py        # Blueprint 注册
│   ├── projects.py        # 项目管理
│   ├── folders.py         # 目录管理
│   ├── apis.py            # API管理
│   ├── environments.py    # 环境管理
│   ├── test_cases.py      # 测试用例
│   ├── variables.py       # 变量管理
│   ├── diff.py            # 对比执行
│   ├── import_routes.py   # 导入路由
│   └── error_log.py       # 错误日志
│
├── services/              # 服务模块
│   ├── __init__.py
│   ├── openapi_import.py  # OpenAPI导入
│   └── postman_import.py  # Postman导入
│
├── templates/
│   └── index.html         # 单页应用模板
│
├── static/
│   ├── css/
│   │   └── style.css      # 样式表
│   └── js/
│       ├── app.js         # 主入口
│       └── modules/       # ES6模块
│           ├── state.js       # 状态管理
│           ├── events.js      # 事件委托
│           ├── errorHandler.js# 错误处理
│           ├── project.js     # 项目管理
│           ├── folder.js      # 目录管理
│           ├── api.js         # API管理
│           ├── environment.js # 环境管理
│           ├── testCase.js    # 测试用例
│           ├── variable.js    # 变量管理
│           ├── diff.js        # 对比功能
│           ├── sortable.js    # 拖拽排序
│           ├── import.js      # 导入功能
│           ├── kvInput.js     # KV输入
│           ├── modal.js       # 弹窗管理
│           └── utils.js       # 工具函数
│
├── database/              # 数据库相关
│   └── migrations/        # 迁移脚本
│
├── .env                   # 环境配置（不提交）
├── .env.example           # 环境配置模板
└── tsconfig.json          # TypeScript配置（可选）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，修改配置：

```bash
cp .env.example .env
```

编辑 `.env`：

```ini
FLASK_ENV=development
SECRET_KEY=your-secret-key
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=diffapi
```

### 3. 启动服务

```bash
python app.py
```

默认运行在 `http://127.0.0.1:5000`

## 使用流程

1. **创建项目** — 点击「+」新建项目
2. **配置环境** — 点击「🌐」添加环境（dev/test/prod），填写 Base URL
3. **创建目录** — 点击「+」创建接口目录（支持多级）
4. **添加接口** — 在目录下添加接口，设置路径、方法、Headers、Body
5. **执行对比** — 选择API和两个环境，点击「执行对比」
6. **保存用例** — 点击「保存用例」保存当前对比配置
7. **导入接口** — 点击「⬇」支持 OpenAPI/Postman 批量导入

## API 接口

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 获取项目列表 |
| POST | `/api/projects` | 创建项目 |
| PUT | `/api/projects/<id>` | 更新项目 |
| DELETE | `/api/projects/<id>` | 删除项目 |

### 目录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/<pid>/folders` | 获取目录树 |
| POST | `/api/projects/<pid>/folders` | 创建目录 |
| PUT | `/api/folders/<id>` | 更新目录 |
| DELETE | `/api/folders/<id>` | 删除目录 |

### API管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/folders/<fid>/apis` | 获取API列表 |
| POST | `/api/folders/<fid>/apis` | 创建API |
| GET | `/api/apis/<id>` | 获取API详情 |
| PUT | `/api/apis/<id>` | 更新API |
| DELETE | `/api/apis/<id>` | 删除API |

### 环境管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/<pid>/environments` | 获取环境列表 |
| POST | `/api/projects/<pid>/environments` | 创建环境 |
| PUT | `/api/environments/<id>` | 更新环境 |
| DELETE | `/api/environments/<id>` | 删除环境 |

### 导入功能

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/folders/<fid>/import-openapi` | 导入OpenAPI |
| POST | `/api/folders/<fid>/import-postman` | 导入Postman |

### 对比功能

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/diff/execute` | 执行对比 |
| GET | `/api/diff/history` | 获取对比历史 |

## 数据库设计

### 表关系

```
projects (项目)
  ├── api_groups (目录)      [FK: project_id]
  │    ├── api_configs (API) [FK: group_id]
  │    │    └── test_cases   [FK: api_id]
  │    └── api_groups (子目录) [FK: parent_id]
  │
  ├── environments (环境)    [FK: project_id]
  └── variables (变量)       [FK: project_id]
```

### 主要表字段

| 表 | 关键字段 |
|----|---------|
| `projects` | name, description, sort_order |
| `api_groups` | project_id, parent_id, name, sort_order |
| `api_configs` | group_id, path, query_params, method, headers, body |
| `environments` | project_id, name, base_url, default_headers, default_body |
| `test_cases` | api_id, name, env1_id, env2_id, url1, url2, headers1, headers2, body1, body2, diff_result (LONGTEXT) |
| `diff_records` | api_id, env1_url, env2_url, env1_response, env2_response, diff_result (LONGTEXT) |
| `variables` | project_id, name, value |

## 安全特性

- 环境变量管理敏感配置（数据库密码、SECRET_KEY）
- 输入验证和XSS防护
- 安全的数据库迁移（白名单验证）
- 前端错误边界和全局错误处理

## 开发命令

```bash
# 启动开发服务器
python app.py

# 数据库迁移
flask db init        # 初始化迁移
flask db migrate     # 生成迁移脚本
flask db upgrade     # 应用迁移

# 运行测试（待添加）
pytest
```

## 开发日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | - | 初始版本 |
| v1.1 | 2026-04-09 | 添加拖拽排序功能 |
| v1.2 | - | Diff 结果优化 |
| v2.0 | 2026-04-17 | 大规模重构：模块化、配置分离、安全加固、SortableJS集成 |
| v2.1 | 2026-05-09 | 环境切换功能优化：支持API/用例模式不同逻辑；数据库字段类型优化（LONGTEXT）；添加并发请求支持 |

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

Please see [SECURITY.md](SECURITY.md) for security policy and reporting guidelines.
