-- ============================================================
-- 004_add_query_params.sql - 变更记录 (v1.3)
-- 日期: 2026-04-17
-- 变更: 为 api_configs 表添加 query_params 和 project_id 字段
-- 前置: 需先执行 001_init.sql、002_add_sort_order.sql、003_add_folder_support.sql
-- ============================================================

USE mydata;

-- -----------------------------------------------------------
-- API配置表：添加查询参数字段
-- 用途: 存储 URL 查询参数
-- -----------------------------------------------------------
ALTER TABLE `api_configs`
    ADD COLUMN `query_params` TEXT COMMENT 'URL查询参数(JSON对象，如{"page": "1", "size": "10"})' AFTER `body`;

-- -----------------------------------------------------------
-- API配置表：添加项目ID字段（预留）
-- 用途: 直接关联项目（当前通过 group_id 间接关联）
-- -----------------------------------------------------------
ALTER TABLE `api_configs`
    ADD COLUMN `project_id` INT COMMENT '项目ID' AFTER `group_id`;

-- -----------------------------------------------------------
-- 回滚语句（如需撤销）
-- -----------------------------------------------------------
-- ALTER TABLE api_configs DROP COLUMN query_params;
-- ALTER TABLE api_configs DROP COLUMN project_id;
