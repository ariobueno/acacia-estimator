// api/drive-upload.js
// Vercel serverless function — proxies PDF upload to Google Drive
// Uses a service account key stored in GOOGLE_SERVICE_ACCOUNT_JSON env var

import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName, pdfBase64, mimeType = 'application/pdf' } = req.body;
    if (!fileName || !pdfBase64) return res.status(400).json({ error: 'Missing fileName or pdfBase64' });

    // Parse service account credentials
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured' });
    const credentials = JSON.parse(saJson);

    // Authenticate
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Find or create "Acacia Estimates" folder
    const folderName = process.env.GOOGLE_DRIVE_FOLDER || 'Acacia Estimates';
    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

    if (!folderId) {
      const folderSearch = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)',
      });
      if (folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id;
      } else {
        const folderCreate = await drive.files.create({
          resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
          fields: 'id',
        });
        folderId = folderCreate.data.id;
      }
    }

    // Upload PDF
    const buffer = Buffer.from(pdfBase64, 'base64');
    const stream = Readable.from(buffer);

    const file = await drive.files.create({
      resource: { name: fileName, parents: [folderId] },
      media: { mimeType, body: stream },
      fields: 'id,webViewLink,name',
    });

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
