-- ============================================================
-- 003_add_directory_parent_id.sql - 变更记录 (v1.2)
-- 日期: 2026-04-15
-- 变更: 为 api_groups 表添加 parent_id 字段，支持目录嵌套
-- 前置: 需先执行 001_init.sql 和 002_add_sort_order.sql
-- ============================================================

USE mydata;

-- -----------------------------------------------------------
-- API分组(目录)表：添加父目录字段，支持多级目录
-- -----------------------------------------------------------
ALTER TABLE `api_groups`
    ADD COLUMN `parent_id` INT DEFAULT NULL COMMENT '父目录ID，NULL表示根目录' AFTER `project_id`;

-- 添加索引
ALTER TABLE `api_groups` ADD KEY `idx_parent_id` (`parent_id`);

-- 添加外键约束
ALTER TABLE `api_groups`
    ADD CONSTRAINT `fk_api_groups_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `api_groups` (`id`)
    ON DELETE CASCADE;

-- -----------------------------------------------------------
-- 更新表注释
-- -----------------------------------------------------------
ALTER TABLE `api_groups` COMMENT='API目录表（支持多级嵌套）';
