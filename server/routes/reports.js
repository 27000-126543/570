const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { db } = require('../database');
const { authMiddleware, roleMiddleware, logAction } = require('../middleware/auth');
const { ensureDir, formatDate } = require('../utils/common');

const router = express.Router();
const reportDir = path.join(__dirname, '..', '..', 'uploads', 'reports');
ensureDir(reportDir);

function generateMonthlyReport(month, department) {
  const startDate = dayjs(month + '-01').format('YYYY-MM-DD');
  const endDate = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');

  const deptUsers = db.prepare("SELECT id FROM users WHERE department = ? AND role = 'employee'").all(department).map(u => u.id);
  const totalEmployees = deptUsers.length;

  const enrolledCount = db.prepare(`
    SELECT COUNT(DISTINCT e.user_id) as cnt FROM enrollments e
    JOIN users u ON e.user_id = u.id
    WHERE u.department = ? AND e.apply_time BETWEEN ? AND ? AND e.status != 'cancelled'
  `).get(department, startDate + ' 00:00:00', endDate + ' 23:59:59').cnt;

  const completionRate = totalEmployees > 0 ? (enrolledCount / totalEmployees * 100).toFixed(2) : 0;

  const examRecords = db.prepare(`
    SELECT * FROM exam_records er
    JOIN users u ON er.user_id = u.id
    WHERE u.department = ? AND er.submit_time BETWEEN ? AND ?
  `).all(department, startDate + ' 00:00:00', endDate + ' 23:59:59');

  const totalExams = examRecords.length;
  const passedExams = examRecords.filter(r => r.passed).length;
  const passRate = totalExams > 0 ? (passedExams / totalExams * 100).toFixed(2) : 0;

  const certCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM certificates c
    JOIN users u ON c.user_id = u.id
    WHERE u.department = ? AND c.issue_date BETWEEN ? AND ?
  `).get(department, startDate, endDate).cnt;

  const reportData = {
    month,
    department,
    totalEmployees,
    enrollmentCount: enrolledCount,
    completionRate: Number(completionRate),
    examCount: totalExams,
    passRate: Number(passRate),
    certificateCount: certCount
  };

  const existing = db.prepare('SELECT id FROM monthly_reports WHERE report_month = ? AND department = ?').get(month, department);
  if (existing) {
    db.prepare(`
      UPDATE monthly_reports SET completion_rate=?, pass_rate=?, certificate_count=?,
      enrollment_count=?, exam_count=?, report_data=? WHERE id=?
    `).run(completionRate, passRate, certCount, enrolledCount, totalExams, JSON.stringify(reportData), existing.id);
    return { id: existing.id, ...reportData };
  } else {
    const info = db.prepare(`
      INSERT INTO monthly_reports (report_month, department, completion_rate, pass_rate,
        certificate_count, enrollment_count, exam_count, report_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(month, department, completionRate, passRate, certCount, enrolledCount, totalExams, JSON.stringify(reportData));
    return { id: info.lastInsertRowid, ...reportData };
  }
}

function generateReportPdf(report) {
  const filePath = path.join(reportDir, `report-${report.department}-${report.month}.pdf`);
  const doc = new PDFDocument({ size: 'A4' });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(24).fillColor('#2c5aa0').text('月度培训分析报告', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).fillColor('#333');
  doc.text(`报告月份：${report.month}`);
  doc.text(`部门：${report.department}`);
  doc.text(`生成时间：${formatDate(new Date())}`);
  doc.moveDown(2);

  doc.fontSize(16).fillColor('#2c5aa0').text('一、培训完成情况', { underline: true });
  doc.moveDown();
  doc.fontSize(12).fillColor('#333');
  doc.text(`• 部门总人数：${report.totalEmployees} 人`);
  doc.text(`• 本月参与培训人数：${report.enrollmentCount} 人`);
  doc.text(`• 培训完成率：${report.completionRate}%`);
  doc.moveDown();

  doc.fontSize(16).fillColor('#2c5aa0').text('二、考试情况', { underline: true });
  doc.moveDown();
  doc.fontSize(12).fillColor('#333');
  doc.text(`• 考试总人次：${report.examCount} 次`);
  doc.text(`• 考试合格率：${report.passRate}%`);
  doc.moveDown();

  doc.fontSize(16).fillColor('#2c5aa0').text('三、证书发放情况', { underline: true });
  doc.moveDown();
  doc.fontSize(12).fillColor('#333');
  doc.text(`• 本月发放证书：${report.certificateCount} 张`);
  doc.moveDown(3);

  doc.fontSize(10).fillColor('#999').text('—— 企业培训中心 ——', { align: 'right' });

  doc.end();
  return filePath;
}

