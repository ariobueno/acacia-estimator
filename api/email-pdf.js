// api/email-pdf.js
// Emails the estimate PDF to andres@acaciacabinets.net using Resend

export const config = { maxDuration: 30 };

const TO_EMAIL = 'andres@acaciacabinets.net';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  try {
    const { fileName, pdfBase64, clientName, address, proposalTotal } = req.body;
    if (!fileName || !pdfBase64) return res.status(400).json({ error: 'Missing fileName or pdfBase64' });

    const subject = `Estimate: ${clientName || 'New Client'}${address ? ' — ' + address : ''} — $${Math.round(proposalTotal || 0).toLocaleString()}`;

    const body = {
      from: 'Acacia Estimator <estimator@acaciacabinets.net>',
      to: [TO_EMAIL],
      subject,
      html: `
        <p>New estimate generated from the Acacia Estimator.</p>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Client</td><td style="padding:4px 0;font-weight:600;">${clientName || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Address</td><td style="padding:4px 0;">${address || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#888;">Proposal Total</td><td style="padding:4px 0;font-weight:600;color:#c8a84b;">$${Math.round(proposalTotal || 0).toLocaleString()}</td></tr>
        </table>
        <p style="margin-top:16px;color:#888;font-size:12px;">PDF attached. Set up your Zapier to move it to Google Drive automatically.</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    };

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Resend API error');

    return res.status(200).json({ success: true, emailId: data.id });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
