const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({ 
  dest: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    upload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Upload error: ' + err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const inputPath = req.file.path;
      const outputPath = `/tmp/output_${Date.now()}.ogg`;

      try {
        // Convert webm to ogg with opus codec
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .audioCodec('libopus')
            .audioBitrate('64k')
            .audioChannels(1)
            .format('ogg')
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath);
        });

        // Read converted file and return as base64
        const convertedBuffer = fs.readFileSync(outputPath);
        const base64Audio = convertedBuffer.toString('base64');

        // Cleanup files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        res.json({
          success: true,
          audioData: base64Audio,
          mimeType: 'audio/ogg; codecs=opus',
          size: convertedBuffer.length
        });

      } catch (conversionError) {
        // Cleanup input file
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        
        res.status(500).json({ 
          error: 'Conversion failed', 
          details: conversionError.message 
        });
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
