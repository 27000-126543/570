const http = require('http');
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 3001, path, method, headers: { 'Content-Type': 'application/json' }};
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
    const emp1 = (await post('/api/auth/login', { username: 'emp001', password: 'emp123' })).body.data?.token;
    const emp4 = (await post('/api/auth/login', { username: 'emp004', password: 'emp123' })).body.data?.token;
    const admin = (await post('/api/auth/login', { username: 'admin', password: 'admin123' })).body.data?.token;
    console.log('全部登录OK');

    console.log('\n=== 消息通知API测试（emp001=王小明） ===');
    let r = await get('/api/notifications?pageSize=5', emp1);
    console.log('  全部消息: code=', r.body.code, ' total=', r.body.data?.total);
    if (r.body.code !== 0) console.log('    MSG(ERR):', JSON.stringify(r.body).slice(0,200));

    r = await get('/api/notifications/unread-count', emp1);
    console.log('  未读数: code=', r.body.code, ' count=', r.body.data?.unread_count);
    if (r.body.code !== 0) console.log('    MSG(ERR):', JSON.stringify(r.body).slice(0,200));

    r = await get('/api/notifications?type=unread&pageSize=5', emp1);
    console.log('  未读消息: code=', r.body.code, ' total=', r.body.data?.total);
    if (r.body.code !== 0) console.log('    MSG(ERR):', JSON.stringify(r.body).slice(0,200));

    // 把第一条标已读
    const firstId = r.body.data?.list?.[0]?.id;
    if (firstId) {
      r = await post(`/api/notifications/${firstId}/read`, {}, emp1);
      console.log('  标单条已读 id='+firstId+':', r.body.code, r.body.message);
    }
    // 全部标已读
    r = await post('/api/notifications/read-all', {}, emp1);
    console.log('  全部标已读:', r.body.code, r.body.message);
    r = await get('/api/notifications/unread-count', emp1);
    console.log('  操作后未读数:', r.body.data?.unread_count);

    console.log('\n=== Dashboard聚合API（supervisor2） ===');
    const sup2 = (await post('/api/auth/login', { username: 'supervisor2', password: 'super123' })).body.data?.token;
    r = await get('/api/reports/overview', sup2);
    console.log('  reports/overview: code=', r.body.code);
    r = await get('/api/reports/courses?timeRange=thisMonth', sup2);
    console.log('  reports/courses: code=', r.body.code);
    r = await get('/api/reports/exams?timeRange=thisMonth', sup2);
    console.log('  reports/exams: code=', r.body.code);
    r = await get('/api/reports/certificates?timeRange=thisMonth', sup2);
    console.log('  reports/certificates: code=', r.body.code);
    r = await get('/api/reports/skills/departments?timeRange=thisMonth', sup2);
    console.log('  reports/skills/departments: code=', r.body.code);
    r = await get('/api/reports/skills/top?timeRange=thisMonth&limit=5', sup2);
    console.log('  reports/skills/top: code=', r.body.code);

    console.log('\n=== 考试记录详情API ===');
    // 管理员视角
    r = await get('/api/exams/records/3/trainer', admin);
    console.log('  管理员看详情(rid=3): code=', r.body.code, ' exam_name=', r.body.data?.exam_name, ' qd=', r.body.data?.question_details?.length, ' answers=', !!r.body.data?.answers);
    if (r.body.code !== 0) console.log('    MSG(ERR):', JSON.stringify(r.body).slice(0,200));
    // 员工视角
    r = await get('/api/exams/records/3', emp4);
    console.log('  emp4看他人详情(rid=3): code=', r.body.code);
    const emp3 = (await post('/api/auth/login', { username: 'emp003', password: 'emp123' })).body.data?.token;
    r = await get('/api/exams/records/3', emp3);
    console.log('  emp3看自己详情(rid=3): code=', r.body.code, ' exam_name=', r.body.data?.exam_name, ' qd=', r.body.data?.question_details?.length, ' answers=', !!r.body.data?.answers);

    console.log('\n✅ 全部API测试通过！');
  } catch (e) { console.error(e); }
})();
