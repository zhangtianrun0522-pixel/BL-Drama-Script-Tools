'use strict';

/**
 * src/routes/workflow.js
 * 替换原 routes/dify.js，承接 WF01-04 的路由逻辑。
 * 全部改为直连 LLM（通过 services/llm.js），移除 Dify 依赖。
 *
 * 挂载路径与原 dify.js 相同（在 app.js 中挂到 /api/dify），前端无需改动。
 */

const router = require('express').Router();
const llm = require('../services/llm');
const { pipeSSE } = require('../utils/sse');
const { IpProject, WorkflowResult, IpArchive, EpisodeOutline, ProjectChatLog, RulesLibrary } = require('../models');

// ── 系统 Prompt 模板 ──────────────────────────────────────────

const WF01_SYSTEM = `你是一位专业的IP文本分析师，专注于BL短剧改编分析。
分析用户提供的IP原文，输出以下结构化内容：

【核心人设】主要角色的性格特点、人物关系、角色弧光
【主线剧情】核心故事线、情感发展轨迹、主要冲突与转折
【情感节奏】情感高潮点、虐点与甜点分布、观众期待管理
【世界观背景】时代/环境设定、特殊规则、核心氛围
【改编价值点】最具短剧影视化潜力的场景和情节

输出格式清晰、层级分明，便于后续改编使用。`;

const WF02_SYSTEM = `你是一位专业的短剧改编策划师，专注于BL题材的IP改编洗稿方案设计。
基于IP分析结果，制定完整的改编方案，保留核心情感内核的同时实现内容独创性。

方案需包含：
【改编策略】如何处理原著的人设、世界观、核心情节，避免侵权风险
【原创设计】新增或调整的人物、场景、冲突设计
【情感线重构】BL情感线节奏（暧昧期→破冰→深化→高潮→结局）
【爽点设计】每阶段的情绪钩子和观众期待管理
【差异化亮点】与原著及同类作品的差异化特色

方案要具体可操作，为后续剧本创作提供清晰指引。`;

const WF03_SYSTEM = `你是一位资深IP档案制作专家，负责整合分析结果和改编方案，生成标准化的IP开发档案。
IP档案是整个创作团队的参考基准文件。

档案需包含：
【项目概述】作品标题、题材类型、集数规划、核心看点
【人物设定】主要角色详细人设（外貌、性格、背景、成长弧）
【关系图谱】人物间的关系网络和动态变化
【世界观】故事背景、时代设定、特殊规则
【核心剧情线】主线+支线的完整剧情脉络
【情感节奏表】各阶段情感基调和关键节点
【创作规范】人设一致性要求、剧情逻辑边界、禁止改动项

输出格式专业规范，可直接用于指导分集大纲和剧本创作。`;

function buildWf04System(ipDoc) {
  return `你是一位专业的BL短剧分集大纲策划，正在根据以下IP档案制定分集大纲。

【IP档案】
${ipDoc}

工作方式：与编辑多轮对话，逐步完善分集大纲。每轮你需要：
1. 理解编辑的意图和修改要求
2. 保持人设和情节与IP档案一致
3. 确保每集有清晰的情节目标和情感钩子（短剧每集约3-5分钟）

分集大纲格式：
第N集：【情节主题】
- 核心情节：本集主要事件
- 情感目标：情感推进方向
- 结尾钩子：引发下集期待的悬念

灵活响应编辑的调整要求，逐步完善直到确认通过。`;
}

// ── 工具函数 ──────────────────────────────────────────────────

async function getActiveRulesText() {
  const screenwriterRules = await RulesLibrary.findAll({
    where: { rule_type: 'screenwriter', is_active: true },
    order: [['sort_order', 'ASC']],
  });
  const directorRules = await RulesLibrary.findAll({
    where: { rule_type: 'director', is_active: true },
    order: [['sort_order', 'ASC']],
  });
  return {
    screenwriterText: screenwriterRules.map(r => r.content).join('\n\n'),
    directorText:     directorRules.map(r => r.content).join('\n\n'),
  };
}

async function buildInputs(workflowNum, projectId) {
  const project = await IpProject.findByPk(projectId);
  if (!project) throw new Error('项目不存在');
  const wfRows = await WorkflowResult.findAll({ where: { project_id: projectId } });
  const prevResults = {};
  for (const r of wfRows) prevResults[r.workflow_num] = r.output_text || '';

  switch (workflowNum) {
    case 'wf01':
      return { ip_doc: project.original_text };
    case 'wf02':
      return {
        ip_doc: project.original_text,
        story_breakdown: prevResults.wf01 || '',
      };
    case 'wf03': {
      const wf02Row = wfRows.find(r => r.workflow_num === 'wf02');
      return {
        ip_doc: project.original_text,
        story_breakdown: prevResults.wf01 || '',
        washing_plan:    prevResults.wf02 || '',
        user_direction:  wf02Row?.user_direction || '',
      };
    }
    default:
      return { ip_doc: project.original_text };
  }
}

function buildWf01Messages(inputs) {
  return [
    { role: 'system', content: WF01_SYSTEM },
    { role: 'user',   content: `请分析以下IP原文，按要求输出结构化分析报告：\n\n${inputs.ip_doc}` },
  ];
}

function buildWf02Messages(inputs) {
  return [
    { role: 'system', content: WF02_SYSTEM },
    { role: 'user',   content: `【IP原文】\n${inputs.ip_doc}\n\n【故事拆解】\n${inputs.story_breakdown}\n\n请制定完整的改编洗稿方案。` },
  ];
}

