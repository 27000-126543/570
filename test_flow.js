const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, 'data', 'training.db'));

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers.Authorization = 'Bearer ' + token;
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }); }
        catch (e) { resolve({ status: res.statusCode, body: { raw: body } }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}
const post = (p, d, t) => request('POST', p, d, t);
const get = (p, t) => request('GET', p, null, t);

(async () => {
  try {
    // 各用户登录
    const admin = (await post('/api/auth/login', { username: 'admin', password: 'admin123' })).body.data?.token;
    const sup2 = (await post('/api/auth/login', { username: 'supervisor2', password: 'super123' })).body.data?.token;
    const emp3 = (await post('/api/auth/login', { username: 'emp003', password: 'emp123' })).body.data?.token;
    const emp1 = (await post('/api/auth/login', { username: 'emp001', password: 'emp123' })).body.data?.token;
    const emp4 = (await post('/api/auth/login', { username: 'emp004', password: 'emp123' })).body.data?.token;
    console.log('所有账号登录成功 emp003=陈大海（市场部已通过course3）');

    // 证书列表字段检查
    console.log('\n=== [验证] 证书列表字段 ===');
    const cl = (await get('/api/certificates?pageSize=10', admin)).body.data;
    console.log('证书数:', cl?.total);
    cl?.list?.forEach(c => console.log(`  ${c.certificate_no} | 用户=${c.user_name} | 部门=${c.department} | 课程=${c.course_name} | 状态=${c.status}`));

    // emp003 开始考试3 (市场营销，已报名且已通过审批，emp003=陈大海市场部，无时间冲突)
    console.log('\n=== emp003 开始考试3 (市场营销) ===');
    r = await post('/api/exams/3/start', {}, emp3);
    console.log('  start:', r.body.code, 'recordId=', r.body.data?.recordId, r.body.message || '');
    const rid = r.body.data?.recordId;
    if (!rid) { console.log('可能已参加，用数据库找一个通过但无证书的考试记录'); return; }

    r = await get('/api/exams/take/' + rid, emp3);
    const paperQs = r.body.data?.questions || [];
    const examId = r.body.data?.exam?.id;
    console.log('  题目数:', paperQs.length, '考题examId=', examId);

    // 从数据库查出course3=市场营销(course_id=3)的题和答案
    const qAns = {};
    db.prepare('SELECT id, answer, type FROM question_banks WHERE course_id = 3').all().forEach(q => qAns[q.id] = q);

    // 根据抽到的题，填正确答案
    const answers = {};
    for (const q of paperQs) {
      const qdb = qAns[q.id];
      if (!qdb) continue;
      if (qdb.type === 'multiple') answers[q.id] = qdb.answer.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
      else answers[q.id] = qdb.answer;
    }
    console.log('  填的答案:', JSON.stringify(answers));

    // 提交考试
    console.log('\n=== 交卷 ===');
    r = await post(`/api/exams/${examId}/submit`, { recordId: rid, answers }, emp3);
    console.log('  状态:', r.status, 'code:', r.body.code, r.body.message);
    if (r.body.data) {
      const d = r.body.data;
      console.log('  得分:', d.score, '/', d.total_score, ' 通过:', d.passed, ' 对/错:', d.correct_count, '/', d.wrong_count);
      d.question_details?.forEach(q => console.log(`    ${q.type.padEnd(8)} ${q.is_correct?'✓':'✗'} 你的:${JSON.stringify(q.user_answer).padEnd(16)} 正确:${q.correct_answer}`));

      if (d.passed) {
        console.log('\n=== 通过！管理员生成证书 ===');
        r = await post(`/api/certificates/generate/${rid}`, {}, admin);
        console.log('  生成结果:', r.body.code, r.body.message, r.body.data || '');
      }
    }

    // emp003查看我的证书
    console.log('\n=== emp003 我的证书 ===');
    r = await get('/api/certificates/my', emp3);
    (r.body.data || []).forEach(c => console.log(`  ${c.certificate_no} ${c.course_name} valid=${c.valid} PDF=${!!c.pdf_path}`));

    // 管理员证书列表
    console.log('\n=== 管理员 证书列表（最新3条）===');
    r = await get('/api/certificates?pageSize=3', admin);
    r.body.data?.list?.forEach(c => console.log(`  ${c.certificate_no} | 用户=${c.user_name} | 部门=${c.department} | 课程=${c.course_name} | 状态=${c.status}`));

    // emp001我的证书（空）
    console.log('\n=== emp001 我的证书（应空或只有之前考过的）===');
    r = await get('/api/certificates/my', emp1);
    (r.body.data || []).forEach(c => console.log(`  ${c.certificate_no} ${c.course_name} valid=${c.valid} PDF=${!!c.pdf_path}`));

    // emp004我的证书（已有的一张）
    console.log('\n=== emp004 我的证书 ===');
    r = await get('/api/certificates/my', emp4);
    (r.body.data || []).forEach(c => console.log(`  ${c.certificate_no} ${c.course_name} valid=${c.valid} PDF=${!!c.pdf_path}`));

    console.log('\n全部验证完成 ✓');
  } catch (e) { console.error(e); }
})();
