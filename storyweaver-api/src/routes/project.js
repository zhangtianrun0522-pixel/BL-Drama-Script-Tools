'use strict';

const router = require('express').Router();
const { IpProject, WorkflowResult, IpArchive, EpisodeOutline, EpisodeScript, ProjectChatLog } = require('../models');
const { triggerSummarizer } = require('../services/summarizer');

// GET /api/project  (列表)
router.get('/', async (req, res) => {
  const where = req.user.role === 'admin' ? {} : { created_by: req.user.id };
  const projects = await IpProject.findAll({ where, order: [['updated_at', 'DESC']] });
  res.json({ code: 0, data: projects });
});

// POST /api/project  (创建)
router.post('/', async (req, res) => {
  const { title, original_text } = req.body;
  if (!title || !original_text) return res.json({ code: 400, message: '标题和IP文本不能为空' });
  const project = await IpProject.create({ title, original_text, created_by: req.user.id });
  res.json({ code: 0, data: project });
});

// GET /api/project/:id
router.get('/:id', async (req, res) => {
  const project = await IpProject.findByPk(req.params.id);
  if (!project) return res.json({ code: 404, message: '项目不存在' });
  res.json({ code: 0, data: project });
});

// PUT /api/project/:id
router.put('/:id', async (req, res) => {
  const { title, original_text } = req.body;
  await IpProject.update({ title, original_text }, { where: { id: req.params.id } });
  res.json({ code: 0, message: 'ok' });
});

// DELETE /api/project/:id
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  await Promise.all([
    IpProject.destroy({ where: { id } }),
    WorkflowResult.destroy({ where: { project_id: id } }),
    IpArchive.destroy({ where: { project_id: id } }),
    EpisodeOutline.destroy({ where: { project_id: id } }),
    EpisodeScript.destroy({ where: { project_id: id } }),
    ProjectChatLog.destroy({ where: { project_id: id } }),
  ]);
  res.json({ code: 0, message: 'ok' });
});

// GET /api/project/:id/workflows  (各工作流结果)
router.get('/:id/workflows', async (req, res) => {
  const results = await WorkflowResult.findAll({
    where: { project_id: req.params.id },
    order: [['created_at', 'ASC']],
  });
  res.json({ code: 0, data: results });
});

// GET /api/project/:id/archive
router.get('/:id/archive', async (req, res) => {
  const archive = await IpArchive.findOne({ where: { project_id: req.params.id } });
  res.json({ code: 0, data: archive || null });
});

// GET /api/project/:id/outline
router.get('/:id/outline', async (req, res) => {
  const outline = await EpisodeOutline.findOne({ where: { project_id: req.params.id } });
  res.json({ code: 0, data: outline || null });
});

// POST /api/project/:id/wf02-confirm  (用户确认WF02方向/调整意见)
router.post('/:id/wf02-confirm', async (req, res) => {
  const { direction } = req.body;
  const projectId = req.params.id;
  if (!direction?.trim()) return res.json({ code: 400, message: '请填写方向说明' });

  // 保存到 wf02 的 WorkflowResult
  const [wf02] = await WorkflowResult.findOrCreate({
    where: { project_id: projectId, workflow_num: 'wf02' },
    defaults: { status: 'done', user_direction: direction },
  });
  await wf02.update({ user_direction: direction });
  await IpProject.update({ status: 'wf02_done' }, { where: { id: projectId } });
  res.json({ code: 0, message: 'ok' });
});

// POST /api/project/:id/approve-archive
router.post('/:id/approve-archive', async (req, res) => {
  const { action, note } = req.body;
  const projectId = req.params.id;

  if (action === 'approve') {
    await IpArchive.update(
      { review_status: 'approved', review_note: note || '' },
      { where: { project_id: projectId } }
    );
    await IpProject.update({ status: 'wf03_done' }, { where: { id: projectId } });

    // 异步触发经验提炼（不阻塞主流程）
    WorkflowResult.findOne({ where: { project_id: projectId, workflow_num: 'wf03' } })
      .then(wfResult => { if (wfResult) triggerSummarizer(wfResult.id, 'wf03').catch(err => console.error('[Summarizer wf03]', err.message)); })
      .catch(() => {});
  } else if (action === 'reject') {
    await IpArchive.update(
      { review_status: 'rejected', review_note: note || '' },
      { where: { project_id: projectId } }
    );
    await IpProject.update({ status: 'wf02_done' }, { where: { id: projectId } });
  } else {
    return res.json({ code: 400, message: '无效action' });
  }
  res.json({ code: 0, message: 'ok' });
});

