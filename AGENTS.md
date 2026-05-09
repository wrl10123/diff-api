# AGENTS.md - DiffAPI 项目指南

## 项目概述

DiffAPI 是一个基于 Flask 的 API 对比工具，用于对比同一接口在不同环境下的 JSON 响应差异。

## 技术栈

- **后端**: Python Flask 2.3+, SQLAlchemy, MySQL
- **前端**: 原生 ES6 模块化, SortableJS
- **数据库**: MySQL (utf8mb4)

## 核心模块

### 后端

- `app.py` - Flask 主入口
- `src/` - 源代码目录
  - `config.py` - 配置管理（环境变量）
  - `models.py` - 数据模型（Project, ApiGroup, ApiConfig, Environment, TestCase, Variable）
  - `diff_service.py` - API 对比服务（支持并发请求）
  - `logger.py` - 日志配置（支持 root logger）
  - `migrations.py` - 安全数据库迁移
  - `routes/` - API 路由模块
  - `services/` - 导入服务模块

### 前端

- `static/js/modules/state.js` - 全局状态管理
- `static/js/modules/api.js` - API 管理
- `static/js/modules/environment.js` - 环境管理（含 onEnvChange 逻辑）
- `static/js/modules/testCase.js` - 测试用例管理
- `static/js/modules/events.js` - 事件委托

## 关键逻辑

### 环境切换逻辑 (onEnvChange)

位于 `static/js/modules/environment.js`:

1. **选中API模式**: 切换环境时，headers = 环境默认值 + API headers
2. **选中用例模式**: 切换环境时，headers = 新环境默认值（覆盖），标记保存按钮高亮

### 状态缓存

- `apiHeadersCache` / `apiBodyCache` - 缓存当前选中API的 headers/body
- `currentTestCaseId` - 当前选中的用例ID（影响环境切换行为）

### 数据库字段

- `test_cases.diff_result` - LONGTEXT 类型（支持大文本）
- `diff_records.diff_result` - LONGTEXT 类型

## 开发注意事项

1. **ES6 模块**: 前端使用原生 ES6 模块，注意循环依赖问题
2. **状态同步**: `window.currentTestCaseId` 与模块状态需要同步
3. **日志**: 使用 `logging.getLogger(__name__)`，root logger 已配置
4. **并发请求**: diff_service 使用 ThreadPoolExecutor 并发请求两个环境

## 常用命令

```bash
# 启动服务
python app.py

# 数据库迁移
curl -X POST http://localhost:5000/api/db/migrate
```

## 最近变更 (2026-05-09)

1. 环境切换功能重构 - 支持API/用例模式不同逻辑
2. 数据库字段优化 - diff_result 改为 LONGTEXT
3. 添加并发请求支持
4. 修复日志配置，支持模块级日志
