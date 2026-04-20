'use strict';

/**
 * src/database/migrate.js
 * 新增表的迁移脚本，在 server.js 启动时自动执行。
 * 使用 queryInterface.createTable({ ifNotExists: true })，兼容 SQLite 和 MySQL。
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

async function runMigrations() {
  const qi = sequelize.getQueryInterface();

  // ── 1. ModelConfig ─────────────────────────────────────────────
  await qi.createTable('ModelConfig', {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role:        { type: DataTypes.STRING(50),  allowNull: false, unique: true },
    provider:    { type: DataTypes.STRING(20),  allowNull: false },
    model_name:  { type: DataTypes.STRING(100), allowNull: false },
    api_key_env: { type: DataTypes.STRING(100), allowNull: false },
    temperature: { type: DataTypes.FLOAT,   defaultValue: 0.7 },
    max_tokens:  { type: DataTypes.INTEGER, defaultValue: 4000 },
    is_active:   { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true });

  // ── 2. NodeConversation ────────────────────────────────────────
  await qi.createTable('NodeConversation', {
    id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workflow_result_id:  { type: DataTypes.INTEGER, allowNull: false },
    role:                { type: DataTypes.STRING(20), allowNull: false }, // user | assistant | system
    content:             { type: DataTypes.TEXT, allowNull: false },
    created_at:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true });

  // ── 3. ExperienceProposal ──────────────────────────────────────
  await qi.createTable('ExperienceProposal', {
    id:                       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    source_workflow_result_id:{ type: DataTypes.INTEGER, allowNull: false },
    content:                  { type: DataTypes.TEXT, allowNull: false },
    // 人设架构 / 节奏规律 / 剧情结构 / 对白风格 / 改编策略 / 世界观
    category:                 { type: DataTypes.STRING(20), allowNull: false },
    // pending | approved | rejected
    status:                   { type: DataTypes.STRING(20), defaultValue: 'pending' },
    created_at:               { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true });

  // ── 4. ExperiencePool ─────────────────────────────────────────
  await qi.createTable('ExperiencePool', {
    id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    content:            { type: DataTypes.TEXT, allowNull: false },
    category:           { type: DataTypes.STRING(20), allowNull: false },
    source_project_ids: { type: DataTypes.TEXT, defaultValue: '[]' },
    validation_count:   { type: DataTypes.INTEGER, defaultValue: 1 },
    promoted_at:        { type: DataTypes.DATE, allowNull: true },
    promoted_to_rule_id:{ type: DataTypes.INTEGER, allowNull: true },
    created_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true });

  // ── 5. ScriptSample（预留）────────────────────────────────────
  await qi.createTable('ScriptSample', {
    id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title:        { type: DataTypes.STRING(200), allowNull: false },
    content:      { type: DataTypes.TEXT, allowNull: false },
    tags:         { type: DataTypes.TEXT, defaultValue: '[]' },
    extracted_at: { type: DataTypes.DATE, allowNull: true },
    created_at:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true });

  console.log('[Migrate] 新增表检查完成（ModelConfig / NodeConversation / ExperienceProposal / ExperiencePool / ScriptSample）');

  // ── ExperiencePool 补列（promotion_rejected）─────────────────
  try {
    await qi.addColumn('ExperiencePool', 'promotion_rejected', {
      type: DataTypes.BOOLEAN, defaultValue: false,
    });
    console.log('[Migrate] ExperiencePool.promotion_rejected 列已添加');
  } catch {
    // 列已存在时 SQLite 会报错，忽略即可
  }

  // ── ModelConfig seed 数据 ──────────────────────────────────────
  await seedModelConfig();
}

async function seedModelConfig() {
  // 使用 Sequelize Model 操作，避免列名写死
  const { ModelConfig } = require('../models');
  const count = await ModelConfig.count();
  if (count > 0) return;

  await ModelConfig.bulkCreate([
    { role: 'wf01_analyst',  provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'wf02_planner',  provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'wf03_executor', provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'wf04_outliner', provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'wf05_writer',   provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'advisor',       provider: 'anthropic',  model_name: 'claude-sonnet-4-5', api_key_env: 'ANTHROPIC_API_KEY', temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'summarizer',    provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'promoter',      provider: 'deepseek',   model_name: 'deepseek-chat',     api_key_env: 'DEEPSEEK_API_KEY',  temperature: 0.7, max_tokens: 4000, is_active: true },
    { role: 'director',      provider: 'anthropic',  model_name: 'claude-sonnet-4-5', api_key_env: 'ANTHROPIC_API_KEY', temperature: 0.7, max_tokens: 4000, is_active: true },
  ]);
  console.log('[Migrate] ModelConfig 默认配置已写入（9个角色）');
}

module.exports = { runMigrations };
