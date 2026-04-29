// api/landing-lead.js
// Accepts HTML form POSTs from landing pages, creates a Kommo contact + lead, redirects to thank-you
// Delegates Kommo API calls to /api/kommo to share token management

export const config = { maxDuration: 30 };

const BASE_URL = 'https://acacia-estimator.vercel.app';

async function kommo(action, payload) {
  const res = await fetch(`${BASE_URL}/api/kommo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const body        = req.body || {};
  const name        = body.name || 'New Lead';
  const phone       = body.phone || '';
  const email       = body.email || '';
  const projectType = body.project_type || '';
  const budget      = body.budget || '';
  const details     = body.details || '';
  const nextUrl     = body._next || 'https://acacia-estimator.vercel.app';
  const source      = req.headers.referer || body._source || 'Landing Page';
  const debug       = req.query?.debug === '1';

  try {
    const noteLines = [
      `🌐 Source: ${source}`,
      projectType ? `📋 Project: ${projectType}` : '',
      budget      ? `💰 Budget: ${budget}` : '',
      email       ? `📧 Email: ${email}` : '',
      details     ? `📝 Notes: ${details}` : '',
    ].filter(Boolean).join('\n');

    const data = await kommo('create', {
      phone,
      clientName: name,
      address: projectType || 'Landing Page Lead',
      proposalTotal: 0,
      internalNotes: noteLines,
      fileName: source,
    });

    if (data.error) throw new Error(data.error);
    if (debug) return res.status(200).json({ success: true, data });

    return res.redirect(302, nextUrl);
  } catch (err) {
    console.error('Landing lead error:', err);
    if (debug) return res.status(500).json({ error: err.message, body });
    return res.redirect(302, nextUrl);
  }
}
