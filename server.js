const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Store files directly in project root
const uploadDir = __dirname;

// Configure multer storage to keep original filename
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep original name exactly
  }
});
const upload = multer({ storage });

app.use(express.static('public')); // serve frontend files

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // URL to access the file directly from root
  const fileUrl = `${req.protocol}://${req.get('host')}/${encodeURIComponent(req.file.originalname)}`;
  res.json({ url: fileUrl });
});

// Serve uploaded files from root and force download
app.get('/:filename', (req, res, next) => {
  const filePath = path.join(uploadDir, req.params.filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found');
    }

    // Set headers to force download
    res.download(filePath, req.params.filename, (err) => {
      if (err) {
        next(err);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`File transfer app listening on http://localhost:${PORT}`);
});
