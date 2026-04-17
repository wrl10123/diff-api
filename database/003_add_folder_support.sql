-- ============================================================
-- 003_add_folder_support.sql - 变更记录 (v1.2)
-- 日期: 2026-04-15
-- 变更: 为 api_groups 表添加 parent_id 和 is_expanded 字段，支持目录嵌套
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
-- API分组(目录)表：添加展开状态字段
-- -----------------------------------------------------------
ALTER TABLE `api_groups`
    ADD COLUMN `is_expanded` TINYINT DEFAULT 1 COMMENT '是否展开，1=展开，0=收起' AFTER `description`;

-- -----------------------------------------------------------
-- 更新表注释
-- -----------------------------------------------------------
ALTER TABLE `api_groups` COMMENT='API目录表（支持多级嵌套）';
