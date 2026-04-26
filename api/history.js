// api/history.js
// Manages estimate history JSON files in Google Drive under "Acacia Estimates/History"

import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = { maxDuration: 30 };

async function getDrive() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}

async function getOrCreateFolder(drive, name, parentId = null) {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
  const res = await drive.files.list({
    q, fields: 'files(id,name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'allDrives',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) },
    supportsAllDrives: true,
    fields: 'id',
  });
  return created.data.id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured' });

  try {
    const drive = await getDrive();
    const { action } = req.body;

    // Hardcoded "Acacia Estimates" folder ID shared with service account
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1FjOUqJRZvgo89u_stq_uuH4N1_cIxmYp';
    const historyFolderId = await getOrCreateFolder(drive, 'History', rootFolderId);

    // â”€â”€ List all estimates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'list') {
      const files = await drive.files.list({
        q: `'${historyFolderId}' in parents and mimeType='application/json' and trashed=false`,
        fields: 'files(id,name,modifiedTime,createdTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return res.status(200).json({ files: files.data.files || [] });
    }

    // â”€â”€ Save/update estimate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'save') {
      const { estimateId, fileName, data } = req.body;
      const json = JSON.stringify(data);
      const stream = Readable.from(Buffer.from(json));

      if (estimateId) {
        // Update existing file
        await drive.files.update({
          fileId: estimateId,
          media: { mimeType: 'application/json', body: stream },
          supportsAllDrives: true,
        });
        return res.status(200).json({ success: true, fileId: estimateId });
      } else {
        // Create new file
        const file = await drive.files.create({
          requestBody: { name: fileName, parents: [historyFolderId] },
          media: { mimeType: 'application/json', body: stream },
          supportsAllDrives: true,
          fields: 'id,name',
        });
        return res.status(200).json({ success: true, fileId: file.data.id, fileName: file.data.name });
      }
    }

    // â”€â”€ Load estimate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'load') {
      const { estimateId } = req.body;
      const file = await drive.files.get({ fileId: estimateId, alt: 'media', supportsAllDrives: true });
      return res.status(200).json({ success: true, data: file.data });
    }

    // â”€â”€ Delete estimate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (action === 'delete') {
      const { estimateId } = req.body;
      await drive.files.delete({ fileId: estimateId, supportsAllDrives: true });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: err.message });
  }
}
