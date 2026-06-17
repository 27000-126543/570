const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = 'training-system-secret-key-2024';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, name, role, department FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户不存在' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
  }
}

function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '权限不足，无法执行此操作' });
    }
    next();
  };
}

function logAction(user, action, module, description, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '') : '';
    db.prepare(`
      INSERT INTO operation_logs (user_id, username, role, action, module, description, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user?.id || null,
      user?.username || '',
      user?.role || '',
      action,
      module || '',
      description || '',
      ip
    );
  } catch (e) {
    console.error('日志记录失败:', e.message);
  }
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authMiddleware,
  roleMiddleware,
  logAction
};
