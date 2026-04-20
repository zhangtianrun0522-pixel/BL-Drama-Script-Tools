'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database');

// ── 用户 ──────────────────────────────────────────────────────
const User = sequelize.define('user', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username:      { type: DataTypes.STRING(50), unique: true },
  password:      { type: DataTypes.STRING(255) },
  nickname:      { type: DataTypes.STRING(50), defaultValue: '' },
  avatar:        { type: DataTypes.STRING(500), defaultValue: '' },
  role:          { type: DataTypes.STRING(20), defaultValue: 'editor' }, // admin | editor
  status:        { type: DataTypes.TINYINT, defaultValue: 1 },
  last_login_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'user', underscored: true });

// ── IP项目 ────────────────────────────────────────────────────
const IpProject = sequelize.define('ip_project', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:        { type: DataTypes.STRING(200), allowNull: false },
  original_text:{ type: DataTypes.TEXT('long'), allowNull: false },
  // created | wf01_running | wf01_done | wf02_running | wf02_done |
  // wf03_running | wf03_done | ip_review_pending | ip_approved |
  // wf04_running | wf04_done | outline_pending | outline_approved |
  // scripts_generating | completed
  status:       { type: DataTypes.STRING(40), defaultValue: 'created' },
  created_by:   { type: DataTypes.INTEGER, allowNull: false },
  extra_requirements: { type: DataTypes.JSON, defaultValue: {} },
}, { tableName: 'ip_project', underscored: true });

// ── 工作流运行结果 ────────────────────────────────────────────
const WorkflowResult = sequelize.define('workflow_result', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id:     { type: DataTypes.INTEGER, allowNull: false },
  workflow_num:   { type: DataTypes.STRING(4) },  // wf01~wf05
  input_snapshot: { type: DataTypes.JSON, defaultValue: {} },
  output_text:    { type: DataTypes.TEXT('long'), defaultValue: '' },
  status:         { type: DataTypes.STRING(20), defaultValue: 'pending' }, // pending|running|done|failed
  dify_task_id:    { type: DataTypes.STRING(100), defaultValue: '' },
  error_msg:       { type: DataTypes.TEXT, defaultValue: '' },
  user_direction:  { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'workflow_result', underscored: true });

// ── IP档案（wf03产出，需人工审核） ────────────────────────────
const IpArchive = sequelize.define('ip_archive', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id:    { type: DataTypes.INTEGER, allowNull: false, unique: true },
  content:       { type: DataTypes.TEXT('long'), defaultValue: '' },
  review_status: { type: DataTypes.STRING(20), defaultValue: 'pending' }, // pending|approved|rejected
  review_note:   { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'ip_archive', underscored: true });

// ── 分集大纲（wf04产出，需人工审核） ─────────────────────────
const EpisodeOutline = sequelize.define('episode_outline', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id:      { type: DataTypes.INTEGER, allowNull: false, unique: true },
  total_episodes:  { type: DataTypes.INTEGER, defaultValue: 60 },
  content:         { type: DataTypes.TEXT('long'), defaultValue: '' },
  episodes_json:   { type: DataTypes.TEXT('long'), defaultValue: '[]' }, // [{episode_num, summary}]
  dify_conversation_id: { type: DataTypes.STRING(100), defaultValue: '' },
  review_status:   { type: DataTypes.STRING(20), defaultValue: 'pending' },
  review_note:     { type: DataTypes.TEXT, defaultValue: '' },
}, { tableName: 'episode_outline', underscored: true });

// ── 单集剧本（wf05产出） ──────────────────────────────────────
const EpisodeScript = sequelize.define('episode_script', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id:       { type: DataTypes.INTEGER, allowNull: false },
  episode_num:      { type: DataTypes.INTEGER, allowNull: false },
  episode_outline:  { type: DataTypes.TEXT, defaultValue: '' },
  content:          { type: DataTypes.TEXT('long'), defaultValue: '' },
  status:           { type: DataTypes.STRING(20), defaultValue: 'pending' }, // pending|running|done|failed
  rating:           { type: DataTypes.STRING(10), defaultValue: 'unrated' }, // unrated|good|bad
  rating_note:      { type: DataTypes.TEXT, defaultValue: '' },
  generation_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  dify_task_id:     { type: DataTypes.STRING(100), defaultValue: '' },
  error_msg:        { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'episode_script',
  underscored: true,
  indexes: [{ fields: ['project_id', 'episode_num'], unique: true }],
});

