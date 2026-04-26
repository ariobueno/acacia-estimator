// src/IntegrationsPanel.jsx
import { useState } from 'react';
import { generateEstimatePdf } from './generatePdf.js';

const S = {
  panel: { background: '#fff', border: '1px solid #e8e2d8', borderRadius: 10, padding: '24px 28px', marginTop: 20 },
  title: { fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6a5a40', marginBottom: 18 },
  grid: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  card: (active) => ({ flex: '1 1 200px', background: active ? '#fffdf7' : '#fdfcfa', border: `1px solid ${active ? '#c8a84b88' : '#e8e2d8'}`, borderRadius: 8, padding: '16px 18px' }),
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 3 },
  cardSub: { fontSize: 10, color: '#9a8a70', marginBottom: 12, lineHeight: 1.5 },
  btn: (color) => ({ background: color || '#1a1714', color: color ? '#1a1714' : '#c8a84b', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Georgia,serif', width: '100%' }),
  btnDisabled: { background: '#f0ebe0', color: '#b0a080', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'not-allowed', fontFamily: 'Georgia,serif', width: '100%' },
  status: (type) => ({ fontSize: 10, marginTop: 8, padding: '6px 10px', borderRadius: 5, background: type === 'success' ? '#f0faf4' : type === 'error' ? '#fff0ee' : '#f7f5f0', color: type === 'success' ? '#2a7a4a' : type === 'error' ? '#a04030' : '#6a5a40', lineHeight: 1.5 }),
  input: { width: '100%', border: '1px solid #ddd8cc', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'Georgia,serif', color: '#1a1714', background: '#fdfcfa', outline: 'none', marginBottom: 8, boxSizing: 'border-box' },
  label: { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7a60', marginBottom: 4, display: 'block' },
};

export default function IntegrationsPanel({ job, clientOut, internalOut, renders, proposalTotal }) {
  const [pdfState, setPdfState]     = useState({ loading: false, done: false, error: null, base64: null, fileName: null });
  const [emailState, setEmailState] = useState({ loading: false, done: false, error: null });
  const [kommoState, setKommoState] = useState({ loading: false, done: false, error: null, found: null, leadId: null });
  const [phone, setPhone]           = useState('');
  const [kommoStep, setKommoStep]   = useState('idle'); // idle | searched | confirm

  // ── 1. Generate PDF ────────────────────────────────────────────────────────
  const handleGeneratePdf = async () => {
    setPdfState({ loading: true, done: false, error: null, base64: null, fileName: null });
    try {
      const { pdfBase64, fileName } = await generateEstimatePdf(job, clientOut, internalOut, renders);
      setPdfState({ loading: false, done: true, error: null, base64: pdfBase64, fileName });
    } catch (e) {
      setPdfState({ loading: false, done: false, error: e.message, base64: null, fileName: null });
    }
  };

  // Download locally
  const handleDownload = () => {
    if (!pdfState.base64) return;
    const link = document.createElement('a');
    link.href = 'data:application/pdf;base64,' + pdfState.base64;
    link.download = pdfState.fileName;
    link.click();
  };

  // ── 2. Email PDF ──────────────────────────────────────────────────────────
  const handleEmailPdf = async () => {
    if (!pdfState.base64) return;
    setEmailState({ loading: true, done: false, error: null });
    try {
      const res = await fetch('/api/email-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pdfState.fileName,
          pdfBase64: pdfState.base64,
          clientName: job.clientName,
          address: job.address,
          proposalTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Email failed');
      setEmailState({ loading: false, done: true, error: null });
    } catch (e) {
      setEmailState({ loading: false, done: false, error: e.message });
    }
  };

  // ── 3. Kommo — search by phone ────────────────────────────────────────────
  const handleKommoSearch = async () => {
    if (!phone.trim()) return;
    setKommoState({ loading: true, done: false, error: null, found: null, leadId: null });
    setKommoStep('idle');
    try {
      const res = await fetch('/api/kommo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', phone }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Search failed');
      setKommoState({ loading: false, done: false, error: null, found: data.found, contact: data.contact, linkedLeads: data.linkedLeads });
      setKommoStep('searched');
    } catch (e) {
      setKommoState({ loading: false, done: false, error: e.message, found: null, leadId: null });
    }
  };

  // ── 4. Kommo — attach to existing or create new ───────────────────────────
  const handleKommoPush = async (mode) => {
    setKommoState(s => ({ ...s, loading: true, error: null }));
    const driveLink = '';
    const payload = {
      phone,
      clientName: job.clientName,
      address: job.address,
      proposalTotal,
      internalNotes: job.internalNotes,
      driveLink,
      fileName: pdfState.fileName,
    };

    try {
      if (mode === 'attach') {
        const leadId = kommoState.linkedLeads?.[0]?.to_entity_id;
        const res = await fetch('/api/kommo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'attach', leadId, ...payload }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error);
        setKommoState(s => ({ ...s, loading: false, done: true }));
      } else {
        const res = await fetch('/api/kommo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', ...payload }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error);
        setKommoState(s => ({ ...s, loading: false, done: true, leadId: data.leadId }));
      }
      setKommoStep('done');
    } catch (e) {
      setKommoState(s => ({ ...s, loading: false, error: e.message }));
    }
  };

  const pdfReady = pdfState.done && pdfState.base64;

  return (
    <div style={S.panel}>
      <div style={S.title}>📤 Export &amp; Integrations</div>
      <div style={S.grid}>

        {/* ── PDF ── */}
        <div style={S.card(pdfReady)}>
          <div style={S.cardTitle}>📄 PDF Export</div>
          <div style={S.cardSub}>Both outputs + all photos + AI renders in one branded PDF.</div>
          {!pdfReady ? (
            <button style={pdfState.loading ? S.btnDisabled : S.btn('#c8a84b')} onClick={handleGeneratePdf} disabled={pdfState.loading}>
              {pdfState.loading ? 'Generating…' : 'Generate PDF'}
            </button>
          ) : (
            <button style={S.btn('#c8a84b')} onClick={handleDownload}>⬇ Download PDF</button>
          )}
          {pdfState.error && <div style={S.status('error')}>{pdfState.error}</div>}
          {pdfReady && <div style={S.status('success')}>✓ PDF ready — {pdfState.fileName}</div>}
        </div>

        {/* ── Email PDF ── */}
        <div style={S.card(emailState.done)}>
          <div style={S.cardTitle}>📧 Email PDF</div>
          <div style={S.cardSub}>Sends PDF to andres@acaciacabinets.net. Generate PDF first.</div>
          <button
            style={!pdfReady || emailState.loading || emailState.done ? S.btnDisabled : S.btn('#c8a84b')}
            onClick={handleEmailPdf}
            disabled={!pdfReady || emailState.loading || emailState.done}
          >
            {emailState.loading ? 'Sending…' : emailState.done ? '✓ Sent' : 'Send to Email'}
          </button>
          {emailState.error && <div style={S.status('error')}>{emailState.error}</div>}
          {emailState.done && <div style={S.status('success')}>✓ PDF sent to andres@acaciacabinets.net</div>}
        </div>

        {/* ── Kommo ── */}
        <div style={S.card(kommoState.done)}>
          <div style={S.cardTitle}>🔗 Kommo CRM</div>
          <div style={S.cardSub}>Search by phone. Attach to existing lead or create new. Drive link auto-attached as note.</div>

          {kommoStep === 'idle' && (
            <>
              <label style={S.label}>Client Phone</label>
              <input style={S.input} placeholder="+1 (305) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleKommoSearch()} />
              <button style={!phone.trim() || kommoState.loading ? S.btnDisabled : S.btn('#c8a84b')} onClick={handleKommoSearch} disabled={!phone.trim() || kommoState.loading}>
                {kommoState.loading ? 'Searching…' : 'Search Kommo'}
              </button>
            </>
          )}

          {kommoStep === 'searched' && !kommoState.done && (
            <>
              {kommoState.found ? (
                <div>
                  <div style={S.status('success')}>
                    ✓ Found: <strong>{kommoState.contact?.name}</strong>
                    {kommoState.linkedLeads?.length > 0 && ` · ${kommoState.linkedLeads.length} linked lead(s)`}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {kommoState.linkedLeads?.length > 0 && (
                      <button style={{ ...S.btn('#c8a84b'), flex: 1 }} onClick={() => handleKommoPush('attach')}>
                        {kommoState.loading ? 'Attaching…' : 'Attach to Lead'}
                      </button>
                    )}
                    <button style={{ ...S.btn(), flex: 1 }} onClick={() => handleKommoPush('create')}>
                      {kommoState.loading ? 'Creating…' : 'New Lead'}
                    </button>
                  </div>
                  <button style={{ ...S.btnDisabled, marginTop: 6, cursor: 'pointer', background: 'transparent', color: '#9a8a70' }} onClick={() => { setKommoStep('idle'); setPhone(''); }}>
                    Search again
                  </button>
                </div>
              ) : (
                <div>
                  <div style={S.status('error')}>No contact found for {phone}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button style={{ ...S.btn('#c8a84b'), flex: 1 }} onClick={() => handleKommoPush('create')}>
                      {kommoState.loading ? 'Creating…' : 'Create New Lead'}
                    </button>
                    <button style={{ ...S.btnDisabled, flex: 1, cursor: 'pointer', background: 'transparent', color: '#9a8a70' }} onClick={() => { setKommoStep('idle'); setPhone(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {kommoStep === 'done' && (
            <div style={S.status('success')}>
              ✓ {kommoState.leadId ? `New lead created (#${kommoState.leadId})` : 'Estimate attached to existing lead'}
            </div>
          )}

          {kommoState.error && <div style={S.status('error')}>{kommoState.error}</div>}
        </div>

      </div>
    </div>
  );
}
