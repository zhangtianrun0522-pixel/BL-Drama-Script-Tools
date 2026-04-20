'use strict';

/**
 * src/services/summarizer.js
 * 经验提炼服务。在节点审核通过后异步调用，将执行过程浓缩成可复用经验写入 ExperienceProposal。
 *
 * 调用方式（fire-and-forget）：
 *   triggerSummarizer(workflowResultId, wfType).catch(console.error)
 */

const llm = require('./llm');
const { WorkflowResult, NodeConversation, IpProject, ExperienceProposal } = require('../models');

const WF_LABELS = {
  wf01: 'WF01 故事拆解',
  wf02: 'WF02 洗稿方案',
  wf03: 'WF03 IP档案制作',
  wf04: 'WF04 分集大纲',
  wf05: 'WF05 剧本创作',
};

const VALID_CATEGORIES = ['人设架构', '节奏规律', '剧情结构', '对白风格', '改编策略', '世界观'];

async function triggerSummarizer(workflowResultId, wfType) {
  const wfResult = await WorkflowResult.findByPk(workflowResultId);
  if (!wfResult) {
    console.warn(`[Summarizer] WorkflowResult ${workflowResultId} 不存在，跳过`);
    return;
  }

  const project = await IpProject.findByPk(wfResult.project_id);
  const nodeLabel = WF_LABELS[wfType] || wfType;

  // 截取输出前 3000 字
  const outputSnippet = (wfResult.output_text || '').slice(0, 3000);

  // 读取顾问对话记录
  const conversations = await NodeConversation.findAll({
    where: { workflow_result_id: workflowResultId },
    order: [['created_at', 'ASC']],
  });
  const convText = conversations.length
    ? conversations.map(c => `[${c.role}]: ${c.content}`).join('\n').slice(0, 2000)
    : '（本节点无顾问对话记录）';

  const messages = [
    {
      role: 'system',
      content: `你是一位经验提炼专家，专注于BL短剧IP改编项目。你的任务是从单次项目执行过程中提炼可复用的创作经验。
只提炼真实发生的、有具体依据的经验，不捏造，不泛化。
输出必须是合法JSON数组，不包含任何其他内容。`,
    },
    {
      role: 'user',
      content: `请分析以下工作流节点的执行过程，提炼对未来同类项目有复用价值的经验。

项目名称：${project?.title || '未知项目'}
节点类型：${nodeLabel}

节点输出内容（前3000字）：
${outputSnippet}

顾问对话记录（人工提出了哪些修改意见）：
${convText}

请提炼1-3条经验，要求：
- 每条经验必须具体可操作，避免泛泛而谈
- 必须来源于本次实际执行过程，不要编造
- 100字以内

以JSON数组格式返回，结构如下，不要包含其他任何内容：
[
  {
    "content": "经验描述",
    "category": "人设架构|节奏规律|剧情结构|对白风格|改编策略|世界观"
  }
]`,
    },
  ];

  let raw;
  try {
    raw = await llm.call('summarizer', messages);
  } catch (err) {
    console.error(`[Summarizer] LLM 调用失败 (wfResultId=${workflowResultId}):`, err.message);
    return;
  }

  // 解析 JSON
  let proposals;
  try {
    // 允许 LLM 在 JSON 前后有多余文字，尝试提取数组
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('未找到JSON数组');
    proposals = JSON.parse(match[0]);
    if (!Array.isArray(proposals)) throw new Error('不是数组');
  } catch (err) {
    console.error(`[Summarizer] JSON解析失败 (wfResultId=${workflowResultId}):`, err.message, '\nRaw:', raw);
    return;
  }

  // 过滤并写入
  const valid = proposals.filter(p =>
    p && typeof p.content === 'string' && p.content.trim() &&
    VALID_CATEGORIES.includes(p.category)
  );

  if (valid.length === 0) {
    console.warn(`[Summarizer] 没有有效提案 (wfResultId=${workflowResultId})`);
    return;
  }

  await ExperienceProposal.bulkCreate(
    valid.map(p => ({
      source_workflow_result_id: workflowResultId,
      content: p.content.trim(),
      category: p.category,
      status: 'pending',
    }))
  );

  console.log(`[Summarizer] 已写入 ${valid.length} 条提案 (wfResultId=${workflowResultId}, ${nodeLabel})`);
}

module.exports = { triggerSummarizer };
