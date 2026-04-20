'use strict';

const router = require('express').Router();
const { EpisodeScript, IpArchive, IpProject, RulesLibrary, WorkflowResult } = require('../models');
const { triggerSummarizer } = require('../services/summarizer');
const llm = require('../services/llm');
const { pipeSSE } = require('../utils/sse');

// GET /api/script/list?projectId=xx
router.get('/list', async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.json({ code: 400, message: 'projectId缺失' });
  const scripts = await EpisodeScript.findAll({ where: { project_id: projectId }, order: [['episode_num', 'ASC']] });
  res.json({ code: 0, data: scripts });
});

// GET /api/script/:id
router.get('/:id', async (req, res) => {
  const script = await EpisodeScript.findByPk(req.params.id);
  if (!script) return res.json({ code: 404, message: '不存在' });
  res.json({ code: 0, data: script });
});

// PUT /api/script/:id  手动编辑
router.put('/:id', async (req, res) => {
  await EpisodeScript.update({ content: req.body.content }, { where: { id: req.params.id } });
  res.json({ code: 0, message: 'ok' });
});

// POST /api/script/:id/rate
router.post('/:id/rate', async (req, res) => {
  const { rating, note } = req.body;
  if (!['good', 'bad', 'unrated'].includes(rating)) return res.json({ code: 400, message: '无效rating' });
  const script = await EpisodeScript.findByPk(req.params.id);
  if (!script) return res.json({ code: 404, message: '不存在' });
  await script.update({ rating, rating_note: note || '' });

  // 评为"好"时异步触发经验提炼（不阻塞主流程）
  if (rating === 'good') {
    WorkflowResult.findOne({ where: { project_id: script.project_id, workflow_num: 'wf05' } })
      .then(wfResult => { if (wfResult) triggerSummarizer(wfResult.id, 'wf05').catch(err => console.error('[Summarizer wf05]', err.message)); })
      .catch(() => {});
  }

  res.json({ code: 0, message: 'ok' });
});

// POST /api/script/generate  流式生成单集剧本
router.post('/generate', async (req, res) => {
  const { scriptId, projectId, episodeNum, extraRequirement } = req.body;
  const scriptRow = await EpisodeScript.findByPk(scriptId);
  if (!scriptRow) return res.json({ code: 404, message: '剧本行不存在' });

  const [archive, project] = await Promise.all([
    IpArchive.findOne({ where: { project_id: projectId } }),
    IpProject.findByPk(projectId),
  ]);

  // 加载规则库
  const [screenwriterRules, directorRules] = await Promise.all([
    RulesLibrary.findAll({ where: { rule_type: 'screenwriter', is_active: true }, order: [['sort_order', 'ASC']] }),
    RulesLibrary.findAll({ where: { rule_type: 'director',     is_active: true }, order: [['sort_order', 'ASC']] }),
  ]);
  const screenwriterText = screenwriterRules.map(r => r.content).join('\n\n');
  const directorText     = directorRules.map(r => r.content).join('\n\n');

  const extraNote = extraRequirement ? `\n\n【附加要求】\n${extraRequirement}` : '';
  const messages = [
    {
      role: 'system',
      content: `你是一位专业的BL短剧编剧，负责根据分集大纲创作具体剧本。

【剧本格式规范】
${screenwriterText}

【监制审核标准】
${directorText}

创作要求：
1. 每集包含3-5个场景，对白自然流畅，符合人物性格
2. BL情感表达含蓄有张力，避免过度煽情
3. 每集结尾要有情绪钩子
4. 严格按照分集大纲创作，不随意改变人设和情节走向`,
    },
    {
      role: 'user',
      content: `【IP档案】\n${archive?.content || project.original_text}\n\n【第${episodeNum}集大纲】\n${scriptRow.episode_outline}${extraNote}\n\n请创作第${episodeNum}集完整剧本。`,
    },
  ];

  await scriptRow.update({ status: 'running', generation_count: scriptRow.generation_count + 1 });

  let generator;
  try {
    generator = llm.stream('wf05_writer', messages);
  } catch (e) {
    await scriptRow.update({ status: 'failed', error_msg: e.message });
    return res.json({ code: 502, message: 'LLM初始化失败', detail: e.message });
  }

  await pipeSSE(res, generator, async (acc) => {
    if (acc.error) {
      await scriptRow.update({ status: 'failed', error_msg: acc.error });
    } else {
      await scriptRow.update({ status: 'done', content: acc.outputText, error_msg: '' });
    }
  });
});

// POST /api/script/batch-generate  批量重置状态（实际生成由前端逐集调用 /generate）
router.post('/batch-generate', async (req, res) => {
  const { projectId, scriptIds } = req.body;
  if (!projectId || !scriptIds?.length) return res.json({ code: 400, message: '参数缺失' });
  await EpisodeScript.update({ status: 'pending' }, { where: { id: scriptIds, status: ['pending', 'failed'] } });
  res.json({ code: 0, message: `已加入队列 ${scriptIds.length} 集` });
});

module.exports = router;
