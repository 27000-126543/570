const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { db } = require('../database');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function validateFile(file, originalName) {
  const errors = [];
  const ALLOWED_EXTENSIONS = ['.pdf', '.mp4'];
  const MAX_SIZE = 500 * 1024 * 1024;
  const NAME_PATTERN = /^[A-Za-z0-9\u4e00-\u9fa5_\-\s]{1,100}\.(pdf|mp4)$/i;

  const ext = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push('文件格式不支持，仅允许PDF和MP4格式');
  }

  if (file.size > MAX_SIZE) {
    errors.push(`文件大小超过限制，最大允许500MB，当前文件${(file.size / 1024 / 1024).toFixed(2)}MB`);
  }

  if (!NAME_PATTERN.test(originalName)) {
    errors.push('文件命名不规范，仅允许中英文、数字、下划线、短横线和空格，长度1-100字符');
  }

  return { valid: errors.length === 0, errors };
}

function sendNotification(userId, type, title, content, relatedId) {
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, type, title, content || '', relatedId || null);
}

function getDayJs(dateStr) {
  return dayjs(dateStr);
}

function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  return dayjs(date).format(format);
}

function generateCertificateNo() {
  return 'CERT-' + dayjs().format('YYYYMMDD') + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  ensureDir,
  validateFile,
  sendNotification,
  getDayJs,
  formatDate,
  generateCertificateNo,
  shuffleArray
};
