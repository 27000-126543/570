const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const getNotifications = (req, res) => {
  const { unread, status, page = 1, pageSize = 20 } = req.query;
  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [req.user.id];
  
  const isUnread = unread === '1' || status === 'unread';
  if (isUnread) { sql += ' AND "read" = 0'; }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params).map(n => ({
    ...n,
    status: n.read ? 'read' : 'unread'
  }));
  
  const total = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ?' + (isUnread ? ' AND "read" = 0' : ''))
    .get(req.user.id).cnt;
  const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND "read" = 0').get(req.user.id).cnt;

  res.json({ code: 0, data: { list, total, unreadCount, page: Number(page), pageSize: Number(pageSize) } });
};

router.get('/my', authMiddleware, getNotifications);
router.get('/', authMiddleware, getNotifications);

router.get('/unread-count', authMiddleware, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND "read" = 0').get(req.user.id).cnt;
  res.json({ code: 0, data: { count } });
});

const markAsRead = (req, res) => {
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!notif) return res.status(404).json({ code: 404, message: '通知不存在' });
  db.prepare('UPDATE notifications SET "read" = 1 WHERE id = ?').run(notif.id);
  const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND "read" = 0').get(req.user.id).cnt;
  res.json({ code: 0, message: '已标记为已读', data: { unreadCount } });
};

const markAllAsRead = (req, res) => {
  db.prepare('UPDATE notifications SET "read" = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ code: 0, message: '全部已读', data: { unreadCount: 0 } });
};

router.post('/:id/read', authMiddleware, markAsRead);
router.put('/:id/read', authMiddleware, markAsRead);

router.post('/read-all', authMiddleware, markAllAsRead);
router.put('/read-all', authMiddleware, markAllAsRead);

module.exports = router;
