const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { authMiddleware, roleMiddleware, logAction } = require('../middleware/auth');
const { ensureDir, validateFile } = require('../utils/common');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'courseware');
ensureDir(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

router.get('/', authMiddleware, (req, res) => {
  const { status, keyword, page = 1, pageSize = 10 } = req.query;
  let sql = 'SELECT c.*, u.name as creator_name FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (keyword) { sql += ' AND (c.name LIKE ? OR c.code LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

  if (req.user.role === 'employee') {
    sql += " AND c.status IN ('published', 'completed')";
  }

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);

  let countSql = 'SELECT COUNT(*) as total FROM courses c WHERE 1=1';
  const countParams = [];
  if (status) { countSql += ' AND c.status = ?'; countParams.push(status); }
  if (keyword) { countSql += ' AND (c.name LIKE ? OR c.code LIKE ?)'; countParams.push(`%${keyword}%`, `%${keyword}%`); }
  if (req.user.role === 'employee') { countSql += " AND c.status IN ('published', 'completed')"; }
  const { total } = db.prepare(countSql).get(...countParams);

  list.forEach(c => {
    const enrolled = db.prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status IN (?, ?, ?)').get(c.id, 'pending', 'approved', 'completed').cnt;
    c.enrolled_count = enrolled;
  });

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/:id', authMiddleware, (req, res) => {
  const course = db.prepare('SELECT c.*, u.name as creator_name FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ code: 404, message: '课程不存在' });
  const enrolled = db.prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status IN (?, ?, ?)').get(course.id, 'pending', 'approved', 'completed').cnt;
  course.enrolled_count = enrolled;
  res.json({ code: 0, data: course });
});

router.post('/', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { name, code, category, description, hours, required_hours, capacity, start_date, end_date, location, teacher } = req.body;

  if (!name || !code || !hours || !start_date || !end_date) {
    return res.status(400).json({ code: 400, message: '必填项不能为空' });
  }
  if (new Date(start_date) >= new Date(end_date)) {
    return res.status(400).json({ code: 400, message: '开始时间必须早于结束时间' });
  }

  const exists = db.prepare('SELECT id FROM courses WHERE code = ?').get(code);
  if (exists) return res.status(400).json({ code: 400, message: '课程编码已存在' });

  const info = db.prepare(`
    INSERT INTO courses (name, code, category, description, hours, required_hours, capacity, start_date, end_date, location, teacher, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, code, category || '', description || '', Number(hours), Number(required_hours || 0),
    Number(capacity || 50), start_date, end_date, location || '', teacher || '', req.user.id);

  logAction(req.user, '创建课程', '课程管理', `创建课程: ${name}(${code})`, req);
  res.json({ code: 0, message: '课程创建成功', data: { id: info.lastInsertRowid } });
});

router.put('/:id', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { name, category, description, hours, required_hours, capacity, start_date, end_date, location, teacher, status } = req.body;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ code: 404, message: '课程不存在' });

  if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
    return res.status(400).json({ code: 400, message: '开始时间必须早于结束时间' });
  }

  db.prepare(`
    UPDATE courses SET name=?, category=?, description=?, hours=?, required_hours=?, capacity=?,
    start_date=?, end_date=?, location=?, teacher=?, status=COALESCE(?, status) WHERE id=?
  `).run(
    name || course.name, category || course.category, description ?? course.description,
    Number(hours || course.hours), Number(required_hours ?? course.required_hours),
    Number(capacity || course.capacity), start_date || course.start_date, end_date || course.end_date,
    location || course.location, teacher || course.teacher, status, course.id
  );

  logAction(req.user, '更新课程', '课程管理', `更新课程: ${course.name}`, req);
  res.json({ code: 0, message: '课程更新成功' });
});

router.delete('/:id', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ code: 404, message: '课程不存在' });

  const enrollCount = db.prepare('SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ?').get(course.id).cnt;
  if (enrollCount > 0) {
    return res.status(400).json({ code: 400, message: '该课程已有报名记录，无法删除' });
  }

  db.prepare('DELETE FROM question_banks WHERE course_id = ?').run(course.id);
  db.prepare('DELETE FROM exams WHERE course_id = ?').run(course.id);
  if (course.courseware_path && fs.existsSync(course.courseware_path)) {
    fs.unlinkSync(course.courseware_path);
  }
  db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);

  logAction(req.user, '删除课程', '课程管理', `删除课程: ${course.name}`, req);
  res.json({ code: 0, message: '课程删除成功' });
});

router.post('/upload', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 400, message: '文件大小超过500MB限制' });
      }
      return res.status(400).json({ code: 400, message: '文件上传失败: ' + err.message });
    }

    const { course_id } = req.body;
    if (!req.file) return res.status(400).json({ code: 400, message: '请选择文件' });

    const validation = validateFile(req.file, req.file.originalname);
    if (!validation.valid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ code: 400, message: validation.errors.join('；') });
    }

    if (course_id) {
      const oldCourse = db.prepare('SELECT courseware_path FROM courses WHERE id = ?').get(course_id);
      if (oldCourse?.courseware_path && fs.existsSync(oldCourse.courseware_path)) {
        fs.unlinkSync(oldCourse.courseware_path);
      }
      db.prepare('UPDATE courses SET courseware_path=?, courseware_name=? WHERE id=?')
        .run(req.file.path, req.file.originalname, course_id);
    }

    logAction(req.user, '上传课件', '课程管理', `上传课件: ${req.file.originalname}`, req);
    res.json({
      code: 0,
      message: '课件上传成功',
      data: { path: req.file.path, name: req.file.originalname, size: req.file.size }
    });
  });
});

router.get('/download/:id', authMiddleware, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course || !course.courseware_path) return res.status(404).json({ code: 404, message: '课件不存在' });
  if (!fs.existsSync(course.courseware_path)) return res.status(404).json({ code: 404, message: '课件文件已丢失' });
  res.download(course.courseware_path, course.courseware_name);
});

module.exports = router;
