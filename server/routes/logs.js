const express = require('express');
const { db } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { keyword, module, action, page = 1, pageSize = 20 } = req.query;
  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params = [];

  if (keyword) { sql += ' AND (username LIKE ? OR description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (module) { sql += ' AND module = ?'; params.push(module); }
  if (action) { sql += ' AND action LIKE ?'; params.push(`%${action}%`); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as cnt FROM operation_logs WHERE 1=1';
  const countParams = [];
  if (keyword) { countSql += ' AND (username LIKE ? OR description LIKE ?)'; countParams.push(`%${keyword}%`, `%${keyword}%`); }
  if (module) { countSql += ' AND module = ?'; countParams.push(module); }
  if (action) { countSql += ' AND action LIKE ?'; countParams.push(`%${action}%`); }
  const total = db.prepare(countSql).get(...countParams).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

module.exports = router;
