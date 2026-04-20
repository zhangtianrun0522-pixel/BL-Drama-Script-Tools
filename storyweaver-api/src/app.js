'use strict';

const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');

const authRouter    = require('./routes/auth');
const projectRouter = require('./routes/project');
const workflowRouter = require('./routes/workflow');
const scriptRouter  = require('./routes/script');
const rulesRouter   = require('./routes/rules');
const uploadRouter  = require('./routes/upload');
const advisorRouter    = require('./routes/advisor');
const experienceRouter = require('./routes/experience');

const app = express();

app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,OPTIONS', allowedHeaders: 'Content-Type,Authorization' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查（公开）
app.get('/api/system/health', (_, res) => res.json({ code: 0, data: { status: 'healthy', deployMode: process.env.DEPLOY_MODE } }));
app.get('/api/system/mode',   (_, res) => res.json({ code: 0, data: { deployMode: process.env.DEPLOY_MODE } }));

// 认证（公开）
app.use('/api/auth', authRouter);

// 需要登录的接口
app.use('/api/project', auth, projectRouter);
app.use('/api/dify',    auth, workflowRouter);
app.use('/api/script',  auth, scriptRouter);
app.use('/api/rules',   auth, rulesRouter);
app.use('/api/upload',  auth, uploadRouter);
app.use('/api/advisor',     auth, advisorRouter);
app.use('/api/experience',  auth, experienceRouter);

// 用户信息
app.get('/api/user/profile', auth, async (req, res) => {
  const { User } = require('./models');
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'username', 'nickname', 'avatar', 'role', 'created_at'] });
  res.json({ code: 0, data: user });
});

// 全局错误处理
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ code: 500, message: err.message });
});

module.exports = app;
