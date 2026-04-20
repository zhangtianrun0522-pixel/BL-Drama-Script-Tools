'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');

module.exports = async (req, res, next) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();

  if (!token) {
    return res.status(401).json({ code: 401, message: '请先登录' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }

  const user = await User.findOne({
    where: { id: decoded.id, status: 1 },
    attributes: ['id', 'username', 'nickname', 'avatar', 'role'],
    raw: true,
  });

  if (!user) {
    return res.status(401).json({ code: 401, message: '账号不存在或已被禁用' });
  }

  req.user = user;
  next();
};
