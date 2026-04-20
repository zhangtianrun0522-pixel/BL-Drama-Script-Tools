'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ code: 400, message: '用户名和密码不能为空' });

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return res.json({ code: 401, message: '账号不存在' });
    if (user.status !== 1) return res.json({ code: 401, message: '账号已被禁用' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ code: 401, message: '密码错误' });

    await user.update({ last_login_at: new Date() });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '365d' }
    );
    res.json({ code: 0, data: { token, userInfo: { id: user.id, username: user.username, nickname: user.nickname, role: user.role } } });
  } catch (e) {
    res.json({ code: 500, message: e.message });
  }
});

// POST /api/auth/register  （内部管理员创建账号）
router.post('/register', async (req, res) => {
  const { username, password, nickname, role } = req.body;
  if (!username || !password) return res.json({ code: 400, message: '参数缺失' });

  try {
    const exists = await User.findOne({ where: { username } });
    if (exists) return res.json({ code: 400, message: '用户名已存在' });
    const user = await User.create({
      username, password: bcrypt.hashSync(password, 10),
      nickname: nickname || username,
      role: role || 'editor',
    });
    res.json({ code: 0, data: { id: user.id, username: user.username, role: user.role } });
  } catch (e) {
    res.json({ code: 500, message: e.message });
  }
});

module.exports = router;
