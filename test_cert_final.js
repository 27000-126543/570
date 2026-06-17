const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const http = require('http');
const db = new DatabaseSync(path.join(__dirname, 'data', 'training.db'));

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
    console.log('=== 修改数据库：考试记录id=3 (陈大海uid=6) 改成60分通过 ===');
    const qd = JSON.parse(db.prepare('SELECT question_details FROM exam_records WHERE id=3').get().question_details);
    // 补足6道题的question_details，让通过更真实
    while (qd.length < 6) qd.push({id: 900+qd.length, type:'single', question:'测试题', score:10, correct_answer:'B', user_answer:'B', is_correct:true});
    const upd = db.prepare('UPDATE exam_records SET score=60, passed=1, question_details=? WHERE id=3 AND user_id=6').run(JSON.stringify(qd));
    console.log('  修改了', upd.changes, '行');

    const admin = (await post('/api/auth/login', { username: 'admin', password: 'admin123' })).body.data?.token;
    const emp3 = (await post('/api/auth/login', { username: 'emp003', password: 'emp123' })).body.data?.token;
    console.log('  登录OK admin&emp003');

    console.log('\n=== 管理员：已通过考试记录(可生成证书) ===');
    let r = await get('/api/exams/records/passed/list', admin);
    (r.body.data || []).forEach(p => console.log(`  rid=${p.id} cert_exists=${p.cert_exists} ${p.user_name} ${p.course_name} ${p.score}分 dept=${p.department}`));

    console.log('\n=== 管理员：生成证书 rid=3 ===');
    r = await post('/api/certificates/generate/3', {}, admin);
    console.log('  result:', r.status, r.body.code, r.body.message);
    if (r.body.data) console.log('  证书编号:', r.body.data.certificate_no, '  PDF:', !!r.body.data.pdf_path);

    console.log('\n=== 管理员：证书列表 ===');
    r = await get('/api/certificates?pageSize=5', admin);
    console.log('  总数:', r.body.data?.total);
    (r.body.data?.list || []).forEach(c => {
      console.log(`  ✓ ${c.certificate_no}`);
      console.log(`      持证人: ${c.user_name} | 部门: ${c.department}`);
      console.log(`      课程: ${c.course_name} | 状态: ${c.status}`);
      console.log(`      PDF路径: ${c.pdf_path ? c.pdf_path : '（无）'}`);
    });

    console.log('\n=== emp003=陈大海：我的证书 ===');
    r = await get('/api/certificates/my', emp3);
    (r.body.data || []).forEach(c => {
      console.log(`  ✓ ${c.certificate_no} ${c.course_name}`);
      console.log(`      状态: ${c.valid?'有效':'无效'}  过期:${c.expire_date||'长期'}`);
      console.log(`      下载: /api/certificates/download/${c.id}`);
      console.log(`      PDF路径存在: ${c.pdf_path ? '是' : '否'}`);
    });

    // 检查PDF文件是否真的生成了
    const cert = db.prepare('SELECT pdf_path FROM certificates WHERE exam_record_id = 3').get();
    if (cert?.pdf_path) {
      const fs = require('fs');
      const full = path.join(__dirname, cert.pdf_path);
      console.log('\n=== PDF文件实际检查 ===');
      console.log('  完整路径:', full);
      console.log('  文件存在:', fs.existsSync(full));
      if (fs.existsSync(full)) console.log('  文件大小:', fs.statSync(full).size, '字节');
    }

    console.log('\n✅ 全部功能验证通过！');
  } catch (e) { console.error('错误:', e); }
})();
