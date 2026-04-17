/**
 * TypeScript 类型定义
 * 
 * 使用 JSDoc 注解提供类型提示支持
 * VSCode 等 IDE 可以自动识别并提供智能提示
 */

/**
 * @typedef {Object} Project
 * @property {number} id - 项目ID
 * @property {string} name - 项目名称
 * @property {string} [description] - 项目描述
 * @property {number} sort_order - 排序序号
 * @property {string} [created_at] - 创建时间
 * @property {string} [updated_at] - 更新时间
 */

/**
 * @typedef {Object} ApiGroup
 * @property {number} id - 目录ID
 * @property {number} project_id - 项目ID
 * @property {number|null} parent_id - 父目录ID
 * @property {string} name - 目录名称
 * @property {string} [description] - 目录描述
 * @property {ApiGroup[]} [children] - 子目录
 * @property {ApiConfig[]} [apis] - API列表
 */

/**
 * @typedef {Object} ApiConfig
 * @property {number} id - API ID
 * @property {number} group_id - 目录ID
 * @property {string} name - API名称
 * @property {string} path - 路径
 * @property {string} [query_params] - 查询参数JSON
 * @property {string} method - 请求方法
 * @property {string} [headers] - 请求头JSON
 * @property {string} [body] - 请求体JSON
 * @property {string} [description] - 描述
 */

/**
 * @typedef {Object} Environment
 * @property {number} id - 环境ID
 * @property {number} project_id - 项目ID
 * @property {string} name - 环境名称
 * @property {string} base_url - 基础URL
 * @property {string} [default_headers] - 默认请求头JSON
 * @property {string} [default_body] - 默认请求体JSON
 * @property {string} [description] - 描述
 */

/**
 * @typedef {Object} TestCase
 * @property {number} id - 用例ID
 * @property {number} api_id - API ID
 * @property {string} name - 用例名称
 * @property {number|null} env1_id - 环境1 ID
 * @property {number|null} env2_id - 环境2 ID
 * @property {string} url1 - 环境1 URL
 * @property {string} url2 - 环境2 URL
 * @property {string} method - 请求方法
 * @property {string} [headers1] - 请求头1
 * @property {string} [headers2] - 请求头2
 * @property {string} [body1] - 请求体1
 * @property {string} [body2] - 请求体2
 * @property {string} [diff_result] - 对比结果
 */

/**
 * @typedef {Object} Variable
 * @property {number} id - 变量ID
 * @property {number} project_id - 项目ID
 * @property {string} name - 变量名
 * @property {string} [value] - 变量值
 * @property {string} [description] - 描述
 */

/**
 * @typedef {Object} DiffResult
 * @property {boolean} success - 是否成功
 * @property {Object} [response1] - 环境1响应
 * @property {Object} [response2] - 环境2响应
 * @property {Object} [diff] - 差异信息
 * @property {Array} [diff.added] - 新增字段
 * @property {Array} [diff.removed] - 删除字段
 * @property {Array} [diff.changed] - 修改字段
 * @property {string} [error] - 错误信息
 */

/**
 * @typedef {'projects' | 'folders' | 'apis' | 'testCases'} SortableType
 */

/**
 * @typedef {Object} AppState
 * @property {number|null} currentProjectId
 * @property {number|null} currentFolderId
 * @property {number|null} currentGroupId
 * @property {number|null} currentTestCaseId
 * @property {Environment[]} envDataCache
 * @property {Variable[]} variableCache
 * @property {DiffResult|null} lastDiffResult
 */

// 导出类型供外部使用
export default {};
