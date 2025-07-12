import { exec } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import ffmpeg from 'ffmpeg-static';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const inputPath = path.join(tmpdir(), `input_${Date.now()}.webm`);
    const outputPath = path.join(tmpdir(), `output_${Date.now()}.ogg`);

    await writeFile(inputPath, buffer);

    const cmd = `"${ffmpeg}" -i "${inputPath}" -c:a libopus -b:a 64k -ac 1 "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err) => (err ? reject(err) : resolve()));
    });

    const oggBuffer = await readFile(outputPath);

    // Cleanup
    await unlink(inputPath);
    await unlink(outputPath);

    res.setHeader('Content-Type', 'audio/ogg');
    res.send(oggBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Conversion failed', message: err.message });
  }
}