router.get('/generate', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { month, department } = req.query;
  if (!month || !department) return res.status(400).json({ code: 400, message: '参数不完整' });

  const report = generateMonthlyReport(month, department);
  const pdfPath = generateReportPdf(report);
  db.prepare('UPDATE monthly_reports SET pdf_path = ? WHERE id = ?').run(pdfPath, report.id);

  logAction(req.user, '生成月度报告', '统计报告', `生成${department}${month}月度报告`, req);
  res.json({ code: 0, message: '报告生成成功', data: report });
});

router.get('/', authMiddleware, roleMiddleware('trainer', 'supervisor'), (req, res) => {
  const { month, department, page = 1, pageSize = 10 } = req.query;
  let sql = 'SELECT * FROM monthly_reports WHERE 1=1';
  const params = [];
  if (month) { sql += ' AND report_month = ?'; params.push(month); }
  if (department) { sql += ' AND department = ?'; params.push(department); }
  if (req.user.role === 'supervisor') {
    sql += ' AND department = ?';
    params.push(req.user.department);
  }
  sql += ' ORDER BY report_month DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const list = db.prepare(sql).all(...params);
  let countSql = 'SELECT COUNT(*) as cnt FROM monthly_reports WHERE 1=1';
  const countParams = [];
  if (month) { countSql += ' AND report_month = ?'; countParams.push(month); }
  if (department) { countSql += ' AND department = ?'; countParams.push(department); }
  if (req.user.role === 'supervisor') { countSql += ' AND department = ?'; countParams.push(req.user.department); }
  const total = db.prepare(countSql).get(...countParams).cnt;

  list.forEach(r => { if (r.report_data) r.report_data = JSON.parse(r.report_data); });

  res.json({ code: 0, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

router.get('/download/:id', authMiddleware, (req, res) => {
  const report = db.prepare('SELECT * FROM monthly_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ code: 404, message: '报告不存在' });
  if (req.user.role === 'supervisor' && report.department !== req.user.department) {
    return res.status(403).json({ code: 403, message: '无权查看其他部门报告' });
  }

  let pdfPath = report.pdf_path;
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    const data = report.report_data ? JSON.parse(report.report_data) : {};
    data.id = report.id;
    pdfPath = generateReportPdf(data);
    db.prepare('UPDATE monthly_reports SET pdf_path = ? WHERE id = ?').run(pdfPath, report.id);
  }

  res.download(pdfPath, `培训报告-${report.department}-${report.report_month}.pdf`);
});

router.get('/summary', authMiddleware, roleMiddleware('trainer'), (req, res) => {
  const { month } = req.query;
  const m = month || dayjs().format('YYYY-MM');
  const depts = db.prepare('SELECT name FROM departments').all();

  const data = depts.map(d => {
    const r = db.prepare('SELECT * FROM monthly_reports WHERE report_month = ? AND department = ?').get(m, d.name);
    if (r) {
      return { department: d.name, ...JSON.parse(r.report_data || '{}') };
    }
    return { department: d.name, totalEmployees: 0, enrollmentCount: 0, completionRate: 0, examCount: 0, passRate: 0, certificateCount: 0 };
  });

  const overall = {
    totalEmployees: data.reduce((s, d) => s + (d.totalEmployees || 0), 0),
    enrollmentCount: data.reduce((s, d) => s + (d.enrollmentCount || 0), 0),
    examCount: data.reduce((s, d) => s + (d.examCount || 0), 0),
    certificateCount: data.reduce((s, d) => s + (d.certificateCount || 0), 0),
    completionRate: data.length > 0 ? (data.reduce((s, d) => s + Number(d.completionRate || 0), 0) / data.length).toFixed(2) : 0,
    passRate: data.length > 0 ? (data.reduce((s, d) => s + Number(d.passRate || 0), 0) / data.length).toFixed(2) : 0
  };

  res.json({ code: 0, data: { departments: data, overall } });
});

module.exports = router;
module.exports.generateMonthlyReport = generateMonthlyReport;
