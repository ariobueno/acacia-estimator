// api/kommo.js
// Vercel serverless function — proxies requests to Kommo CRM API
// Kommo blocks direct browser requests (CORS), so we proxy through here

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const kommoApiKey  = process.env.KOMMO_API_KEY;
  const kommoSubdomain = process.env.KOMMO_SUBDOMAIN; // e.g. "andresacaciacabinetsnet"

  if (!kommoApiKey || !kommoSubdomain) {
    return res.status(500).json({ error: 'KOMMO_API_KEY or KOMMO_SUBDOMAIN not configured' });
  }

  const baseUrl = `https://${kommoSubdomain}.kommo.com/api/v4`;
  const headers = {
    'Authorization': `Bearer ${kommoApiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const { action, phone, clientName, address, proposalTotal, internalNotes, driveLink, fileName } = req.body;

    // ── 1. Search for existing lead by phone ──────────────────────────────────
    if (action === 'search') {
      const clean = (phone || '').replace(/\D/g, '');
      const r = await fetch(`${baseUrl}/contacts?query=${encodeURIComponent(clean)}&limit=5`, { headers });
      const data = await r.json();
      const contacts = data?._embedded?.contacts || [];

      // Find contact with matching phone
      const match = contacts.find(c => {
        const phones = (c.custom_fields_values || []).find(f => f.field_code === 'PHONE');
        return phones?.values?.some(v => v.value.replace(/\D/g, '').includes(clean));
      });

      if (match) {
        // Find leads linked to this contact
        const leadsR = await fetch(`${baseUrl}/contacts/${match.id}/links`, { headers });
        const leadsData = await leadsR.json();
        const linkedLeads = leadsData?._embedded?.links?.filter(l => l.to_entity_type === 'leads') || [];
        return res.status(200).json({ found: true, contact: match, linkedLeads });
      }
      return res.status(200).json({ found: false });
    }

    // ── 2. Create new lead with contact ──────────────────────────────────────
    if (action === 'create') {
      const clean = (phone || '').replace(/\D/g, '');

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
      const contactData = await contactRes.json();
      const contactId = contactData?._embedded?.contacts?.[0]?.id;

      // Create lead
      const leadRes = await fetch(`${baseUrl}/leads`, {
        method: 'POST', headers,
        body: JSON.stringify([{
          name: `${clientName || 'New Client'} – ${address || 'Estimate'}`,
          price: Math.round(proposalTotal || 0),
          custom_fields_values: internalNotes ? [{
            field_code: 'NOTE',
            values: [{ value: internalNotes }],
          }] : [],
          _embedded: contactId ? { contacts: [{ id: contactId }] } : {},
        }]),
      });
      const leadData = await leadRes.json();
      const leadId = leadData?._embedded?.leads?.[0]?.id;

      // Add note with Drive link if provided
      if (leadId && driveLink) {
        await fetch(`${baseUrl}/leads/${leadId}/notes`, {
          method: 'POST', headers,
          body: JSON.stringify([{
            note_type: 'common',
            params: { text: `📄 Estimate PDF: ${fileName || 'Estimate'}\n${driveLink}` },
          }]),
        });
      }

      return res.status(200).json({ success: true, leadId, contactId });
    }

    // ── 3. Attach note to existing lead ──────────────────────────────────────
    if (action === 'attach') {
      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: 'Missing leadId' });

      await fetch(`${baseUrl}/leads/${leadId}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify([{
          note_type: 'common',
          params: { text: `📄 Estimate PDF: ${fileName || 'Estimate'}\n${driveLink}\n\nProposal total: $${Math.round(proposalTotal || 0).toLocaleString()}\n${internalNotes || ''}` },
        }]),
      });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Kommo error:', err);
    return res.status(500).json({ error: err.message });
  }
}
