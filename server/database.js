const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'training.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

class StatementWrapper {
  constructor(stmt) {
    this.stmt = stmt;
  }
  run(...params) {
    try {
      const result = this.stmt.run(...params);
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes || 0
      };
    } catch (err) {
      throw err;
    }
  }
  get(...params) {
    return this.stmt.get(...params);
  }
  all(...params) {
    return this.stmt.all(...params);
  }
}

const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql) {
  const stmt = originalPrepare(sql);
  return new StatementWrapper(stmt);
};

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('employee', 'trainer', 'supervisor')),
      department TEXT NOT NULL,
      position TEXT,
      phone TEXT,
      email TEXT,
      total_hours INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      quota INTEGER DEFAULT 10,
      supervisor_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supervisor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      category TEXT,
      description TEXT,
      hours INTEGER NOT NULL,
      required_hours INTEGER DEFAULT 0,
      capacity INTEGER DEFAULT 50,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      location TEXT,
      teacher TEXT,
      courseware_path TEXT,
      courseware_name TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'completed', 'cancelled')),
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled', 'escalated')),
      apply_time TEXT DEFAULT CURRENT_TIMESTAMP,
      approve_time TEXT,
      approve_by INTEGER,
      reject_reason TEXT,
      escalated INTEGER DEFAULT 0,
      escalated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (approve_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS question_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('single', 'multiple', 'judge')),
      options TEXT,
      answer TEXT NOT NULL,
      score INTEGER DEFAULT 10,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      duration INTEGER DEFAULT 60,
      total_score INTEGER DEFAULT 100,
      pass_score INTEGER DEFAULT 60,
      question_count INTEGER DEFAULT 10,
      start_time TEXT,
      end_time TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS exam_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      questions TEXT NOT NULL,
      answers TEXT,
      score INTEGER,
      passed INTEGER DEFAULT 0,
      start_time TEXT,
      submit_time TEXT,
      duration_used INTEGER,
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      exam_record_id INTEGER NOT NULL,
      certificate_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      expire_date TEXT,
      valid INTEGER DEFAULT 1,
      pdf_path TEXT,
      notified INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (exam_record_id) REFERENCES exam_records(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      related_id INTEGER,
      "read" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_month TEXT NOT NULL,
      department TEXT NOT NULL,
      completion_rate REAL DEFAULT 0,
      pass_rate REAL DEFAULT 0,
      certificate_count INTEGER DEFAULT 0,
      enrollment_count INTEGER DEFAULT 0,
      exam_count INTEGER DEFAULT 0,
      report_data TEXT,
      pdf_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(report_month, department)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      role TEXT,
      action TEXT NOT NULL,
      module TEXT,
      description TEXT,
      ip TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS skill_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      skill_name TEXT NOT NULL,
      level TEXT DEFAULT 'beginner',
      source TEXT,
      related_course_id INTEGER,
      score INTEGER,
      acquired_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (related_course_id) REFERENCES courses(id)
    );
  `);

  try {
    db.prepare('ALTER TABLE exam_records ADD COLUMN question_details TEXT').run();
  } catch (e) {}

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role, department, position, phone, email, total_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run(
    'admin', hashPassword('admin123'), '系统管理员', 'trainer', '培训部', '培训管理员', '13800000001', 'admin@company.com', 0
  ).lastInsertRowid;

  const supervisor1Id = insertUser.run(
    'supervisor1', hashPassword('super123'), '张主管', 'supervisor', '技术部', '技术部主管', '13800000002', 'zhang@company.com', 48
  ).lastInsertRowid;

  const supervisor2Id = insertUser.run(
    'supervisor2', hashPassword('super123'), '李主管', 'supervisor', '市场部', '市场部主管', '13800000003', 'li@company.com', 32
  ).lastInsertRowid;

  const emp1Id = insertUser.run(
    'emp001', hashPassword('emp123'), '王小明', 'employee', '技术部', '前端工程师', '13800000010', 'wangxm@company.com', 24
  ).lastInsertRowid;

  const emp2Id = insertUser.run(
    'emp002', hashPassword('emp123'), '赵丽华', 'employee', '技术部', '后端工程师', '13800000011', 'zhaolh@company.com', 18
  ).lastInsertRowid;

  const emp3Id = insertUser.run(
    'emp003', hashPassword('emp123'), '陈大海', 'employee', '市场部', '市场专员', '13800000012', 'chendh@company.com', 8
  ).lastInsertRowid;

  const emp4Id = insertUser.run(
    'emp004', hashPassword('emp123'), '刘芳芳', 'employee', '市场部', '销售助理', '13800000013', 'liuff@company.com', 42
  ).lastInsertRowid;

  const insertDept = db.prepare(`
    INSERT INTO departments (name, quota, supervisor_id) VALUES (?, ?, ?)
  `);
  insertDept.run('培训部', 20, adminId);
  insertDept.run('技术部', 30, supervisor1Id);
  insertDept.run('市场部', 25, supervisor2Id);

  const insertCourse = db.prepare(`
    INSERT INTO courses (name, code, category, description, hours, required_hours, capacity, start_date, end_date, location, teacher, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];
  const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return formatDate(nd); };

  const course1Id = insertCourse.run(
    'React前端开发实战', 'TECH-001', '技术培训',
    '深入学习React框架核心概念，掌握Hooks、状态管理及项目实战开发',
    24, 16, 30,
    addDays(today, 3), addDays(today, 10),
    '培训室A', '李老师', 'published', adminId
  ).lastInsertRowid;

  const course2Id = insertCourse.run(
    'Node.js后端开发', 'TECH-002', '技术培训',
    'Node.js服务端开发，Express框架、数据库操作、API设计',
    32, 24, 25,
    addDays(today, 5), addDays(today, 15),
    '培训室B', '王老师', 'published', adminId
  ).lastInsertRowid;

  const course3Id = insertCourse.run(
    '市场营销策略', 'MKT-001', '市场培训',
    '现代市场营销理论、数字营销、客户关系管理实战',
    16, 8, 40,
    addDays(today, 7), addDays(today, 12),
    '会议室201', '赵老师', 'published', adminId
  ).lastInsertRowid;

  const course4Id = insertCourse.run(
    '团队管理与沟通', 'MGT-001', '管理培训',
    '团队建设、有效沟通、冲突管理、领导力提升',
    12, 6, 35,
    addDays(today, -10), addDays(today, -3),
    '培训室C', '孙老师', 'completed', adminId
  ).lastInsertRowid;

  const insertQuestion = db.prepare(`
    INSERT INTO question_banks (course_id, question, type, options, answer, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertQuestion.run(course1Id, 'React中用于管理组件状态的Hook是？', 'single',
    JSON.stringify(['useEffect', 'useState', 'useContext', 'useRef']), 'B', 10);
  insertQuestion.run(course1Id, '以下哪个不是React的生命周期方法？', 'single',
    JSON.stringify(['componentDidMount', 'componentWillUpdate', 'onRender', 'componentWillUnmount']), 'C', 10);
  insertQuestion.run(course1Id, 'React组件的props可以被修改。', 'judge', null, 'false', 10);
  insertQuestion.run(course1Id, 'useEffect的第二个参数作用是？', 'single',
    JSON.stringify(['设置初始状态', '指定依赖项', '设置定时器', '处理错误']), 'B', 10);
  insertQuestion.run(course1Id, '以下哪些是React常用的状态管理方案？（多选）', 'multiple',
    JSON.stringify(['Redux', 'MobX', 'Context API', 'jQuery']), 'A,B,C', 10);
  insertQuestion.run(course1Id, 'JSX中可以直接写if语句。', 'judge', null, 'false', 10);
  insertQuestion.run(course1Id, 'React虚拟DOM的主要优势是？', 'single',
    JSON.stringify(['代码更简洁', '直接操作DOM更快', '减少真实DOM操作提升性能', '支持更多CSS属性']), 'C', 10);
  insertQuestion.run(course1Id, 'useRef可以用于获取DOM元素引用。', 'judge', null, 'true', 10);
  insertQuestion.run(course1Id, '以下哪个Hook用于性能优化？', 'single',
    JSON.stringify(['useState', 'useEffect', 'useMemo', 'useRef']), 'C', 10);
  insertQuestion.run(course1Id, 'React组件通信方式有哪些？（多选）', 'multiple',
    JSON.stringify(['props传递', 'Context', 'Redux等状态库', '事件总线']), 'A,B,C,D', 10);
  insertQuestion.run(course1Id, 'React 18支持并发渲染。', 'judge', null, 'true', 10);
  insertQuestion.run(course1Id, 'key属性的作用是？', 'single',
    JSON.stringify(['美化代码', '帮助React识别列表元素变化', '设置元素样式', '绑定事件']), 'B', 10);

  insertQuestion.run(course2Id, 'Express中处理GET请求的方法是？', 'single',
    JSON.stringify(['app.post()', 'app.get()', 'app.put()', 'app.delete()']), 'B', 10);
  insertQuestion.run(course2Id, 'Node.js是单线程运行的。', 'judge', null, 'true', 10);
  insertQuestion.run(course2Id, '以下哪个是Node.js内置模块？', 'multiple',
    JSON.stringify(['fs', 'path', 'http', 'axios']), 'A,B,C', 10);
  insertQuestion.run(course2Id, 'npm是Node.js的包管理器。', 'judge', null, 'true', 10);
  insertQuestion.run(course2Id, 'Express中间件通过什么函数调用下一个？', 'single',
    JSON.stringify(['next()', 'continue()', 'pass()', 'go()']), 'A', 10);
  insertQuestion.run(course2Id, '以下哪个数据库非关系型？', 'single',
    JSON.stringify(['MySQL', 'PostgreSQL', 'MongoDB', 'SQLite']), 'C', 10);
  insertQuestion.run(course2Id, 'RESTful API中PUT用于创建资源。', 'judge', null, 'false', 10);
  insertQuestion.run(course2Id, 'JWT用于什么场景？', 'single',
    JSON.stringify(['文件上传', '身份认证', '数据加密', '日志记录']), 'B', 10);

  insertQuestion.run(course3Id, '4P营销理论不包括？', 'single',
    JSON.stringify(['Product', 'Price', 'People', 'Promotion']), 'C', 10);
  insertQuestion.run(course3Id, '市场细分是目标市场营销的第一步。', 'judge', null, 'true', 10);
  insertQuestion.run(course3Id, '数字营销渠道有哪些？（多选）', 'multiple',
    JSON.stringify(['社交媒体', '搜索引擎', '电子邮件', '线下展会']), 'A,B,C', 10);

  insertQuestion.run(course4Id, '有效沟通的要素包括？（多选）', 'multiple',
    JSON.stringify(['清晰表达', '积极倾听', '及时反馈', '情绪管理']), 'A,B,C,D', 10);
  insertQuestion.run(course4Id, '团队冲突一定是坏事。', 'judge', null, 'false', 10);
  insertQuestion.run(course4Id, '情境领导理论由谁提出？', 'single',
    JSON.stringify(['马斯洛', '赫塞-布兰查德', '泰勒', '法约尔']), 'B', 10);

  const insertExam = db.prepare(`
    INSERT INTO exams (course_id, name, duration, total_score, pass_score, question_count, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExam.run(course1Id, 'React前端开发实战-结业考试', 60, 100, 60, 10,
    addDays(today, 10), addDays(today, 20), 'active');
  insertExam.run(course2Id, 'Node.js后端开发-结业考试', 90, 100, 60, 8,
    addDays(today, 15), addDays(today, 25), 'active');
  insertExam.run(course3Id, '市场营销策略-结业考试', 45, 100, 60, 6,
    addDays(today, 12), addDays(today, 22), 'active');
  insertExam.run(course4Id, '团队管理与沟通-结业考试', 45, 100, 60, 6,
    addDays(today, -3), addDays(today, 2), 'closed');

  const insertEnrollment = db.prepare(`
    INSERT INTO enrollments (user_id, course_id, status, apply_time, approve_time, approve_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertEnrollment.run(emp1Id, course1Id, 'approved', addDays(today, -2), addDays(today, -1), supervisor1Id);
  insertEnrollment.run(emp2Id, course1Id, 'approved', addDays(today, -2), addDays(today, -1), supervisor1Id);
  insertEnrollment.run(emp1Id, course2Id, 'pending', addDays(today, -1), null, null);
  insertEnrollment.run(emp3Id, course3Id, 'approved', addDays(today, -2), addDays(today, -1), supervisor2Id);
  insertEnrollment.run(emp4Id, course4Id, 'completed', addDays(today, -15), addDays(today, -14), supervisor2Id);

  const insertExamRecord = db.prepare(`
    INSERT INTO exam_records (exam_id, user_id, course_id, questions, answers, score, passed, start_time, submit_time, duration_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExamRecord.run(4, emp4Id, course4Id,
    JSON.stringify([{id: 25}, {id: 26}, {id: 27}, {id: 28}, {id: 29}, {id: 30}]),
    JSON.stringify({25: 'A', 26: 'true', 27: 'A,B,C', 28: 'false', 29: 'B', 30: 'B'}),
    85, 1, addDays(today, -2) + ' 10:00:00', addDays(today, -2) + ' 10:35:00', 35
  );

  const insertCert = db.prepare(`
    INSERT INTO certificates (user_id, course_id, exam_record_id, certificate_no, name, issue_date, expire_date, valid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCert.run(emp4Id, course4Id, 1, 'CERT-' + Date.now(), '团队管理与沟通认证证书',
    addDays(today, -2), addDays(today, 363), 1);
}

module.exports = { db, initDatabase };
