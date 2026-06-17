const express = require('express');
const { db } = require('../database');
const { authMiddleware, roleMiddleware, logAction } = require('../middleware/auth');
const { shuffleArray, formatDate, sendNotification } = require('../utils/common');

const router = express.Router();

router.get('/questions', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { course_id, type, keyword } = req.query;
  let sql = 'SELECT * FROM question_banks WHERE 1=1';
  const params = [];
  if (course_id) { sql += ' AND course_id = ?'; params.push(course_id); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (keyword) { sql += ' AND question LIKE ?'; params.push(`%${keyword}%`); }
  sql += ' ORDER BY created_at DESC';
  const list = db.prepare(sql).all(...params);
  list.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
  res.json({ code: 0, data: list });
});

router.post('/questions', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { course_id, question, type, options, answer, score } = req.body;
  if (!course_id || !question || !type || !answer) {
    return res.status(400).json({ code: 400, message: '必填项不能为空' });
  }
  if (!['single', 'multiple', 'judge'].includes(type)) {
    return res.status(400).json({ code: 400, message: '题型不正确' });
  }

  const info = db.prepare(`
    INSERT INTO question_banks (course_id, question, type, options, answer, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(course_id, question, type, options ? JSON.stringify(options) : null, answer, score || 10);

  logAction(req.user, '添加试题', '考试管理', `为课程${course_id}添加试题`, req);
  res.json({ code: 0, message: '试题添加成功', data: { id: info.lastInsertRowid } });
});

router.put('/questions/:id', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const q = db.prepare('SELECT * FROM question_banks WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ code: 404, message: '试题不存在' });
  const { question, type, options, answer, score } = req.body;
  db.prepare(`
    UPDATE question_banks SET question=?, type=?, options=?, answer=?, score=? WHERE id=?
  `).run(question || q.question, type || q.type,
    options !== undefined ? JSON.stringify(options) : q.options,
    answer || q.answer, score || q.score, q.id);

  logAction(req.user, '更新试题', '考试管理', `更新试题${q.id}`, req);
  res.json({ code: 0, message: '试题更新成功' });
});

router.delete('/questions/:id', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const q = db.prepare('SELECT * FROM question_banks WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ code: 404, message: '试题不存在' });
  db.prepare('DELETE FROM question_banks WHERE id = ?').run(q.id);
  logAction(req.user, '删除试题', '考试管理', `删除试题${q.id}`, req);
  res.json({ code: 0, message: '试题删除成功' });
});

router.get('/', authMiddleware, (req, res) => {
  const { course_id, status } = req.query;
  let sql = 'SELECT e.*, c.name as course_name FROM exams e JOIN courses c ON e.course_id = c.id WHERE 1=1';
  const params = [];
  if (course_id) { sql += ' AND e.course_id = ?'; params.push(course_id); }
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  if (req.user.role === 'employee') {
    sql += " AND e.status = 'active'";
  }
  sql += ' ORDER BY e.created_at DESC';
  const list = db.prepare(sql).all(...params);
  res.json({ code: 0, data: list });
});

router.get('/:id', authMiddleware, (req, res) => {
  const exam = db.prepare('SELECT e.*, c.name as course_name FROM exams e JOIN courses c ON e.course_id = c.id WHERE e.id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ code: 404, message: '考试不存在' });
  res.json({ code: 0, data: exam });
});

router.post('/', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { course_id, name, duration, total_score, pass_score, question_count, start_time, end_time } = req.body;
  if (!course_id || !name) return res.status(400).json({ code: 400, message: '必填项不能为空' });

  const questions = db.prepare('SELECT id FROM question_banks WHERE course_id = ?').all(course_id);
  if (questions.length < (question_count || 10)) {
    return res.status(400).json({
      code: 400,
      message: `试题数量不足，当前题库有${questions.length}题，需要至少${question_count || 10}题`
    });
  }

  const info = db.prepare(`
    INSERT INTO exams (course_id, name, duration, total_score, pass_score, question_count, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(course_id, name, duration || 60, total_score || 100, pass_score || 60,
    question_count || 10, start_time || null, end_time || null);

  logAction(req.user, '创建考试', '考试管理', `创建考试: ${name}`, req);
  res.json({ code: 0, message: '考试创建成功', data: { id: info.lastInsertRowid } });
});

router.put('/:id', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ code: 404, message: '考试不存在' });
  const { name, duration, total_score, pass_score, question_count, start_time, end_time, status } = req.body;
  db.prepare(`
    UPDATE exams SET name=?, duration=?, total_score=?, pass_score=?, question_count=?,
    start_time=?, end_time=?, status=COALESCE(?, status) WHERE id=?
  `).run(name || exam.name, duration || exam.duration, total_score || exam.total_score,
    pass_score || exam.pass_score, question_count || exam.question_count,
    start_time ?? exam.start_time, end_time ?? exam.end_time, status, exam.id);

  logAction(req.user, '更新考试', '考试管理', `更新考试: ${exam.name}`, req);
  res.json({ code: 0, message: '考试更新成功' });
});

