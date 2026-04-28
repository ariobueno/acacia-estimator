// api/landing-lead.js
// Accepts HTML form POSTs from landing pages, creates a Kommo contact + lead, redirects to thank-you

import { put, list } from '@vercel/blob';

export const config = { maxDuration: 30 };

const CLIENT_ID     = process.env.KOMMO_CLIENT_ID;
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET;
const SUBDOMAIN     = process.env.KOMMO_SUBDOMAIN;
const BLOB_TOKEN    = process.env.BLOB_READ_WRITE_TOKEN;

async function getValidToken() {
  const { blobs } = await list({ prefix: 'kommo/', token: BLOB_TOKEN });
  const tokenBlob = blobs.find(b => b.pathname === 'kommo/tokens.json');
  if (!tokenBlob) throw new Error('Kommo not connected.');

  const tokenFetch = await fetch(tokenBlob.url, { headers: { authorization: `Bearer ${BLOB_TOKEN}` } });
  if (!tokenFetch.ok) throw new Error('Could not load Kommo tokens.');
  const tokens = await tokenFetch.json();

  if (tokens.expires_at && Date.now() < tokens.expires_at - 300_000) {
    return tokens.access_token;
  }

  const refreshRes = await fetch(`https://${SUBDOMAIN}.kommo.com/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      redirect_uri: process.env.KOMMO_REDIRECT_URI || 'https://acacia-estimator.vercel.app/api/kommo-auth',
    }),
  });

  const newTokens = await refreshRes.json();
  if (!refreshRes.ok || newTokens.error) throw new Error('Token refresh failed.');

  const updated = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: Date.now() + (newTokens.expires_in * 1000),
    token_type: newTokens.token_type,
    saved_at: new Date().toISOString(),
  };

  await put('kommo/tokens.json', JSON.stringify(updated), {
    access: 'private',
    token: BLOB_TOKEN,
    contentType: 'application/json',
    allowOverwrite: true,
  });

  return updated.access_token;
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

  try {
    const accessToken = await getValidToken();
    const baseUrl = `https://${SUBDOMAIN}.kommo.com/api/v4`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Build contact fields
    const contactFields = [];
    if (phone) contactFields.push({ field_code: 'PHONE', values: [{ value: phone, enum_code: 'WORK' }] });
    if (email) contactFields.push({ field_code: 'EMAIL', values: [{ value: email, enum_code: 'WORK' }] });

    // Create contact
    const contactRes = await fetch(`${baseUrl}/contacts`, {
      method: 'POST', headers,
      body: JSON.stringify([{ name, custom_fields_values: contactFields }]),
    });
    const contactData = await contactRes.text().then(t => t ? JSON.parse(t) : {});
    const contactId = contactData?._embedded?.contacts?.[0]?.id;

    // Create lead
    const leadName = [name, projectType].filter(Boolean).join(' – ');
    const leadRes = await fetch(`${baseUrl}/leads`, {
      method: 'POST', headers,
      body: JSON.stringify([{
        name: leadName,
        _embedded: contactId ? { contacts: [{ id: contactId }] } : {},
      }]),
    });
    const leadData = await leadRes.text().then(t => t ? JSON.parse(t) : {});
    const leadId = leadData?._embedded?.leads?.[0]?.id;

    // Add note with all submitted details
    if (leadId) {
      const noteLines = [
        `🌐 Source: ${source}`,
        projectType ? `📋 Project: ${projectType}` : '',
        budget      ? `💰 Budget: ${budget}` : '',
        phone       ? `📞 Phone: ${phone}` : '',
        email       ? `📧 Email: ${email}` : '',
        details     ? `📝 Notes: ${details}` : '',
      ].filter(Boolean).join('\n');

      await fetch(`${baseUrl}/leads/${leadId}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify([{ note_type: 'common', params: { text: noteLines } }]),
      });
    }

    return res.redirect(302, nextUrl);
  } catch (err) {
    console.error('Landing lead error:', err);
    // Redirect anyway — don't leave user on an error page
    return res.redirect(302, nextUrl);
  }
}
