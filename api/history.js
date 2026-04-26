// api/history.js
// Manages estimate history using Vercel Blob storage

import { put, list, del, head } from '@vercel/blob';

export const config = { maxDuration: 30 };

const PREFIX = 'estimates/';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });
  }

  try {
    const { action } = req.body;

    // ── List all saved estimates ────────────────────────────────────────────
    if (action === 'list') {
      const { blobs } = await list({ prefix: PREFIX, token: process.env.BLOB_READ_WRITE_TOKEN });
      const files = blobs.map(b => ({
        id: b.url,
        name: b.pathname.replace(PREFIX, '').replace('.json', ''),
        modifiedTime: b.uploadedAt,
        createdTime: b.uploadedAt,
        size: b.size,
      }));
      return res.status(200).json({ files });
    }

    // ── Save / update estimate ──────────────────────────────────────────────
    if (action === 'save') {
      const { estimateId, fileName, data } = req.body;
      const json = JSON.stringify(data);

      // If estimateId is a blob URL, delete old version first then re-upload
      if (estimateId) {
        try { await del(estimateId, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (e) { /* ok if missing */ }
      }

      const safeName = (fileName || `estimate-${Date.now()}`).replace(/[^a-zA-Z0-9_\-\s]/g, '_');
      const blob = await put(`${PREFIX}${safeName}.json`, json, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: 'application/json',
      });

      return res.status(200).json({ success: true, fileId: blob.url, fileName: safeName });
    }

    // ── Load estimate ───────────────────────────────────────────────────────
    if (action === 'load') {
      const { estimateId } = req.body; // estimateId is the blob URL
      const r = await fetch(estimateId);
      if (!r.ok) throw new Error('Failed to fetch estimate from blob storage');
      const data = await r.json();
      return res.status(200).json({ success: true, data });
    }

    // ── Delete estimate ─────────────────────────────────────────────────────
    if (action === 'delete') {
      const { estimateId } = req.body;
      await del(estimateId, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: err.message });
  }
}
