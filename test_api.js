const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers.Authorization = 'Bearer ' + token;
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: body } });
        }
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
    let token = null;
    let r = await post('/api/auth/login', { username: 'emp001', password: 'emp123' });
    console.log('登录:', r.status, r.body.code, r.body.message);
    token = r.body.data?.token;
    if (!token) { console.log('登录失败'); return; }

    let examId = 1, rid = null;
    r = await post('/api/exams/1/start', {}, token);
    if (r.body.code !== 0) {
      console.log('考试1失败，尝试考试2:', r.body.code, r.body.message);
      r = await post('/api/exams/2/start', {}, token);
      examId = 2;
    }
    rid = r.body.data?.recordId;
    console.log(`开始考试id=${examId}, recordId=${rid}`);

    r = await get('/api/exams/take/' + rid, token);
    const qs = r.body.data?.questions || [];
    console.log('题目数:', qs.length);
    const eid = r.body.data?.exam?.id || examId;

    // 模拟答案：设置部分题，其中多选项顺序不同
    const answers = {};
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (q.type === 'multiple') {
        // 故意打乱顺序
        answers[q.id] = ['C','A','B','D'].slice(0, 3);
      } else if (q.type === 'judge') {
        answers[q.id] = 'true';
      } else {
        answers[q.id] = 'B';
      }
    }
    console.log('答案:', JSON.stringify(answers, null, 2));

    r = await post('/api/exams/' + eid + '/submit', { recordId: rid, answers }, token);
    console.log('\n提交结果:');
    console.log('  status:', r.status, 'code:', r.body.code, r.body.message);
    if (r.body.data) {
      const d = r.body.data;
      console.log('  分数:', d.score, '/', d.total_score);
      console.log('  通过?:', d.passed);
      console.log('  正确/错误题数:', d.correct_count, '/', d.wrong_count);
      console.log('\n每题详情:');
      if (d.question_details) {
        for (const q of d.question_details) {
          console.log(`  [${q.type}] ${q.question.slice(0,30)}...`);
          console.log(`      正确? ${q.is_correct} | 正确答案: ${q.correct_answer} | 你的: ${JSON.stringify(q.user_answer)}`);
        }
      }
    } else {
      console.log('  返回错误详情:', JSON.stringify(r.body));
    }

    console.log('\n--- 测试考试记录详情接口 ---');
    r = await get('/api/exams/records/' + rid, token);
    console.log('详情接口 status:', r.status, 'code:', r.body.code);
    if (r.body.data) {
      const d = r.body.data;
      console.log('  考试:', d.exam_name);
      console.log('  question_details数量:', d.question_details?.length);
      console.log('  answers字段存在:', !!d.answers);
    }

    console.log('\n--- 测试消息通知接口 ---');
    r = await get('/api/notifications?status=unread', token);
    console.log('未读消息 status:', r.status, 'code:', r.body.code, 'list数:', r.body.data?.list?.length, 'unreadCount:', r.body.data?.unreadCount);

    console.log('\n--- 全部测试完成 ---');
  } catch (e) {
    console.error('错误:', e);
  }
})();
