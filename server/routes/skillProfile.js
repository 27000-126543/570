const express = require('express');
const { db } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/my', authMiddleware, (req, res) => {
  const skills = db.prepare(`
    SELECT sp.*, c.name as course_name FROM skill_profiles sp
    LEFT JOIN courses c ON sp.related_course_id = c.id
    WHERE sp.user_id = ? ORDER BY sp.acquired_date DESC
  `).all(req.user.id);

  const history = db.prepare(`
    SELECT e.id, e.status, e.apply_time, e.approve_time,
           c.name as course_name, c.code, c.hours, c.category, c.start_date, c.end_date,
           er.score as exam_score, er.passed as exam_passed
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN exam_records er ON er.course_id = c.id AND er.user_id = e.user_id
    WHERE e.user_id = ? AND e.status != 'cancelled'
    ORDER BY e.apply_time DESC
  `).all(req.user.id);

  const certs = db.prepare('SELECT * FROM certificates WHERE user_id = ? AND valid = 1 ORDER BY issue_date DESC').all(req.user.id);

  res.json({ code: 0, data: { skills, trainingHistory: history, certificates: certs } });
});

router.get('/user/:userId', authMiddleware, roleMiddleware('trainer', 'supervisor'), (req, res) => {
  const { userId } = req.params;
  const user = db.prepare('SELECT id, name, username, department, position, total_hours FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  if (req.user.role === 'supervisor' && user.department !== req.user.department) {
    return res.status(403).json({ code: 403, message: '无权查看其他部门员工档案' });
  }

  const skills = db.prepare(`
    SELECT sp.*, c.name as course_name FROM skill_profiles sp
    LEFT JOIN courses c ON sp.related_course_id = c.id
    WHERE sp.user_id = ? ORDER BY sp.acquired_date DESC
  `).all(userId);

  const history = db.prepare(`
    SELECT e.id, e.status, e.apply_time, e.approve_time,
           c.name as course_name, c.code, c.hours, c.category,
           er.score as exam_score, er.passed as exam_passed
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN exam_records er ON er.course_id = c.id AND er.user_id = e.user_id
    WHERE e.user_id = ? AND e.status != 'cancelled'
    ORDER BY e.apply_time DESC
  `).all(userId);

  const certs = db.prepare('SELECT * FROM certificates WHERE user_id = ? ORDER BY issue_date DESC').all(userId);

  res.json({ code: 0, data: { user, skills, trainingHistory: history, certificates: certs } });
});

module.exports = router;
