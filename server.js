const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.static('public'));

const uploadDir = __dirname;

// Map to store custom base name -> original filename (in-memory)
const originalNames = {};

// Multer storage with dynamic filename from `customName`
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // We won't set filename here; handled manually below
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const customBase = req.body.customName;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!customBase) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Custom filename required' });
  }

  const originalExt = path.extname(file.originalname);
  const safeName = path.basename(customBase) + originalExt;
  const filePath = path.join(uploadDir, safeName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'File with this name already exists' });
  }

  fs.rename(file.path, filePath, (err) => {
    if (err) return res.status(500).json({ error: 'File saving failed' });

    // Store original filename for download
    originalNames[path.parse(safeName).name] = file.originalname;

    // Delete after 1 hour
    setTimeout(() => {
      fs.unlink(filePath, err => {
        if (err) console.error(`Error deleting file ${safeName}:`, err);
        else {
          console.log(`Deleted file after 1 hour: ${safeName}`);
          // Remove mapping when file is deleted
          delete originalNames[path.parse(safeName).name];
        }
      });
    }, 3600000);

    const fileUrl = `${req.protocol}://${req.get('host')}/${encodeURIComponent(path.parse(safeName).name)}`;
    res.json({ url: fileUrl });
  });
});

app.get('/:filename', (req, res, next) => {
  const baseName = path.basename(req.params.filename);

  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).send('Server error');

    const matchedFile = files.find(file => path.parse(file).name === baseName);

    if (!matchedFile) return res.status(404).send('File not found or expired');

    const filePath = path.join(uploadDir, matchedFile);
    const downloadName = originalNames[baseName] || matchedFile;

    res.download(filePath, downloadName, err => {
      if (err) next(err);
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`File transfer app listening on http://localhost:${PORT}`);
});
