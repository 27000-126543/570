const express = require('express');
const { db } = require('../database');
const { authMiddleware, roleMiddleware, logAction } = require('../middleware/auth');
const { sendNotification, formatDate } = require('../utils/common');

const router = express.Router();

function hasTimeConflict(userId, courseStart, courseEnd, excludeId) {
  const enrollments = db.prepare(`
    SELECT c.start_date, c.end_date FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.user_id = ? AND e.status IN ('pending', 'approved')
    ${excludeId ? 'AND c.id != ' + excludeId : ''}
  `).all(userId);

  for (const e of enrollments) {
    if (!(new Date(courseEnd) <= new Date(e.start_date) || new Date(courseStart) >= new Date(e.end_date))) {
      return true;
    }
  }
  return false;
}

router.post('/', authMiddleware, roleMiddleware('employee'), (req, res) => {
  const { course_id } = req.body;
  if (!course_id) return res.status(400).json({ code: 400, message: '请选择课程' });

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) return res.status(404).json({ code: 404, message: '课程不存在' });
  if (course.status !== 'published') return res.status(400).json({ code: 400, message: '该课程未发布，无法报名' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });

  const existing = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status IN ('pending', 'approved', 'completed')")
    .get(user.id, course_id);
  if (existing) return res.status(400).json({ code: 400, message: '您已报名该课程，请勿重复报名' });

  if (user.total_hours < course.required_hours) {
    return res.status(400).json({
      code: 400,
      message: `学时不满足要求。当前已完成${user.total_hours}学时，本课程要求${course.required_hours}学时`
    });
  }

  const dept = db.prepare('SELECT * FROM departments WHERE name = ?').get(user.department);
  if (dept) {
    const deptEnrollments = db.prepare(`
      SELECT COUNT(*) as cnt FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE u.department = ? AND e.course_id = ? AND e.status IN ('pending', 'approved', 'completed')
    `).get(user.department, course_id).cnt;
    if (deptEnrollments >= dept.quota) {
      return res.status(400).json({
        code: 400,
        message: `部门名额已满。本部门配额${dept.quota}人，已报名${deptEnrollments}人`
      });
    }
  }

  if (hasTimeConflict(user.id, course.start_date, course.end_date, null)) {
    return res.status(400).json({ code: 400, message: '课程时间与您已报名的其他课程冲突' });
  }

  const info = db.prepare(`
    INSERT INTO enrollments (user_id, course_id, status) VALUES (?, ?, 'pending')
  `).run(user.id, course_id);

  const supervisors = db.prepare("SELECT id FROM users WHERE role = 'supervisor' AND department = ?").all(user.department);
  supervisors.forEach(s => {
    sendNotification(s.id, 'enrollment_approval', '新的培训报名待审批',
      `${user.name}申请报名培训课程《${course.name}》，请及时审批。`, info.lastInsertRowid);
  });

  logAction(req.user, '报名课程', '培训报名', `报名课程: ${course.name}`, req);
  res.json({ code: 0, message: '报名成功，等待部门主管审批', data: { id: info.lastInsertRowid } });
});

