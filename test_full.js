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
    // 管理员token
    let r = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
    const at = r.body.data?.token;
    console.log('管理员token OK');

    // 列表字段检查
    console.log('\n=== 证书列表字段检查 ===');
    r = await get('/api/certificates?pageSize=10', at);
    console.log('  总数:', r.body.data?.total);
    const list = r.body.data?.list || [];
    list.forEach(c => {
      console.log(`  - ${c.certificate_no} | 持证人:${c.user_name} | 部门:${c.department} | 课程:${c.course_name} | 状态:${c.status}`);
    });

    // 查question_banks中的course3试题（id=3）答案
    console.log('\n=== 查找course3(course_id=3)试题答案 ===');
    const qs3 = db.prepare('SELECT id, answer, type FROM question_banks WHERE course_id = 3').all();
    console.log('  试题数:', qs3.length, qs3);

    // emp001登录
    r = await post('/api/auth/login', { username: 'emp001', password: 'emp123' });
    const et1 = r.body.data?.token;
    const uid = r.body.data?.user?.id;

    // 报名 course3
    r = await post('/api/enrollments/apply', { course_id: 3 }, et1);
    console.log('\nemp001报名:', r.body.code, r.body.message, 'enroll id:', r.body.data?.id);

    // supervisor2审批
    r = await post('/api/auth/login', { username: 'supervisor2', password: 'super123' });
    const st = r.body.data?.token;
    r = await get('/api/enrollments/pending', st);
    console.log('  待审批:', r.body.data?.length);
    for (const p of (r.body.data || [])) {
      if (String(p.user_id) === String(uid) && Number(p.course_id) === 3) {
        r = await post(`/api/enrollments/${p.id}/approve`, {}, st);
        console.log('  审批通过:', r.body.code);
        break;
      }
    }

    // emp001开始考试3
    r = await post('/api/auth/login', { username: 'emp001', password: 'emp123' });
    const et2 = r.body.data?.token;
    r = await post('/api/exams/3/start', {}, et2);
    console.log('\n  开始考试3:', r.body.code, 'recordId=', r.body.data?.recordId, r.body.message);
    const rid = r.body.data?.recordId;
    if (!rid) return;

    // 取题目
    r = await get('/api/exams/take/' + rid, et2);
    const paperQs = r.body.data?.questions || [];
    const examId = r.body.data?.exam?.id;
    console.log('  题目数:', paperQs.length, 'examId=', examId);

    // 根据题目ID，查答案表
    const qbank = {};
    qs3.forEach(q => qbank[q.id] = q);
    const answers = {};
    for (const q of paperQs) {
      const a = qbank[q.id];
      if (!a) { console.log('  题ID:', q.id, '没在qbank找到'); continue; }
      if (a.type === 'multiple') {
        answers[q.id] = a.answer.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      } else {
        answers[q.id] = a.answer;
      }
    }
    console.log('  提交的答案(JSON):', JSON.stringify(answers));

    // 提交
    r = await post(`/api/exams/${examId}/submit`, { recordId: rid, answers }, et2);
    console.log('\n=== 交卷结果 ===');
    console.log('  status:', r.status, 'code:', r.body.code, r.body.message);
    if (r.body.data) {
      const d = r.body.data;
      console.log('  得分:', d.score, '/', d.total_score, '通过?:', d.passed);
      console.log('  正确/错题数:', d.correct_count, '/', d.wrong_count);
      d.question_details?.forEach(q => {
        console.log(`    ${q.type} 正确?:${q.is_correct} 正确答案:${q.correct_answer} 你的:${JSON.stringify(q.user_answer)}`);
      });

      if (d.passed) {
        console.log('\n=== 通过了！管理员生成证书 ===');
        r = await post(`/api/certificates/generate/${rid}`, {}, at);
        console.log('  生成结果:', r.status, r.body.code, r.body.message, r.body.data);
      }
    } else {
      console.log('  错误返回:', JSON.stringify(r.body));
    }

    // 员工查看我的证书
    console.log('\n=== emp001 我的证书 ===');
    r = await get('/api/certificates/my', et2);
    (r.body.data || []).forEach(c => {
      console.log(`  ${c.certificate_no} ${c.course_name} PDF:${!!c.pdf_path} valid=${c.valid}`);
    });

    // 管理员证书列表
    console.log('\n=== 最新证书列表 ===');
    r = await get('/api/certificates?pageSize=10', at);
    (r.body.data?.list || []).slice(0, 5).forEach(c => {
      console.log(`  ${c.certificate_no} | 用户:${c.user_name} | 部门:${c.department} | 课程:${c.course_name} | 状态:${c.status}`);
    });

    console.log('\n=== 完成 ===');
  } catch (e) { console.error(e); }
})();