// ── 模型配置 ──────────────────────────────────────────────────
const ModelConfig = sequelize.define('ModelConfig', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  role:        { type: DataTypes.STRING(50),  allowNull: false, unique: true },
  provider:    { type: DataTypes.STRING(20),  allowNull: false },
  model_name:  { type: DataTypes.STRING(100), allowNull: false },
  api_key_env: { type: DataTypes.STRING(100), allowNull: false },
  temperature: { type: DataTypes.FLOAT,   defaultValue: 0.7 },
  max_tokens:  { type: DataTypes.INTEGER, defaultValue: 4000 },
  is_active:   { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'ModelConfig', underscored: true });

// ── 节点对话历史 ──────────────────────────────────────────────
const NodeConversation = sequelize.define('NodeConversation', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  workflow_result_id: { type: DataTypes.INTEGER, allowNull: false },
  role:               { type: DataTypes.STRING(20), allowNull: false }, // user | assistant | system
  content:            { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'NodeConversation', underscored: true, updatedAt: false });

// ── 经验提案（待审核）────────────────────────────────────────
const ExperienceProposal = sequelize.define('ExperienceProposal', {
  id:                        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  source_workflow_result_id: { type: DataTypes.INTEGER, allowNull: false },
  content:                   { type: DataTypes.TEXT, allowNull: false },
  // 人设架构 / 节奏规律 / 剧情结构 / 对白风格 / 改编策略 / 世界观
  category:                  { type: DataTypes.STRING(20), allowNull: false },
  // pending | approved | rejected
  status:                    { type: DataTypes.STRING(20), defaultValue: 'pending' },
}, { tableName: 'ExperienceProposal', underscored: true, updatedAt: false });

// ── 经验池 ────────────────────────────────────────────────────
const ExperiencePool = sequelize.define('ExperiencePool', {
  id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  content:             { type: DataTypes.TEXT, allowNull: false },
  category:            { type: DataTypes.STRING(20), allowNull: false },
  source_project_ids:  { type: DataTypes.TEXT, defaultValue: '[]' },
  validation_count:    { type: DataTypes.INTEGER, defaultValue: 1 },
  promoted_at:         { type: DataTypes.DATE, allowNull: true },
  promoted_to_rule_id: { type: DataTypes.INTEGER, allowNull: true },
  promotion_rejected:  { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'ExperiencePool', underscored: true });

// ── 剧本样本（预留）──────────────────────────────────────────
const ScriptSample = sequelize.define('ScriptSample', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title:        { type: DataTypes.STRING(200), allowNull: false },
  content:      { type: DataTypes.TEXT, allowNull: false },
  tags:         { type: DataTypes.TEXT, defaultValue: '[]' },
  extracted_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'ScriptSample', underscored: true, updatedAt: false });

// ── 规则库 ────────────────────────────────────────────────────
const RulesLibrary = sequelize.define('rules_library', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rule_type:     { type: DataTypes.STRING(20) }, // screenwriter | director
  name:          { type: DataTypes.STRING(100) },
  content:       { type: DataTypes.TEXT('long') },
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  version:       { type: DataTypes.INTEGER, defaultValue: 1 },
  feedback_data: { type: DataTypes.TEXT('long'), defaultValue: '{}' }, // 预留
  sort_order:    { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'rules_library', underscored: true });

// ── 对话日志（wf04 Chatflow） ─────────────────────────────────
const ProjectChatLog = sequelize.define('project_chat_log', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id:   { type: DataTypes.INTEGER, allowNull: false },
  workflow_num: { type: DataTypes.STRING(4) },
  role:         { type: DataTypes.STRING(10) }, // user | assistant
  message:      { type: DataTypes.TEXT('long') },
}, { tableName: 'project_chat_log', underscored: true, updatedAt: false });

module.exports = {
  sequelize,
  User,
  IpProject,
  WorkflowResult,
  IpArchive,
  EpisodeOutline,
  EpisodeScript,
  RulesLibrary,
  ProjectChatLog,
  // 新增
  ModelConfig,
  NodeConversation,
  ExperienceProposal,
  ExperiencePool,
  ScriptSample,
};
