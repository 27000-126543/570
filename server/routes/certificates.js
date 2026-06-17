const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { db } = require('../database');
const { authMiddleware, roleMiddleware, logAction } = require('../middleware/auth');
const { generateCertificateNo, formatDate, ensureDir, sendNotification } = require('../utils/common');

const router = express.Router();
const certDir = path.join(__dirname, '..', '..', 'uploads', 'certificates');
ensureDir(certDir);

function generateCertificatePdf(cert, user, course) {
  const filePath = path.join(certDir, `${cert.certificate_no}.pdf`);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
  doc.pipe(fs.createWriteStream(filePath));

  doc.rect(30, 30, 762, 525).stroke('#2c5aa0');
  doc.rect(40, 40, 742, 505).stroke('#2c5aa0');

  doc.fontSize(28).fillColor('#2c5aa0').text('企业培训认证证书', 100, 100, { width: 600, align: 'center' });

  doc.fontSize(14).fillColor('#333').text(`证书编号：${cert.certificate_no}`, 100, 160, { width: 600, align: 'center' });

  doc.moveDown(2);
  doc.fontSize(16).fillColor('#000').text(`兹证明 ${user.name} （工号：${user.username}）`, 100, 220, { width: 600, align: 'center' });

  doc.moveDown();
  doc.fontSize(18).fillColor('#c41e3a').text(cert.name, 100, 270, { width: 600, align: 'center' });

  doc.moveDown();
  doc.fontSize(14).fillColor('#333').text('已完成相关培训并通过考试，特发此证。', 100, 320, { width: 600, align: 'center' });

  doc.moveDown(2);
  doc.fontSize(12).fillColor('#666').text(`颁发日期：${cert.issue_date}`, 100, 400, { width: 300, align: 'left' });
  doc.text(`有效期至：${cert.expire_date || '长期有效'}`, 400, 400, { width: 300, align: 'left' });

  doc.moveDown(2);
  doc.fontSize(12).fillColor('#666').text('企业培训中心  盖章', 500, 480, { width: 200, align: 'right' });

  doc.end();
  return filePath;
}

router.post('/generate/:examRecordId', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const record = db.prepare('SELECT * FROM exam_records WHERE id = ?').get(req.params.examRecordId);
  if (!record) return res.status(404).json({ code: 404, message: '考试记录不存在' });
  if (!record.passed) return res.status(400).json({ code: 400, message: '考试未通过，无法生成证书' });

  const existing = db.prepare('SELECT * FROM certificates WHERE exam_record_id = ?').get(record.id);
  if (existing) return res.status(400).json({ code: 400, message: '该考试已生成证书' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(record.course_id);

  const certNo = generateCertificateNo();
  const issueDate = formatDate(new Date(), 'YYYY-MM-DD');
  const expireDate = new Date();
  expireDate.setFullYear(expireDate.getFullYear() + 1);
  const expireStr = formatDate(expireDate, 'YYYY-MM-DD');

  const info = db.prepare(`
    INSERT INTO certificates (user_id, course_id, exam_record_id, certificate_no, name, issue_date, expire_date, valid)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(user.id, course.id, record.id, certNo, course.name + '认证证书', issueDate, expireStr);

  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid);
  const pdfPath = generateCertificatePdf(cert, user, course);
  db.prepare('UPDATE certificates SET pdf_path = ? WHERE id = ?').run(pdfPath, cert.id);

  sendNotification(user.id, 'certificate_issued', '您获得新的培训证书',
    `恭喜您通过《${course.name}》考试，获得电子证书。`, record.id);

  logAction(req.user, '生成证书', '证书管理', `为用户${user.name}生成证书${certNo}`, req);
  res.json({ code: 0, message: '证书生成成功', data: { id: info.lastInsertRowid, certificate_no: certNo } });
});

router.get('/my', authMiddleware, (req, res) => {
  const list = db.prepare(`
    SELECT c.*, co.name as course_name FROM certificates c
    JOIN courses co ON c.course_id = co.id
    WHERE c.user_id = ? ORDER BY c.issue_date DESC
  `).all(req.user.id);
  res.json({ code: 0, data: list });
});

router.get('/', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { user_id, keyword, department, page = 1, pageSize = 10 } = req.query;
  let sql = `SELECT c.*, u.name as user_name, u.department, co.name as course_name FROM certificates c
    JOIN users u ON c.user_id = u.id
    JOIN courses co ON c.course_id = co.id
    WHERE 1=1`;
  const params = [];
  if (user_id) { sql += ' AND c.user_id = ?'; params.push(user_id); }
  if (department) { sql += ' AND u.department = ?'; params.push(department); }
  if (keyword) {
    sql += ' AND (u.name LIKE ? OR co.name LIKE ? OR c.certificate_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  sql += ' ORDER BY c.issue_date DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params).map(c => ({
    ...c,
    status: !c.valid ? 'expired' : (c.expire_date && new Date(c.expire_date) < new Date() ? 'expired' : 'valid')
  }));
  let countSql = `SELECT COUNT(*) as cnt FROM certificates c JOIN users u ON c.user_id = u.id JOIN courses co ON c.course_id = co.id WHERE 1=1`;
  const countParams = [];
  if (user_id) { countSql += ' AND c.user_id = ?'; countParams.push(user_id); }
  if (department) { countSql += ' AND u.department = ?'; countParams.push(department); }
  if (keyword) {
    countSql += ' AND (u.name LIKE ? OR co.name LIKE ? OR c.certificate_no LIKE ?)';
    countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const total = db.prepare(countSql).get(...countParams).cnt;

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/download/:id', authMiddleware, (req, res) => {
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id);
  if (!cert) return res.status(404).json({ code: 404, message: '证书不存在' });
  if (req.user.role === 'employee' && cert.user_id !== req.user.id) {
    return res.status(403).json({ code: 403, message: '无权下载他人证书' });
  }
  if (!cert.pdf_path || !fs.existsSync(cert.pdf_path)) {
    return res.status(404).json({ code: 404, message: '证书文件不存在' });
  }
  res.download(cert.pdf_path, `${cert.certificate_no}.pdf`);
});

module.exports = router;
