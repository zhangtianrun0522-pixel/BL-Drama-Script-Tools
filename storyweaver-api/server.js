'use strict';

// 加载环境变量
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.localhost') });

const app = require('./src/app');
const { sequelize } = require('./src/models');
const { runMigrations } = require('./src/database/migrate');
const { loadConfig: loadLLMConfig } = require('./src/services/llm');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 7006;

async function start() {
  // 建表（首次自动创建，已存在则跳过）
  await sequelize.sync({ alter: false });
  console.log('[DB] 数据库同步完成');

  // 新增表迁移（幂等，可重复执行）
  await runMigrations();

  // 种子数据
  await seedData();

  // 预加载 LLM 角色配置
  await loadLLMConfig();

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[Server] BL短剧API 启动成功 → http://127.0.0.1:${PORT}`);
    console.log(`[Mode]   ${process.env.DEPLOY_MODE || 'localhost'}`);
  });
}

async function seedData() {
  const { User, RulesLibrary } = require('./src/models');

  // 默认管理员
  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount === 0) {
    await User.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10), nickname: '管理员', role: 'admin' });
    await User.create({ username: 'editor', password: bcrypt.hashSync('editor123', 10), nickname: '编剧', role: 'editor' });
    console.log('[Seed] 默认账号已创建  admin/admin123  editor/editor123');
  }

  // 默认规则
  const ruleCount = await RulesLibrary.count();
  if (ruleCount === 0) {
    await RulesLibrary.bulkCreate([
      {
        rule_type: 'screenwriter', name: '剧本格式规范', sort_order: 1, is_active: true,
        content: `场景标题格式：集次-场次号 时段 内/外 地点（如：1-1 夜 外 某某地点）
人物列表：在场景标题下方列出本场人物
舞台指示：以△开头，描述动作和环境
对白格式：角色名（动作说明）:台词内容
内心独白/画外音：角色名（OS）:内心描述`,
      },
      {
        rule_type: 'director', name: '监制审核标准', sort_order: 1, is_active: true,
        content: `1. 人物性格前后一致，符合IP设定
2. 情感节奏张弛有度，每集有钩子
3. 对白简洁有力，符合人物身份
4. 场景转换自然，避免跳跃突兀
5. BL情感线含蓄而有张力，不过度煽情`,
      },
    ]);
    console.log('[Seed] 默认规则已创建');
  }
}

// 防止未捕获异常导致进程崩溃
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

start().catch(err => {
  console.error('[Fatal] 启动失败:', err.message);
  process.exit(1);
});
