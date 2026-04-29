// api/kommo.js
// Vercel serverless function — proxies requests to Kommo CRM API
// Uses OAuth tokens stored in Vercel Blob, auto-refreshes when expired

import { put, list } from '@vercel/blob';

export const config = { maxDuration: 30 };

const CLIENT_ID     = process.env.KOMMO_CLIENT_ID;
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET;
const SUBDOMAIN     = process.env.KOMMO_SUBDOMAIN;
const BLOB_TOKEN    = process.env.BLOB_READ_WRITE_TOKEN;

// ── Load + auto-refresh tokens ───────────────────────────────────────────────
async function getValidToken() {
  // Find tokens file in Blob storage
  const { blobs } = await list({ prefix: 'kommo/', token: BLOB_TOKEN });
  const tokenBlob = blobs.find(b => b.pathname === 'kommo/tokens.json');
  if (!tokenBlob) throw new Error('Kommo not connected. Visit /api/kommo-auth to authorize.');

  // Fetch stored tokens
  const tokenFetch = await fetch(tokenBlob.url, { headers: { authorization: `Bearer ${BLOB_TOKEN}` } });
  if (!tokenFetch.ok) throw new Error('Could not load Kommo tokens. Re-authorize at /api/kommo-auth');
  const tokens = await tokenFetch.json();

  // If token still valid (with 5 min buffer), return it
  if (tokens.expires_at && Date.now() < tokens.expires_at - 300_000) {
    return tokens.access_token;
  }

  // Token expired — refresh it
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
  if (!refreshRes.ok || newTokens.error) {
    throw new Error('Token refresh failed. Re-authorize at /api/kommo-auth');
  }

  const updated = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: Date.now() + (newTokens.expires_in * 1000),
    token_type: newTokens.token_type,
    saved_at: new Date().toISOString(),
  };

  // Save updated tokens back to Blob
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUBDOMAIN) {
    return res.status(500).json({ error: 'KOMMO_SUBDOMAIN not configured' });
  }

  try {
    const accessToken = await getValidToken();
    const baseUrl = `https://${SUBDOMAIN}.kommo.com/api/v4`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const { action, phone, clientName, address, proposalTotal, internalNotes, fileName } = req.body;

    // ── 1. Search for existing contact by phone ───────────────────────────────
    if (action === 'search') {
      const clean = (phone || '').replace(/\D/g, '');
      const r = await fetch(`${baseUrl}/contacts?query=${encodeURIComponent(clean)}&limit=5`, { headers });
      const text = await r.text();
      const data = text ? JSON.parse(text) : {};
      const contacts = data?._embedded?.contacts || [];

      const match = contacts.find(c => {
        const phones = (c.custom_fields_values || []).find(f => f.field_code === 'PHONE');
        return phones?.values?.some(v => v.value.replace(/\D/g, '').includes(clean));
      });

      if (match) {
        const leadsR = await fetch(`${baseUrl}/contacts/${match.id}/links`, { headers });
        const leadsText = await leadsR.text();
        const leadsData = leadsText ? JSON.parse(leadsText) : {};
        const linkedLeads = leadsData?._embedded?.links?.filter(l => l.to_entity_type === 'leads') || [];
        return res.status(200).json({ found: true, contact: match, linkedLeads });
      }
      return res.status(200).json({ found: false });
    }

    // ── 2. Create new contact + lead ──────────────────────────────────────────
    if (action === 'create') {
      // Create contact
      const contactRes = await fetch(`${baseUrl}/contacts`, {
        method: 'POST', headers,
        body: JSON.stringify([{
          name: clientName || 'New Client',
          custom_fields_values: [
            { field_code: 'PHONE', values: [{ value: phone, enum_code: 'WORK' }] },
          ],
        }]),
      });
      const contactText = await contactRes.text();
      const contactData = contactText ? JSON.parse(contactText) : {};
      const contactId = contactData?._embedded?.contacts?.[0]?.id;
      if (!contactId) console.error('Kommo contact creation failed:', contactRes.status, contactText?.slice(0, 300));

      // Create lead
      const leadRes = await fetch(`${baseUrl}/leads`, {
        method: 'POST', headers,
        body: JSON.stringify([{
          name: `${clientName || 'New Client'} – ${address || 'Estimate'}`,
          price: Math.round(proposalTotal || 0),
          _embedded: contactId ? { contacts: [{ id: contactId }] } : {},
        }]),
      });
      const leadText = await leadRes.text();
      const leadData = leadText ? JSON.parse(leadText) : {};
      const leadId = leadData?._embedded?.leads?.[0]?.id;
      if (!leadId) console.error('Kommo lead creation failed:', leadRes.status, leadText?.slice(0, 300));

      // Add note with estimate summary
      if (leadId) {
        const noteText = [
          `📋 Estimate: ${fileName || 'Acacia Estimate'}`,
          `📍 Address: ${address || '—'}`,
          `💰 Proposal Total: $${Math.round(proposalTotal || 0).toLocaleString()}`,
          internalNotes ? `📝 Notes: ${internalNotes}` : '',
        ].filter(Boolean).join('\n');

        await fetch(`${baseUrl}/leads/${leadId}/notes`, {
          method: 'POST', headers,
          body: JSON.stringify([{ note_type: 'common', params: { text: noteText } }]),
        });
      }

      const { debug } = req.body;
      if (debug) return res.status(200).json({ success: true, leadId, contactId, contactRaw: contactData, leadRaw: leadData });
      return res.status(200).json({ success: true, leadId, contactId });
    }

    // ── 3. Attach note to existing lead ───────────────────────────────────────
    if (action === 'attach') {
      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: 'Missing leadId' });

      const noteText = [
        `📋 Estimate: ${fileName || 'Acacia Estimate'}`,
        `📍 Address: ${address || '—'}`,
        `💰 Proposal Total: $${Math.round(proposalTotal || 0).toLocaleString()}`,
        internalNotes ? `📝 Notes: ${internalNotes}` : '',
      ].filter(Boolean).join('\n');

      await fetch(`${baseUrl}/leads/${leadId}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify([{ note_type: 'common', params: { text: noteText } }]),
      });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Kommo error:', err);
    return res.status(500).json({ error: err.message });
  }
}
