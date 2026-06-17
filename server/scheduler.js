const cron = require('node-cron');
const dayjs = require('dayjs');
const { db } = require('./database');
const { sendNotification } = require('./utils/common');
const { generateMonthlyReport } = require('./routes/reports');

function startScheduledTasks() {
  console.log('[定时任务] 已启动');

  cron.schedule('0 9 * * *', () => {
    console.log('[审批超时检查] 开始执行');
    checkEscalateApprovals();
  });

  cron.schedule('0 9 * * *', () => {
    console.log('[证书到期提醒] 开始执行');
    checkCertificateExpiry();
  });

  cron.schedule('0 2 1 * *', () => {
    console.log('[月度报告生成] 开始执行');
    generateMonthlyReports();
  });
}

function checkEscalateApprovals() {
  const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss');

  const pending = db.prepare(`
    SELECT e.*, u.name as user_name, u.department, c.name as course_name
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    JOIN courses c ON e.course_id = c.id
    WHERE e.status = 'pending' AND e.apply_time < ? AND e.escalated = 0
  `).all(twoDaysAgo);

  pending.forEach(e => {
    db.prepare("UPDATE enrollments SET status = 'escalated', escalated = 1, escalated_at = ? WHERE id = ?")
      .run(dayjs().format('YYYY-MM-DD HH:mm:ss'), e.id);

    const trainers = db.prepare("SELECT id FROM users WHERE role = 'trainer'").all();
    trainers.forEach(t => {
      sendNotification(t.id, 'escalated_enrollment', '审批超时升级通知',
        `${e.department}员工${e.user_name}报名《${e.course_name}》的申请已超2个工作日未处理，请关注。`, e.id);
    });

    console.log(`[审批升级] 报名${e.id}已升级通知管理员`);
  });
}

function checkCertificateExpiry() {
  const thirtyDaysLater = dayjs().add(30, 'day').format('YYYY-MM-DD');
  const thirtyOneDaysLater = dayjs().add(31, 'day').format('YYYY-MM-DD');

  const certs = db.prepare(`
    SELECT c.*, u.name as user_name, u.id as user_id, co.name as course_name
    FROM certificates c
    JOIN users u ON c.user_id = u.id
    JOIN courses co ON c.course_id = co.id
    WHERE c.expire_date >= ? AND c.expire_date < ? AND c.valid = 1 AND c.notified = 0
  `).all(thirtyDaysLater, thirtyOneDaysLater);

  certs.forEach(cert => {
    sendNotification(cert.user_id, 'cert_expire_soon', '证书即将到期提醒',
      `您的《${cert.course_name}》证书将于${cert.expire_date}到期，请及时参加续认证培训。`, cert.id);
    db.prepare('UPDATE certificates SET notified = 1 WHERE id = ?').run(cert.id);
    console.log(`[证书提醒] 用户${cert.user_name}的证书${cert.certificate_no}即将到期`);
  });
}

function generateMonthlyReports() {
  const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');
  const depts = db.prepare('SELECT name FROM departments').all();

  depts.forEach(dept => {
    try {
      const report = generateMonthlyReport(lastMonth, dept.name);
      console.log(`[月度报告] 已生成 ${dept.name} ${lastMonth} 报告`);
    } catch (err) {
      console.error(`[月度报告] 生成失败 ${dept.name}:`, err.message);
    }
  });
}

module.exports = { startScheduledTasks };
