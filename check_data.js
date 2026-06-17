const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, 'data', 'training.db'));

console.log('=== exam_records (schema) ===');
try {
  db.prepare("PRAGMA table_info(exam_records)").all().forEach(c => console.log(`  ${c.name} ${c.type}`));
} catch(e) { console.log('err:', e.message); }

console.log('\n=== exam_records rows ===');
try {
  db.prepare('SELECT * FROM exam_records ORDER BY id').all().forEach(r => console.log(JSON.stringify(r)));
} catch(e) { console.log('err:', e.message); }

console.log('\n=== certificates (schema) ===');
try {
  db.prepare("PRAGMA table_info(certificates)").all().forEach(c => console.log(`  ${c.name} ${c.type}`));
} catch(e) { console.log('err:', e.message); }

console.log('\n=== certificates rows ===');
db.prepare('SELECT * FROM certificates ORDER BY id').all().forEach(c => console.log(JSON.stringify(c)));

console.log('\n=== question bank count by course ===');
db.prepare('SELECT course_id, COUNT(*) c FROM question_banks GROUP BY course_id').all().forEach(q => console.log(`  course_id=${q.course_id}: ${q.c} questions`));
