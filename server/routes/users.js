const express = require('express');
const { db } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { role, department, keyword, page = 1, pageSize = 10 } = req.query;
  let sql = 'SELECT id, username, name, role, department, position, phone, email, total_hours, created_at FROM users WHERE 1=1';
  const params = [];

  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (department) { sql += ' AND department = ?'; params.push(department); }
  if (keyword) {
    sql += ' AND (name LIKE ? OR username LIKE ? OR department LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as cnt FROM users WHERE 1=1';
  const countParams = [];
  if (role) { countSql += ' AND role = ?'; countParams.push(role); }
  if (department) { countSql += ' AND department = ?'; countParams.push(department); }
  if (keyword) {
    countSql += ' AND (name LIKE ? OR username LIKE ? OR department LIKE ?)';
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const total = db.prepare(countSql).get(...countParams).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/departments', authMiddleware, (req, res) => {
  const list = db.prepare(`
    SELECT d.*, u.name as supervisor_name FROM departments d
    LEFT JOIN users u ON d.supervisor_id = u.id
    ORDER BY d.name
  `).all();
  res.json({ code: 0, data: list });
});

router.get('/my-dept-employees', authMiddleware, roleMiddleware('supervisor'), (req, res) => {
  const list = db.prepare(`
    SELECT id, name, username, position, phone, email, total_hours FROM users
    WHERE department = ? AND role = 'employee' ORDER BY name
  `).all(req.user.department);
  res.json({ code: 0, data: list });
});

module.exports = router;
