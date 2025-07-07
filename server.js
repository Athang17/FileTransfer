const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.static('public'));

const uploadDir = __dirname;

// Multer storage with dynamic filename from `customName`
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    // We won't set filename here; we'll handle it manually below
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

    // Delete after 1 hour
    setTimeout(() => {
      fs.unlink(filePath, err => {
        if (err) console.error(`Error deleting file ${safeName}:`, err);
        else console.log(`Deleted file after 1 hour: ${safeName}`);
      });
    }, 3600000);

    const fileUrl = `${req.protocol}://${req.get('host')}/${encodeURIComponent(safeName)}`;
    res.json({ url: fileUrl });
  });
});


// Serve files and force download
app.get('/:filename', (req, res, next) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, safeName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found or expired');
    }

    res.download(filePath, safeName, (err) => {
      if (err) next(err);
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`File transfer app listening on http://localhost:${PORT}`);
});
