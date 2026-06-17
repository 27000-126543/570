const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken, authMiddleware, logAction } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    logAction(null, '登录失败', '认证', `用户名不存在: ${username}`, req);
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    logAction({ id: user.id, username: user.username, role: user.role }, '登录失败', '认证', '密码错误', req);
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const token = generateToken(user);
  logAction({ id: user.id, username: user.username, role: user.role }, '登录成功', '认证', `用户${user.name}登录系统`, req);

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        position: user.position,
        email: user.email,
        phone: user.phone,
        total_hours: user.total_hours
      }
    }
  });
});

router.get('/userinfo', authMiddleware, (req, res) => {
  res.json({ code: 0, data: req.user });
});

router.post('/logout', authMiddleware, (req, res) => {
  logAction(req.user, '退出登录', '认证', `用户${req.user.name}退出系统`, req);
  res.json({ code: 0, message: '退出成功' });
});

router.put('/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ code: 400, message: '旧密码和新密码不能为空' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ code: 400, message: '旧密码错误' });
  }
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
  logAction(req.user, '修改密码', '认证', '用户修改密码', req);
  res.json({ code: 0, message: '密码修改成功' });
});

module.exports = router;