// POST /api/project/:id/approve-outline
router.post('/:id/approve-outline', async (req, res) => {
  const { action, note } = req.body;
  const projectId = req.params.id;

  if (action === 'submit') {
    // 编剧提交审核
    await IpProject.update({ status: 'wf04_reviewing' }, { where: { id: projectId } });
  } else if (action === 'approve') {
    const outline = await EpisodeOutline.findOne({ where: { project_id: projectId } });
    const epCount = req.body.totalEpisodes || (outline?.total_episodes) || 60;

    await EpisodeOutline.update(
      { review_status: 'approved', review_note: note || '', total_episodes: epCount },
      { where: { project_id: projectId } }
    );
    await IpProject.update({ status: 'wf04_done' }, { where: { id: projectId } });

    // 异步触发经验提炼（不阻塞主流程）
    WorkflowResult.findOne({ where: { project_id: projectId, workflow_num: 'wf04' } })
      .then(wfResult => { if (wfResult) triggerSummarizer(wfResult.id, 'wf04').catch(err => console.error('[Summarizer wf04]', err.message)); })
      .catch(() => {});

    // 初始化集数脚本行
    if (outline) {
      let episodes = [];
      try { episodes = JSON.parse(outline.episodes_json || '[]'); } catch (e) { console.error('[JSON Parse]', e.message); }
      for (let i = 0; i < epCount; i++) {
        const epNum = i + 1;
        const epData = episodes.find(e => e.episode_num === epNum) || {};
        await EpisodeScript.findOrCreate({
          where: { project_id: projectId, episode_num: epNum },
          defaults: { episode_outline: epData.summary || epData.outline || '', status: 'pending' },
        });
      }
    }
  } else if (action === 'reject') {
    await EpisodeOutline.update(
      { review_status: 'rejected', review_note: note || '' },
      { where: { project_id: projectId } }
    );
    await IpProject.update({ status: 'wf04_running' }, { where: { id: projectId } });
  } else {
    return res.json({ code: 400, message: '无效action' });
  }
  res.json({ code: 0, message: 'ok' });
});

// GET /api/project/:id/chat-log
router.get('/:id/chat-log', async (req, res) => {
  const where = { project_id: req.params.id };
  if (req.query.workflowNum) where.workflow_num = req.query.workflowNum;
  const logs = await ProjectChatLog.findAll({ where, order: [['created_at', 'ASC']] });
  res.json({ code: 0, data: logs });
});

// GET /api/project/:id/export
router.get('/:id/export', async (req, res) => {
  const format = req.query.format || 'docx';
  const projectId = req.params.id;

  const [project, scripts] = await Promise.all([
    IpProject.findByPk(projectId),
    EpisodeScript.findAll({
      where: { project_id: projectId },
      order: [['episode_num', 'ASC']],
    }),
  ]);
  if (!project) return res.json({ code: 404, message: '项目不存在' });

  if (format === 'docx') {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = require('docx');
    const children = [];

    // 标题
    children.push(new Paragraph({
      text: project.title,
      heading: HeadingLevel.HEADING_1,
    }));

    for (const s of scripts) {
      if (!s.content) continue;
      children.push(new Paragraph({
        text: `第${s.episode_num}集`,
        heading: HeadingLevel.HEADING_2,
      }));
      // 按行解析剧本内容
      const lines = (s.content || '').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { children.push(new Paragraph({ text: '' })); continue; }
        // 场景标题（粗体行）
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed.replace(/\*\*/g, ''), bold: true })],
          }));
        } else if (trimmed.startsWith('△')) {
          // 舞台指示
          children.push(new Paragraph({
            children: [new TextRun({ text: trimmed, italics: true, color: '666666' })],
          }));
        } else {
          children.push(new Paragraph({ text: trimmed }));
        }
      }
      children.push(new Paragraph({ text: '' }));
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(project.title)}.docx`);
    res.send(buffer);
  } else {
    // 简单文本格式 PDF（返回纯文本，前端可自行处理）
    let text = `${project.title}\n${'='.repeat(40)}\n\n`;
    for (const s of scripts) {
      if (!s.content) continue;
      text += `\n第${s.episode_num}集\n${'-'.repeat(20)}\n${s.content}\n`;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(project.title)}.txt`);
    res.send(text);
  }
});

module.exports = router;
