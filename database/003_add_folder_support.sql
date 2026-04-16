-- ============================================================
-- 003_add_folder_support.sql - 目录结构支持
-- 将分组改为目录，支持多级目录
-- ============================================================

USE mydata;

-- 添加 parent_id 字段支持子目录
ALTER TABLE `api_groups` 
ADD COLUMN `parent_id` INT DEFAULT NULL COMMENT '父目录ID，NULL表示根目录' AFTER `project_id`,
ADD KEY `idx_parent_id` (`parent_id`),
ADD CONSTRAINT `fk_api_groups_parent` FOREIGN KEY (`parent_id`) REFERENCES `api_groups` (`id`) ON DELETE CASCADE;

-- 添加 is_expanded 字段记录展开状态（可选，前端也可本地存储）
ALTER TABLE `api_groups` 
ADD COLUMN `is_expanded` TINYINT DEFAULT 1 COMMENT '是否展开，1=展开，0=收起' AFTER `description`;
