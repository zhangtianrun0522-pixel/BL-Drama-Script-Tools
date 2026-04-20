'use strict';

const router = require('express').Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 PDF 和 DOCX 格式'));
    }
  },
});

// POST /api/upload/extract  (multipart, field: files)
router.post('/extract', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.json({ code: 400, message: '未收到文件' });
  }

  const results = [];
  for (const file of req.files) {
    try {
      let text = '';
      const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const data = await pdfParse(file.buffer);
        text = data.text;
      } else {
        const data = await mammoth.extractRawText({ buffer: file.buffer });
        text = data.value;
      }
      results.push({ name: file.originalname, text: text.trim() });
    } catch (e) {
      results.push({ name: file.originalname, text: '', error: e.message });
    }
  }

  res.json({ code: 0, data: results });
});

module.exports = router;
