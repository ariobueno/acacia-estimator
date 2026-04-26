// api/drive-upload.js
import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = { maxDuration: 30 };

const FOLDER_ID = '1FjOUqJRZvgo89u_stq_uuH4N1_cIxmYp';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName, pdfBase64, mimeType = 'application/pdf' } = req.body;
    if (!fileName || !pdfBase64) return res.status(400).json({ error: 'Missing fileName or pdfBase64' });

    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured' });
    const credentials = JSON.parse(saJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const buffer = Buffer.from(pdfBase64, 'base64');
    const stream = Readable.from(buffer);

    const file = await drive.files.create({
      requestBody: { name: fileName, parents: [FOLDER_ID] },
      media: { mimeType, body: stream },
      supportsAllDrives: true,
      fields: 'id,webViewLink,name',
    });

    try {
      await drive.permissions.create({
        fileId: file.data.id,
        supportsAllDrives: true,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch (e) { /* non-fatal */ }

    return res.status(200).json({
      success: true,
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
    });
  } catch (err) {
    console.error('Drive upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
