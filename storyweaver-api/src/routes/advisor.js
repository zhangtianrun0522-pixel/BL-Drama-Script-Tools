'use strict';

/**
 * src/routes/advisor.js
 * 节点顾问路由：针对每个 WorkflowResult 节点提供 AI 顾问对话。
 *
 * 挂载路径：/api/advisor
 *
 * POST   /:workflowResultId/chat    — 发送消息，SSE 流式回复（body: { query }）
 * GET    /:workflowResultId/history — 读取对话历史
 * DELETE /:workflowResultId/history — 清空对话历史
 */

const router = require('express').Router();
const llm = require('../services/llm');
const { pipeSSE } = require('../utils/sse');
const { WorkflowResult, NodeConversation } = require('../models');

// ── 各节点顾问 System Prompt ──────────────────────────────────

const NODE_SYSTEM = {
  wf01: `你是一位资深的IP文本分析顾问，专注于BL短剧改编领域。
用户当前正在查看一份IP原文的故事拆解分析报告。

你的职责：
- 帮助用户深入理解分析报告中的核心洞察
- 解答关于人物设定、情感弧光、改编潜力的具体问题
- 提供补充分析视角，发现报告未覆盖的关键点
- 协助用户判断哪些元素最值得在后续改编中重点挖掘

回答要具体、有建设性，结合报告内容作答。`,

  wf02: `你是一位专业的短剧改编策划顾问，擅长BL题材内容开发。
用户当前正在查看一份IP改编洗稿方案。

你的职责：
- 帮助用户评估改编方案的可行性和创新性
- 就方向选择提供专业意见（差异化优势、市场潜力、风险点）
- 协助完善方向描述，使其更清晰可执行
- 回答关于改编策略、情感线设计、爽点规划的具体问题

回答要有明确立场，帮助用户做出决策。`,

  wf03: `你是一位IP开发档案专家，深度了解BL短剧行业规范。
用户当前正在查看一份标准化IP开发档案。

你的职责：
- 帮助用户检查档案的完整性和一致性
- 就人物设定、世界观、剧情逻辑提出专业建议
- 发现档案中可能存在的矛盾或薄弱环节
- 协助用户决定是通过审核还是需要修改完善

分析要细致，指出具体问题而不是泛泛而谈。`,

  wf04: `你是一位资深的BL短剧分集大纲策划顾问。
用户当前正在进行分集大纲的对话调整工作。

你的职责：
- 帮助用户优化分集结构、节奏和情感钩子
- 就具体集数提供剧情建议（冲突设计、场景选择、结尾悬念）
- 评估大纲的整体节奏是否符合短剧受众期待
- 协助用户决定大纲是否达到可提交审核的标准

建议要可落地，有明确的修改指向。`,

  wf05: `你是一位专业的BL短剧剧本写作顾问。
用户当前正在查看或调整某集剧本内容。

你的职责：
- 帮助用户打磨对白、场景描述和节奏感
- 就剧本中的情感表达、戏剧张力提供专业建议
- 发现剧本中逻辑漏洞或与档案/大纲不符之处
- 协助用户判断剧本质量，决定是否重新生成

回答要具体到台词和场景层面。`,
};

const DEFAULT_SYSTEM = `你是一位专业的BL短剧创作顾问。
帮助用户理解当前节点的输出内容，回答关于内容质量、改进方向和创作决策的问题。
回答要具体、有建设性，结合用户提供的内容作答。`;

function buildSystemPrompt(workflowNum, nodeContent) {
  const base = NODE_SYSTEM[workflowNum] || DEFAULT_SYSTEM;
  return `${base}

【当前节点输出内容】
${nodeContent || '（暂无内容）'}`;
}

// ── POST /api/advisor/:workflowResultId/chat ──────────────────
router.post('/:workflowResultId/chat', async (req, res) => {
  const workflowResultId = req.params.workflowResultId;
  const { query } = req.body;
  if (!query?.trim()) {
    return res.json({ code: 400, message: '参数缺失：query 必填' });
  }

  const wfResult = await WorkflowResult.findByPk(workflowResultId);
  if (!wfResult) return res.json({ code: 404, message: '节点不存在' });

  // 加载对话历史（最多 20 轮，即 40 条）
  const history = await NodeConversation.findAll({
    where: { workflow_result_id: workflowResultId },
    order: [['created_at', 'ASC']],
    limit: 40,
  });

  const systemPrompt = buildSystemPrompt(wfResult.workflow_num, wfResult.output_text);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: query.trim() },
  ];

  // 保存用户消息
  await NodeConversation.create({
    workflow_result_id: workflowResultId,
    role: 'user',
    content: query.trim(),
  });

  let generator;
  try {
    generator = llm.stream('advisor', messages);
  } catch (e) {
    return res.json({ code: 502, message: 'LLM初始化失败', detail: e.message });
  }

  await pipeSSE(res, generator, async (acc) => {
    if (acc.error) return;
    await NodeConversation.create({
      workflow_result_id: workflowResultId,
      role: 'assistant',
      content: acc.outputText,
    });
  });
});

// ── GET /api/advisor/:workflowResultId/history ────────────────
router.get('/:workflowResultId/history', async (req, res) => {
  const { workflowResultId } = req.params;
  const wfResult = await WorkflowResult.findByPk(workflowResultId);
  if (!wfResult) return res.json({ code: 404, message: '节点不存在' });

  const history = await NodeConversation.findAll({
    where: { workflow_result_id: workflowResultId },
    order: [['created_at', 'ASC']],
  });

  res.json({ code: 0, data: history });
});

// ── DELETE /api/advisor/:workflowResultId/history ─────────────
router.delete('/:workflowResultId/history', async (req, res) => {
  const { workflowResultId } = req.params;
  const wfResult = await WorkflowResult.findByPk(workflowResultId);
  if (!wfResult) return res.json({ code: 404, message: '节点不存在' });

  await NodeConversation.destroy({ where: { workflow_result_id: workflowResultId } });
  res.json({ code: 0, message: '对话历史已清空' });
});

module.exports = router;