router.get('/my', authMiddleware, (req, res) => {
  const { status, page = 1, pageSize = 10 } = req.query;
  let sql = `SELECT e.*, c.name as course_name, c.code as course_code, c.hours, c.start_date, c.end_date,
    c.category, c.teacher, u.name as approver_name FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN users u ON e.approve_by = u.id
    WHERE e.user_id = ?`;
  const params = [req.user.id];
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  sql += ' ORDER BY e.apply_time DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE user_id = ?' + (status ? ' AND status = ?' : ''))
    .get(req.user.id, ...(status ? [status] : [])).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/pending', authMiddleware, roleMiddleware('supervisor', 'trainer'), (req, res) => {
  const { page = 1, pageSize = 10, status } = req.query;
  let sql = `SELECT e.*, c.name as course_name, c.code as course_code, c.hours, c.category, c.teacher,
    u.name as user_name, u.department, u.position, u.phone, u.email,
    a.name as approver_name FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON e.user_id = u.id
    LEFT JOIN users a ON e.approve_by = a.id
    WHERE 1=1`;
  const params = [];

  if (req.user.role === 'supervisor') {
    sql += ' AND u.department = ?';
    params.push(req.user.department);
  }

  if (status) {
    sql += ' AND e.status = ?';
    params.push(status);
  } else {
    sql += " AND e.status IN ('pending', 'escalated')";
  }

  sql += ' ORDER BY e.apply_time ASC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);

  let countSql = `SELECT COUNT(*) as cnt FROM enrollments e JOIN users u ON e.user_id = u.id WHERE 1=1`;
  const countParams = [];
  if (req.user.role === 'supervisor') { countSql += ' AND u.department = ?'; countParams.push(req.user.department); }
  if (status) { countSql += ' AND e.status = ?'; countParams.push(status); }
  else { countSql += " AND e.status IN ('pending', 'escalated')"; }
  const total = db.prepare(countSql).get(...countParams).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/processed', authMiddleware, roleMiddleware('supervisor', 'trainer'), (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  let sql = `SELECT e.*, c.name as course_name, c.code as course_code, c.hours, c.category, c.teacher,
    u.name as user_name, u.department, u.position, u.phone, u.email,
    a.name as approver_name FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON e.user_id = u.id
    LEFT JOIN users a ON e.approve_by = a.id
    WHERE e.status IN ('approved', 'rejected', 'cancelled', 'completed')`;
  const params = [];

  if (req.user.role === 'supervisor') {
    sql += ' AND u.department = ?';
    params.push(req.user.department);
  }

  sql += ' ORDER BY e.approve_time DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);

  let countSql = `SELECT COUNT(*) as cnt FROM enrollments e JOIN users u ON e.user_id = u.id 
    WHERE e.status IN ('approved', 'rejected', 'cancelled', 'completed')`;
  const countParams = [];
  if (req.user.role === 'supervisor') { countSql += ' AND u.department = ?'; countParams.push(req.user.department); }
  const total = db.prepare(countSql).get(...countParams).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.post('/:id/approve', authMiddleware, roleMiddleware('supervisor'), (req, res) => {
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.id);
  if (!enrollment) return res.status(404).json({ code: 404, message: '报名记录不存在' });
  if (!['pending', 'escalated'].includes(enrollment.status)) {
    return res.status(400).json({ code: 400, message: '该申请状态不允许审批' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(enrollment.user_id);
  if (req.user.role === 'supervisor' && user.department !== req.user.department) {
    return res.status(403).json({ code: 403, message: '您无权审批其他部门的申请' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(enrollment.course_id);
  const enrolled = db.prepare("SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status IN ('pending', 'approved', 'completed')").get(course.id).cnt;
  if (enrolled >= course.capacity) {
    return res.status(400).json({ code: 400, message: '课程名额已满，无法通过审批' });
  }

  db.prepare("UPDATE enrollments SET status = 'approved', approve_time = ?, approve_by = ? WHERE id = ?")
    .run(formatDate(new Date()), req.user.id, enrollment.id);

  sendNotification(enrollment.user_id, 'enrollment_approved', '报名申请已通过',
    `您报名的《${course.name}》已通过部门主管审批。`, enrollment.id);

  logAction(req.user, '审批报名通过', '培训报名', `通过${user.name}的${course.name}报名申请`, req);
  res.json({ code: 0, message: '审批通过' });
});

router.post('/:id/reject', authMiddleware, roleMiddleware('supervisor'), (req, res) => {
  const { reason, reject_reason } = req.body;
  const rejectReason = reason || reject_reason || '';
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.id);
  if (!enrollment) return res.status(404).json({ code: 404, message: '报名记录不存在' });
  if (!['pending', 'escalated'].includes(enrollment.status)) {
    return res.status(400).json({ code: 400, message: '该申请状态不允许审批' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(enrollment.user_id);
  if (req.user.role === 'supervisor' && user.department !== req.user.department) {
    return res.status(403).json({ code: 403, message: '您无权审批其他部门的申请' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(enrollment.course_id);
  db.prepare("UPDATE enrollments SET status = 'rejected', approve_time = ?, approve_by = ?, reject_reason = ? WHERE id = ?")
    .run(formatDate(new Date()), req.user.id, rejectReason, enrollment.id);

  sendNotification(enrollment.user_id, 'enrollment_rejected', '报名申请被拒绝',
    `您报名的《${course.name}》被拒绝，原因：${rejectReason || '无'}`, enrollment.id);

  logAction(req.user, '审批报名拒绝', '培训报名', `拒绝${user.name}的${course.name}报名申请`, req);
  res.json({ code: 0, message: '已拒绝' });
});

router.post('/:id/cancel', authMiddleware, (req, res) => {
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(req.params.id);
  if (!enrollment) return res.status(404).json({ code: 404, message: '报名记录不存在' });
  if (enrollment.user_id !== req.user.id) return res.status(403).json({ code: 403, message: '无权取消' });
  if (!['pending', 'approved'].includes(enrollment.status)) {
    return res.status(400).json({ code: 400, message: '该状态下无法取消报名' });
  }

  const course = db.prepare('SELECT name FROM courses WHERE id = ?').get(enrollment.course_id);
  db.prepare("UPDATE enrollments SET status = 'cancelled' WHERE id = ?").run(enrollment.id);

  logAction(req.user, '取消报名', '培训报名', `取消报名: ${course.name}`, req);
  res.json({ code: 0, message: '已取消报名' });
});

router.get('/', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { course_id, department, status, keyword, page = 1, pageSize = 10 } = req.query;
  let sql = `SELECT e.*, c.name as course_name, c.code as course_code, c.hours, c.category, c.teacher,
    u.name as user_name, u.department, u.position, u.phone, u.email,
    a.name as approver_name FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON e.user_id = u.id
    LEFT JOIN users a ON e.approve_by = a.id
    WHERE 1=1`;
  const params = [];

  if (course_id) { sql += ' AND e.course_id = ?'; params.push(course_id); }
  if (department) { sql += ' AND u.department = ?'; params.push(department); }
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  if (keyword) { sql += ' AND u.name LIKE ?'; params.push(`%${keyword}%`); }

  sql += ' ORDER BY e.apply_time DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);

  let countSql = `SELECT COUNT(*) as cnt FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON e.user_id = u.id
    WHERE 1=1`;
  const countParams = [];
  if (course_id) { countSql += ' AND e.course_id = ?'; countParams.push(course_id); }
  if (department) { countSql += ' AND u.department = ?'; countParams.push(department); }
  if (status) { countSql += ' AND e.status = ?'; countParams.push(status); }
  if (keyword) { countSql += ' AND u.name LIKE ?'; countParams.push(`%${keyword}%`); }
  const total = db.prepare(countSql).get(...countParams).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/course/:courseId', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const list = db.prepare(`
    SELECT e.*, u.name as user_name, u.department, u.position, u.phone FROM enrollments e
    JOIN users u ON e.user_id = u.id
    WHERE e.course_id = ? ORDER BY e.apply_time DESC
  `).all(req.params.courseId);
  res.json({ code: 0, data: list });
});

module.exports = router;