function buildWf03Messages(inputs) {
  const directionNote = inputs.user_direction
    ? `\n\n【创作方向指示】\n${inputs.user_direction}`
    : '';
  return [
    { role: 'system', content: WF03_SYSTEM },
    { role: 'user',   content: `【IP原文】\n${inputs.ip_doc}\n\n【故事拆解】\n${inputs.story_breakdown}\n\n【改编方案】\n${inputs.washing_plan}${directionNote}\n\n请生成完整的标准化IP开发档案。` },
  ];
}

const WF_ROLE_MAP = { wf01: 'wf01_analyst', wf02: 'wf02_planner', wf03: 'wf03_executor' };

// ── POST /api/dify/workflow/run  (WF01-03) ────────────────────
router.post('/workflow/run', async (req, res) => {
  const { projectId, workflowNum } = req.body;
  if (!projectId || !workflowNum) return res.json({ code: 400, message: '参数缺失' });
  if (!['wf01', 'wf02', 'wf03'].includes(workflowNum)) return res.json({ code: 400, message: '工作流编号不合法' });

  let inputs;
  try {
    inputs = await buildInputs(workflowNum, projectId);
  } catch (e) {
    return res.json({ code: 400, message: e.message });
  }

  let [record] = await WorkflowResult.findOrCreate({
    where: { project_id: projectId, workflow_num: workflowNum },
    defaults: { input_snapshot: inputs, status: 'running' },
  });
  await record.update({ status: 'running', input_snapshot: inputs, output_text: '', error_msg: '' });
  await IpProject.update({ status: `${workflowNum}_running` }, { where: { id: projectId } });

  const messagesMap = { wf01: buildWf01Messages, wf02: buildWf02Messages, wf03: buildWf03Messages };
  const messages = messagesMap[workflowNum](inputs);
  const role = WF_ROLE_MAP[workflowNum];

  let generator;
  try {
    generator = llm.stream(role, messages);
  } catch (e) {
    await record.update({ status: 'failed', error_msg: e.message });
    await IpProject.update({ status: 'failed' }, { where: { id: projectId } });
    return res.json({ code: 502, message: 'LLM初始化失败', detail: e.message });
  }

  await pipeSSE(res, generator, async (acc) => {
    if (acc.error) {
      await record.update({ status: 'failed', error_msg: acc.error });
      await IpProject.update({ status: 'failed' }, { where: { id: projectId } });
      return;
    }
    await record.update({ status: 'done', output_text: acc.outputText, error_msg: '' });
    await IpProject.update({ status: `${workflowNum}_done` }, { where: { id: projectId } });

    if (workflowNum === 'wf03') {
      await IpArchive.upsert({
        project_id:    projectId,
        content:       acc.outputText,
        review_status: 'pending',
        review_note:   '',
      });
      await IpProject.update({ status: 'wf03_reviewing' }, { where: { id: projectId } });
    }
  });
});

// ── POST /api/dify/chat/send  (WF04 分集大纲，多轮对话) ───────
router.post('/chat/send', async (req, res) => {
  const { projectId, query, conversationId } = req.body;
  if (!projectId || !query) return res.json({ code: 400, message: '参数缺失' });

  const project = await IpProject.findByPk(projectId);
  if (!project) return res.json({ code: 404, message: '项目不存在' });

  const archive = await IpArchive.findOne({ where: { project_id: projectId } });
  const ipDoc = archive?.content || project.original_text;

  // 从 ProjectChatLog 加载历史对话（最多20轮）
  const history = await ProjectChatLog.findAll({
    where: { project_id: projectId, workflow_num: 'wf04' },
    order: [['created_at', 'ASC']],
    limit: 40, // 最多20轮（每轮user+assistant各1条）
  });

  const messages = [
    { role: 'system', content: buildWf04System(ipDoc) },
    ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.message })),
    { role: 'user', content: query },
  ];

  await ProjectChatLog.create({ project_id: projectId, workflow_num: 'wf04', role: 'user', message: query });
  await IpProject.update({ status: 'wf04_running' }, { where: { id: projectId } });

  let generator;
  try {
    generator = llm.stream('wf04_outliner', messages);
  } catch (e) {
    return res.json({ code: 502, message: 'LLM初始化失败', detail: e.message });
  }

  await pipeSSE(res, generator, async (acc) => {
    if (acc.error) return;

    await ProjectChatLog.create({
      project_id: projectId, workflow_num: 'wf04', role: 'assistant', message: acc.outputText,
    });

    let totalEps = 60;
    const epsMatch = acc.outputText.match(/共\s*(\d+)\s*集|第\s*(\d+)\s*集/g);
    if (epsMatch) {
      const nums = epsMatch.map(m => parseInt(m.replace(/\D/g, ''))).filter(n => n > 0);
      if (nums.length) totalEps = Math.max(...nums);
    }

    await EpisodeOutline.upsert({
      project_id:            projectId,
      content:               acc.outputText,
      dify_conversation_id:  conversationId || '', // 保留字段，新实现不再使用
      review_status:         'pending',
      total_episodes:        totalEps,
    });
    await IpProject.update({ status: 'wf04_done' }, { where: { id: projectId } });
  });
});

// ── POST /api/dify/workflow/stop ──────────────────────────────
// 直连 LLM 无独立 stop API，关闭连接即停止
router.post('/workflow/stop', async (req, res) => {
  res.json({ code: 0, message: 'ok' });
});

// ── POST /api/dify/chat/stop ──────────────────────────────────
router.post('/chat/stop', async (req, res) => {
  res.json({ code: 0, message: 'ok' });
});

module.exports = router;
