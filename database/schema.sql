-- ============================================================
-- schema.sql - 当前完整表结构快照
-- 生成时间: 2026-04-09
-- 对应: models.py (含 sort_order 字段)
-- 用途: 全新部署时直接执行此文件即可
-- ============================================================

CREATE DATABASE IF NOT EXISTS mydata DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE mydata;

-- -----------------------------------------------------------
-- 项目表 (projects)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `projects`;
CREATE TABLE `projects` (
    `id`          INT           NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `name`        VARCHAR(100)  NOT NULL                COMMENT '项目名称',
    `description` VARCHAR(500)  DEFAULT ''              COMMENT '项目描述',
    `sort_order`  INT           DEFAULT 0               COMMENT '排序序号',
    `created_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目表';

-- -----------------------------------------------------------
-- API分组表 (api_groups)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `api_groups`;
CREATE TABLE `api_groups` (
    `id`          INT           NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `project_id`  INT           NOT NULL                COMMENT '项目ID',
    `name`        VARCHAR(100)  NOT NULL                COMMENT '分组名称',
    `description` VARCHAR(500)  DEFAULT ''              COMMENT '分组描述',
    `sort_order`  INT           DEFAULT 0               COMMENT '排序序号',
    `created_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_project_id` (`project_id`),
    CONSTRAINT `fk_api_groups_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API分组表';

-- -----------------------------------------------------------
-- 环境配置表 (environments)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `environments`;
CREATE TABLE `environments` (
    `id`               INT            NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `project_id`       INT            NOT NULL                COMMENT '项目ID',
    `name`             VARCHAR(50)    NOT NULL                COMMENT '环境名称，如dev/test/prod',
    `base_url`         VARCHAR(500)   NOT NULL                COMMENT '环境基础URL',
    `default_headers`  TEXT                                   COMMENT '默认请求头(JSON字符串)',
    `default_body`     TEXT                                   COMMENT '默认请求体(JSON字符串)',
    `description`      VARCHAR(200)   DEFAULT ''             COMMENT '环境描述',
    `sort_order`       INT            DEFAULT 0              COMMENT '排序序号',
    `created_at`       DATETIME       DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`       DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_project_id` (`project_id`),
    CONSTRAINT `fk_environments_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='环境配置表';

-- -----------------------------------------------------------
-- API配置表 (api_configs)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `api_configs`;
CREATE TABLE `api_configs` (
    `id`          INT           NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `group_id`    INT           NOT NULL                COMMENT '分组ID',
    `name`        VARCHAR(100)  NOT NULL                COMMENT 'API名称',
    `path`        VARCHAR(500)  NOT NULL                COMMENT '路径',
    `method`      VARCHAR(10)   DEFAULT 'POST'          COMMENT '请求方法',
    `headers`     TEXT                                   COMMENT '请求头(JSON字符串)',
    `body`        TEXT                                   COMMENT '请求体(JSON字符串)',
    `description` VARCHAR(500)  DEFAULT ''              COMMENT '描述',
    `sort_order`  INT           DEFAULT 0               COMMENT '排序序号',
    `created_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_group_id` (`group_id`),
    CONSTRAINT `fk_api_configs_group` FOREIGN KEY (`group_id`) REFERENCES `api_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API配置表';

-- -----------------------------------------------------------
-- 对比记录表 (diff_records)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `diff_records`;
CREATE TABLE `diff_records` (
    `id`           INT           NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `api_id`       INT           NOT NULL                COMMENT 'API配置ID',
    `env1_url`     VARCHAR(500)  NOT NULL                COMMENT '环境1 URL',
    `env2_url`     VARCHAR(500)  NOT NULL                COMMENT '环境2 URL',
    `env1_response` TEXT                                  COMMENT '环境1响应(截取前2000字符)',
    `env2_response` TEXT                                  COMMENT '环境2响应(截取前2000字符)',
    `diff_result`  TEXT                                   COMMENT '对比结果(JSON,截取前2000字符)',
    `created_at`   DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_api_id` (`api_id`),
    CONSTRAINT `fk_diff_records_api` FOREIGN KEY (`api_id`) REFERENCES `api_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对比记录表';

-- -----------------------------------------------------------
-- 测试用例表 (test_cases)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `test_cases`;
CREATE TABLE `test_cases` (
    `id`          INT           NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `api_id`      INT           NOT NULL                COMMENT 'API配置ID',
    `name`        VARCHAR(100)  NOT NULL DEFAULT '未命名用例' COMMENT '用例名称',
    `env1_id`     INT                                   COMMENT '环境1 ID',
    `env2_id`     INT                                   COMMENT '环境2 ID',
    `url1`        VARCHAR(500)  NOT NULL                COMMENT '环境1完整URL',
    `url2`        VARCHAR(500)  NOT NULL                COMMENT '环境2完整URL',
    `method`      VARCHAR(10)   DEFAULT 'POST'          COMMENT '请求方法',
    `headers1`    TEXT                                  COMMENT '环境1请求头(JSON字符串)',
    `headers2`    TEXT                                  COMMENT '环境2请求头(JSON字符串)',
    `body1`       TEXT                                  COMMENT '环境1请求体(JSON字符串)',
    `body2`       TEXT                                  COMMENT '环境2请求体(JSON字符串)',
    `diff_result` TEXT                                  COMMENT '最近一次对比结果(JSON)',
    `created_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_api_id` (`api_id`),
    CONSTRAINT `fk_test_cases_api` FOREIGN KEY (`api_id`) REFERENCES `api_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试用例表';

-- -----------------------------------------------------------
-- 全局变量表 (variables)
-- -----------------------------------------------------------
DROP TABLE IF EXISTS `variables`;
CREATE TABLE `variables` (
    `id`          INT           NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `project_id`  INT           NOT NULL                COMMENT '项目ID',
    `name`        VARCHAR(100)  NOT NULL                COMMENT '变量名',
    `value`       TEXT                                  COMMENT '变量值',
    `description` VARCHAR(500)  DEFAULT ''              COMMENT '描述',
    `created_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_project_id` (`project_id`),
    CONSTRAINT `fk_variables_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uq_project_variable` (`project_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='全局变量表';
