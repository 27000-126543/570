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
    // 1. emp004登录（团队管理与沟通那门课已结业，尝试考试4，之前考过但cert_exists=1）
    console.log('=== emp004登录，参加考试4 ===');
    let r = await post('/api/auth/login', { username: 'emp004', password: 'emp123' });
    console.log('登录:', r.status, r.body.code, '用户:', r.body.data?.user?.name);
    const et = r.body.data?.token;

    // 登录管理员
    let ar = await post('/api/auth/login', { username: 'admin', password: 'admin123' });
    const at = ar.body.data?.token;

    // 查证书列表
    console.log('\n=== 证书列表（生成前）===');
    r = await get('/api/certificates?pageSize=20', at);
    const beforeCount = r.body.data?.total || 0;
    console.log('证书总数:', beforeCount);

    // 用 emp001 考考试3（市场营销），并模拟全对答案
    console.log('\n=== emp001登录，参加考试3（市场营销）===');
    r = await post('/api/auth/login', { username: 'emp001', password: 'emp123' });
    const et1 = r.body.data?.token;

    // emp001 先报名并审批通过 course3
    console.log('\n=== emp001 报名课程3 ===');
    r = await post('/api/enrollments/apply', { course_id: 3 }, et1);
    console.log('报名:', r.status, r.body.code, r.body.message);
    const eid = r.body.data?.id;

    // 主管审批：supervisor2（市场部主管）
    console.log('=== supervisor2 审批通过 ===');
    r = await post('/api/auth/login', { username: 'supervisor2', password: 'super123' });
    const st = r.body.data?.token;
    r = await get('/api/enrollments/pending', st);
    console.log('  待审批:', r.body.data?.length);
    const pending = r.body.data || [];
    for (const p of pending) {
      if (p.user_name === '王小明' && p.course_id === 3) {
        r = await post(`/api/enrollments/${p.id}/approve`, {}, st);
        console.log('  审批结果:', r.body.code, r.body.message);
      }
    }

    // emp001 开始考试3
    console.log('\n=== emp001 开始考试3 ===');
    r = await post('/api/auth/login', { username: 'emp001', password: 'emp123' });
    const et2 = r.body.data?.token;
    r = await post('/api/exams/3/start', {}, et2);
    console.log('  start:', r.body.code, 'recordId:', r.body.data?.recordId, r.body.message);
    const rid = r.body.data?.recordId;
    if (!rid) { console.log('开始考试失败，直接退出'); process.exit(0); }
    r = await get('/api/exams/take/' + rid, et2);
    const qs = r.body.data?.questions || [];
    console.log('  考题数:', qs.length);

    // 用考题详情获取正确答案 - 但接口没有答案，我们查DB构造
    // 实际上考试3的题是: 题25(4P-单选C), 题26(判断对), 题27(多选ABC)
    // 但我们的emp001的exam3题目是随机组卷，只有6道题
    // 直接提交空答案先看一下question_details接口（考试结束后），但那样会不通过
    // 用技巧：直接用管理员接口把exam_records里某条记录改成passed=1, 生成证书
    // 或者更实际：先交卷, 用正确答案数组自己全填
    // 先看题目列表ID，然后去查question_banks答案（DB里）

    // 简单做法：我们不用通过考试，直接在exam3已有通过记录中用。
    // 但更实际的是，直接调用已生成的考试record id=4去看看详情
    console.log('\n=== 用已通过考试记录（刘芳芳-ID4）生成证书？应提示已生成 ===');
    r = await post(`/api/certificates/generate/4`, {}, at);
    console.log('  生成结果:', r.status, r.body.code, r.body.message);

    // 最有效验证：检查证书列表字段是否有持证人、部门、课程、证书号
    console.log('\n=== 检查证书列表字段完整性 ===');
    r = await get('/api/certificates?pageSize=5', at);
    (r.body.data?.list || []).forEach(c => {
      console.log('  证书:', c.certificate_no);
      console.log('    持证人:', c.user_name);
      console.log('    部门:', c.department);
      console.log('    课程:', c.course_name);
      console.log('    状态:', c.status);
    });

    // emp001的我的证书
    console.log('\n=== emp001 我的证书 ===');
    r = await get('/api/certificates/my', et2);
    console.log('  证书数:', r.body.data?.length);
    (r.body.data || []).forEach(c => {
      console.log('    ', c.certificate_no, c.course_name, c.pdf_path ? '有PDF' : '无PDF');
    });

    console.log('\n=== 全部完成 ===');
  } catch (e) {
    console.error('错误:', e);
  }
})();