router.delete('/:id', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ code: 404, message: '考试不存在' });
  db.prepare('DELETE FROM exam_records WHERE exam_id = ?').run(exam.id);
  db.prepare('DELETE FROM exams WHERE id = ?').run(exam.id);
  logAction(req.user, '删除考试', '考试管理', `删除考试: ${exam.name}`, req);
  res.json({ code: 0, message: '考试删除成功' });
});

router.post('/:id/start', authMiddleware, roleMiddleware('employee'), (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ code: 404, message: '考试不存在' });
  if (exam.status !== 'active') return res.status(400).json({ code: 400, message: '考试未开放' });

  const existing = db.prepare('SELECT * FROM exam_records WHERE exam_id = ? AND user_id = ? AND submit_time IS NOT NULL')
    .get(exam.id, req.user.id);
  if (existing) return res.status(400).json({ code: 400, message: '您已参加过本次考试' });

  const ongoing = db.prepare('SELECT * FROM exam_records WHERE exam_id = ? AND user_id = ? AND submit_time IS NULL')
    .get(exam.id, req.user.id);

  if (ongoing) {
    const questions = JSON.parse(ongoing.questions).map(qid => {
      const q = db.prepare('SELECT id, course_id, question, type, options, score FROM question_banks WHERE id = ?').get(qid.id);
      if (q.options) q.options = JSON.parse(q.options);
      return q;
    });
    return res.json({
      code: 0,
      message: '继续考试',
      data: { recordId: ongoing.id, questions, start_time: ongoing.start_time, duration: exam.duration }
    });
  }

  const enrollment = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'approved'")
    .get(req.user.id, exam.course_id);
  if (!enrollment) return res.status(403).json({ code: 403, message: '您未报名该课程，无法参加考试' });

  const allQuestions = db.prepare('SELECT id FROM question_banks WHERE course_id = ?').all(exam.course_id);
  const selected = shuffleArray(allQuestions).slice(0, exam.question_count);
  const questionIds = selected.map(q => ({ id: q.id }));

  const info = db.prepare(`
    INSERT INTO exam_records (exam_id, user_id, course_id, questions, start_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(exam.id, req.user.id, exam.course_id, JSON.stringify(questionIds), formatDate(new Date()));

  const questions = selected.map(qid => {
    const q = db.prepare('SELECT id, course_id, question, type, options, score FROM question_banks WHERE id = ?').get(qid.id);
    if (q.options) q.options = JSON.parse(q.options);
    return q;
  });

  logAction(req.user, '开始考试', '考试管理', `开始考试: ${exam.name}`, req);
  res.json({
    code: 0,
    message: '开始考试',
    data: { recordId: info.lastInsertRowid, questions, start_time: formatDate(new Date()), duration: exam.duration }
  });
});

router.get('/take/:recordId', authMiddleware, roleMiddleware('employee'), (req, res) => {
  const record = db.prepare(`
    SELECT er.*, e.*, c.name as course_name 
    FROM exam_records er
    JOIN exams e ON er.exam_id = e.id
    JOIN courses c ON er.course_id = c.id
    WHERE er.id = ? AND er.user_id = ?
  `).get(req.params.recordId, req.user.id);
  
  if (!record) return res.status(404).json({ code: 404, message: '考试记录不存在' });
  if (record.submit_time) return res.status(400).json({ code: 400, message: '考试已提交' });

  const questions = JSON.parse(record.questions).map(qid => {
    const q = db.prepare('SELECT id, course_id, question, type, options, score FROM question_banks WHERE id = ?').get(qid.id);
    if (q.options) q.options = JSON.parse(q.options);
    return q;
  });

  const exam = {
    id: record.exam_id,
    name: record.name,
    course_name: record.course_name,
    duration: record.duration,
    total_score: record.total_score,
    pass_score: record.pass_score
  };

  res.json({
    code: 0,
    data: { exam, questions, recordId: record.id, start_time: record.start_time }
  });
});

router.post('/:id/submit', authMiddleware, roleMiddleware('employee'), (req, res) => {
  const { recordId, answers } = req.body;
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ code: 404, message: '考试不存在' });

  const record = db.prepare('SELECT * FROM exam_records WHERE id = ? AND user_id = ?').get(recordId, req.user.id);
  if (!record) return res.status(404).json({ code: 404, message: '考试记录不存在' });
  if (record.submit_time) return res.status(400).json({ code: 400, message: '考试已提交，不可重复提交' });

  const questions = JSON.parse(record.questions);
  let totalScore = 0;
  const correctAnswers = {};
  const questionDetails = [];
  let correctCount = 0;
  let wrongCount = 0;

  const normalizeAnswer = (ans, type) => {
    if (type === 'multiple') {
      let arr = [];
      if (Array.isArray(ans)) {
        arr = ans;
      } else if (typeof ans === 'string' && ans) {
        arr = ans.split(/[,，\s]+/).filter(Boolean);
      }
      return arr.map(s => String(s).toUpperCase().trim()).sort().join(',');
    }
    if (type === 'judge') {
      const s = String(ans || '').toLowerCase().trim();
      if (s === 'true' || s === '1' || s === 't' || s === '正确' || s === '对') return 'TRUE';
      if (s === 'false' || s === '0' || s === 'f' || s === '错误' || s === '错') return 'FALSE';
      return s.toUpperCase();
    }
    return String(ans || '').toUpperCase().trim();
  };

  for (const q of questions) {
    const question = db.prepare('SELECT * FROM question_banks WHERE id = ?').get(q.id);
    correctAnswers[q.id] = question.answer;

    const userRaw = answers[q.id];
    const correctNorm = normalizeAnswer(question.answer, question.type);
    const userNorm = normalizeAnswer(userRaw, question.type);

    const isEmpty = userRaw === undefined || userRaw === null ||
      (Array.isArray(userRaw) && userRaw.length === 0) ||
      (typeof userRaw === 'string' && !userRaw.trim());

    questionDetails.push({
      id: question.id,
      question: question.question,
      type: question.type,
      options: question.options ? JSON.parse(question.options) : null,
      score: question.score,
      correct_answer: question.answer,
      user_answer: userRaw,
      is_correct: !isEmpty && userNorm === correctNorm
    });

    if (!isEmpty && userNorm === correctNorm) {
      totalScore += question.score;
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  const passed = totalScore >= exam.pass_score ? 1 : 0;
  const startTime = new Date(record.start_time).getTime();
  const endTime = Date.now();
  const durationUsed = Math.round((endTime - startTime) / 60000);

  db.prepare(`
    UPDATE exam_records SET answers = ?, score = ?, passed = ?, submit_time = ?, duration_used = ?, question_details = ?
    WHERE id = ?
  `).run(JSON.stringify(answers), totalScore, passed, formatDate(new Date()), durationUsed, JSON.stringify(questionDetails), recordId);

  if (passed) {
    const enrollment = db.prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?")
      .get(req.user.id, exam.course_id);
    if (enrollment) {
      db.prepare("UPDATE enrollments SET status = 'completed' WHERE id = ?").run(enrollment.id);
    }
    const user = db.prepare('SELECT total_hours FROM users WHERE id = ?').get(req.user.id);
    const course = db.prepare('SELECT hours, name FROM courses WHERE id = ?').get(exam.course_id);
    db.prepare('UPDATE users SET total_hours = total_hours + ? WHERE id = ?').run(course.hours, req.user.id);

    const existingSkill = db.prepare('SELECT id FROM skill_profiles WHERE user_id = ? AND related_course_id = ?')
      .get(req.user.id, exam.course_id);
    if (existingSkill) {
      db.prepare('UPDATE skill_profiles SET score = ?, acquired_date = ? WHERE id = ?')
        .run(totalScore, formatDate(new Date()), existingSkill.id);
    } else {
      db.prepare(`
        INSERT INTO skill_profiles (user_id, skill_name, level, source, related_course_id, score, acquired_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, course.name + '认证', totalScore >= 90 ? 'advanced' : (totalScore >= 75 ? 'intermediate' : 'beginner'),
        'course_exam', exam.course_id, totalScore, formatDate(new Date()));
    }
  }

  logAction(req.user, '提交考试', '考试管理', `提交考试: ${exam.name}，得分: ${totalScore}`, req);
  res.json({
    code: 0,
    message: '考试提交成功',
    data: {
      score: totalScore,
      passed: !!passed,
      correctAnswers,
      userAnswers: answers,
      question_details: questionDetails,
      total_score: exam.total_score,
      pass_score: exam.pass_score,
      correct_count: correctCount,
      wrong_count: wrongCount
    }
  });
});

