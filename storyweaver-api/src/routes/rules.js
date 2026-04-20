'use strict';

const router = require('express').Router();
const { RulesLibrary } = require('../models');

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.type) where.rule_type = req.query.type;
  const rules = await RulesLibrary.findAll({ where, order: [['rule_type', 'ASC'], ['sort_order', 'ASC'], ['id', 'ASC']] });
  res.json({ code: 0, data: rules });
});

router.get('/:id', async (req, res) => {
  const rule = await RulesLibrary.findByPk(req.params.id);
  if (!rule) return res.json({ code: 404, message: '不存在' });
  res.json({ code: 0, data: rule });
});

router.post('/create', async (req, res) => {
  const { rule_type, name, content, sort_order } = req.body;
  if (!rule_type || !name || !content) return res.json({ code: 400, message: '参数缺失' });
  const rule = await RulesLibrary.create({ rule_type, name, content, sort_order: sort_order || 0 });
  res.json({ code: 0, data: rule });
});

router.put('/:id', async (req, res) => {
  const rule = await RulesLibrary.findByPk(req.params.id);
  if (!rule) return res.json({ code: 404, message: '不存在' });
  const { name, content, is_active, sort_order } = req.body;
  const newVersion = content && content !== rule.content ? rule.version + 1 : rule.version;
  await rule.update({ name, content, is_active, sort_order, version: newVersion });
  res.json({ code: 0, data: rule });
});

router.delete('/:id', async (req, res) => {
  await RulesLibrary.destroy({ where: { id: req.params.id } });
  res.json({ code: 0, message: 'ok' });
});

router.post('/:id/toggle', async (req, res) => {
  const rule = await RulesLibrary.findByPk(req.params.id);
  if (!rule) return res.json({ code: 404, message: '不存在' });
  await rule.update({ is_active: !rule.is_active });
  res.json({ code: 0, data: { is_active: rule.is_active } });
});

module.exports = router;
