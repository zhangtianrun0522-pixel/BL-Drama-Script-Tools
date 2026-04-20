'use strict';

/**
 * src/routes/experience.js
 * 经验系统路由：提案审核 → 经验池管理 → 晋升至规则库
 *
 * 挂载路径：/api/experience
 *
 * GET  /proposals                     — 待审核提案列表
 * POST /proposals/:id/approve         — 通过提案，写入经验池
 * POST /proposals/:id/reject          — 拒绝提案
 * GET  /pool                          — 经验池全量列表
 * GET  /pool/promotion-candidates     — 可晋升候选（count>=3，未晋升，未拒绝）
 * POST /pool/:id/promote              — 晋升到规则库
 * POST /pool/:id/reject-promotion     — 标记为不晋升
 */

const router = require('express').Router();
const { Op } = require('sequelize');
const {
  ExperienceProposal, ExperiencePool, WorkflowResult, IpProject, RulesLibrary,
} = require('../models');

// category → rule_type 映射
function categoryToRuleType(category) {
  return ['人设架构', '对白风格'].includes(category) ? 'screenwriter' : 'director';
}

// 简单关键词相似度：同 category 下，content 有超过半数词重叠则视为相似
function isSimilar(a, b) {
  if (a.category !== b.category) return false;
  const wordsA = new Set(a.content.replace(/[，。！？、\s]/g, ' ').split(' ').filter(w => w.length > 1));
  const wordsB = b.content.replace(/[，。！？、\s]/g, ' ').split(' ').filter(w => w.length > 1);
  if (wordsA.size === 0) return false;
  const overlap = wordsB.filter(w => wordsA.has(w)).length;
  return overlap / wordsA.size >= 0.4;
}

// ── GET /api/experience/proposals ────────────────────────────
router.get('/proposals', async (req, res) => {
  const proposals = await ExperienceProposal.findAll({
    where: { status: 'pending' },
    order: [['created_at', 'DESC']],
  });

  // 补充来源节点信息
  const enriched = await Promise.all(proposals.map(async (p) => {
    const wfResult = await WorkflowResult.findByPk(p.source_workflow_result_id, {
      attributes: ['id', 'workflow_num', 'project_id'],
    });
    const project = wfResult ? await IpProject.findByPk(wfResult.project_id, {
      attributes: ['id', 'title'],
    }) : null;
    return {
      ...p.toJSON(),
      workflow_num: wfResult?.workflow_num || null,
      project_title: project?.title || null,
    };
  }));

  res.json({ code: 0, data: enriched });
});

// ── POST /api/experience/proposals/:id/approve ────────────────
router.post('/proposals/:id/approve', async (req, res) => {
  const proposal = await ExperienceProposal.findByPk(req.params.id);
  if (!proposal) return res.json({ code: 404, message: '提案不存在' });

  await proposal.update({ status: 'approved' });

  // 获取来源项目ID
  const wfResult = await WorkflowResult.findByPk(proposal.source_workflow_result_id);
  const projectId = wfResult?.project_id;

  // 检查经验池中是否已有相似条目（同 category）
  const existing = await ExperiencePool.findAll({
    where: { category: proposal.category },
  });

  const similar = existing.find(e => isSimilar(
    { category: proposal.category, content: proposal.content },
    { category: e.category, content: e.content }
  ));

  if (similar) {
    // 相似条目：validation_count +1，合并 source_project_ids
    let ids = [];
    try { ids = JSON.parse(similar.source_project_ids || '[]'); } catch { ids = []; }
    if (projectId && !ids.includes(projectId)) ids.push(projectId);
    await similar.update({
      validation_count: similar.validation_count + 1,
      source_project_ids: JSON.stringify(ids),
    });
    return res.json({ code: 0, message: '已合并到相似经验条目', data: similar });
  }

  // 新建经验池条目
  const poolEntry = await ExperiencePool.create({
    content: proposal.content,
    category: proposal.category,
    source_project_ids: JSON.stringify(projectId ? [projectId] : []),
    validation_count: 1,
  });

  res.json({ code: 0, data: poolEntry });
});

// ── POST /api/experience/proposals/:id/reject ─────────────────
router.post('/proposals/:id/reject', async (req, res) => {
  const proposal = await ExperienceProposal.findByPk(req.params.id);
  if (!proposal) return res.json({ code: 404, message: '提案不存在' });
  await proposal.update({ status: 'rejected' });
  res.json({ code: 0, message: 'ok' });
});

// ── GET /api/experience/pool ──────────────────────────────────
router.get('/pool', async (req, res) => {
  const entries = await ExperiencePool.findAll({
    order: [['validation_count', 'DESC'], ['created_at', 'DESC']],
  });
  res.json({ code: 0, data: entries });
});

// ── GET /api/experience/pool/promotion-candidates ─────────────
// 必须在 /pool/:id 路由之前注册，避免被当作 id=promotion-candidates
router.get('/pool/promotion-candidates', async (req, res) => {
  const entries = await ExperiencePool.findAll({
    where: {
      validation_count: { [Op.gte]: 3 },
      promoted_at: null,
      promotion_rejected: false,
    },
    order: [['validation_count', 'DESC']],
  });
  res.json({ code: 0, data: entries });
});

// ── POST /api/experience/pool/:id/promote ─────────────────────
router.post('/pool/:id/promote', async (req, res) => {
  const entry = await ExperiencePool.findByPk(req.params.id);
  if (!entry) return res.json({ code: 404, message: '条目不存在' });
  if (entry.promoted_at) return res.json({ code: 400, message: '已晋升' });

  const ruleType = categoryToRuleType(entry.category);

  // 计算当前最大 sort_order
  const maxRule = await RulesLibrary.findOne({
    where: { rule_type: ruleType },
    order: [['sort_order', 'DESC']],
  });
  const sortOrder = (maxRule?.sort_order || 0) + 10;

  const rule = await RulesLibrary.create({
    rule_type: ruleType,
    name: `[经验库] ${entry.category}`,
    content: entry.content,
    is_active: true,
    sort_order: sortOrder,
  });

  await entry.update({
    promoted_at: new Date(),
    promoted_to_rule_id: rule.id,
  });

  res.json({ code: 0, message: '已晋升至规则库', data: { rule, entry } });
});

// ── POST /api/experience/pool/:id/reject-promotion ───────────
router.post('/pool/:id/reject-promotion', async (req, res) => {
  const entry = await ExperiencePool.findByPk(req.params.id);
  if (!entry) return res.json({ code: 404, message: '条目不存在' });
  await entry.update({ promotion_rejected: true });
  res.json({ code: 0, message: 'ok' });
});

module.exports = router;