router.get('/records/my', authMiddleware, (req, res) => {
  const list = db.prepare(`
    SELECT er.*, e.name as exam_name, c.name as course_name FROM exam_records er
    JOIN exams e ON er.exam_id = e.id
    JOIN courses c ON er.course_id = c.id
    WHERE er.user_id = ? ORDER BY er.submit_time DESC
  `).all(req.user.id);
  res.json({ code: 0, data: list });
});

router.get('/records/:id', authMiddleware, (req, res) => {
  const record = db.prepare(`
    SELECT er.*, e.name as exam_name, c.name as course_name,
           e.total_score as exam_total_score, e.pass_score as exam_pass_score
    FROM exam_records er
    JOIN exams e ON er.exam_id = e.id
    JOIN courses c ON er.course_id = c.id
    WHERE er.id = ? AND er.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!record) return res.status(404).json({ code: 404, message: '考试记录不存在' });

  let questionDetails = [];
  if (record.question_details) {
    try {
      questionDetails = JSON.parse(record.question_details);
    } catch (e) {}
  }
  record.question_details = questionDetails;
  if (record.answers) {
    try {
      record.answers = JSON.parse(record.answers);
    } catch (e) {}
  }

  res.json({ code: 0, data: record });
});

router.get('/records/:id/trainer', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const record = db.prepare(`
    SELECT er.*, e.name as exam_name, c.name as course_name,
           e.total_score as exam_total_score, e.pass_score as exam_pass_score,
           u.name as user_name, u.department
    FROM exam_records er
    JOIN exams e ON er.exam_id = e.id
    JOIN courses c ON er.course_id = c.id
    JOIN users u ON er.user_id = u.id
    WHERE er.id = ?
  `).get(req.params.id);
  if (!record) return res.status(404).json({ code: 404, message: '考试记录不存在' });

  let questionDetails = [];
  if (record.question_details) {
    try {
      questionDetails = JSON.parse(record.question_details);
    } catch (e) {}
  }
  record.question_details = questionDetails;
  if (record.answers) {
    try {
      record.answers = JSON.parse(record.answers);
    } catch (e) {}
  }

  res.json({ code: 0, data: record });
});

router.get('/records/exam/:examId', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const list = db.prepare(`
    SELECT er.*, u.name as user_name, u.department, e.name as exam_name
    FROM exam_records er
    JOIN users u ON er.user_id = u.id
    JOIN exams e ON er.exam_id = e.id
    WHERE er.exam_id = ? AND er.submit_time IS NOT NULL ORDER BY er.score DESC
  `).all(req.params.examId);
  res.json({ code: 0, data: list });
});

router.get('/records/passed/list', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const list = db.prepare(`
    SELECT er.id, er.score, er.passed, er.submit_time,
           u.id as user_id, u.name as user_name, u.department, u.username,
           e.name as exam_name, c.id as course_id, c.name as course_name,
           (SELECT COUNT(*) FROM certificates cf WHERE cf.exam_record_id = er.id) as cert_exists
    FROM exam_records er
    JOIN users u ON er.user_id = u.id
    JOIN exams e ON er.exam_id = e.id
    JOIN courses c ON er.course_id = c.id
    WHERE er.passed = 1 AND er.submit_time IS NOT NULL
    ORDER BY er.submit_time DESC
  `).all();
  res.json({ code: 0, data: list });
});

module.exports = router;
