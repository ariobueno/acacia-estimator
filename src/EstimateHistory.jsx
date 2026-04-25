// src/EstimateHistory.jsx
import { useState, useEffect } from 'react';

const S = {
  sidebar: (open) => ({
    position: 'fixed', top: 0, right: 0, height: '100vh', width: open ? 360 : 0,
    background: '#fff', borderLeft: '1px solid #e8e2d8', boxShadow: open ? '-4px 0 20px rgba(0,0,0,0.08)' : 'none',
    transition: 'width 0.25s ease', overflow: 'hidden', zIndex: 1000,
    display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif',
  }),
  toggle: (open) => ({
    position: 'fixed', top: 80, right: open ? 360 : 0, zIndex: 1001,
    background: '#1a1714', color: '#c8a84b', border: 'none', borderRadius: '6px 0 0 6px',
    padding: '10px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.08em', writingMode: 'vertical-rl', textOrientation: 'mixed',
    transition: 'right 0.25s ease', fontFamily: 'Georgia, serif',
  }),
  header: {
    background: '#1a1714', padding: '16px 18px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexShrink: 0,
  },
  headerTitle: { color: '#c8a84b', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' },
  body: { flex: 1, overflowY: 'auto', padding: '14px' },
  estimateCard: (active) => ({
    border: `1px solid ${active ? '#c8a84b' : '#e8e2d8'}`,
    borderRadius: 8, marginBottom: 10, overflow: 'hidden',
    background: active ? '#fffdf7' : '#fdfcfa',
  }),
  cardHeader: { padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  cardName: { fontSize: 12, fontWeight: 700, color: '#1a1714' },
  cardMeta: { fontSize: 10, color: '#9a8a70', marginTop: 2 },
  revList: { borderTop: '1px solid #f0ebe0', padding: '8px 13px' },
  revItem: (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 8px', borderRadius: 5, marginBottom: 4, cursor: 'pointer',
    background: active ? '#f7f3ea' : 'transparent',
    border: `1px solid ${active ? '#c8a84b44' : 'transparent'}`,
  }),
  revLabel: { fontSize: 11, color: '#1a1714', fontWeight: 600 },
  revDate: { fontSize: 10, color: '#9a8a70' },
  btn: (color) => ({
    background: color || '#1a1714', color: color ? '#1a1714' : '#c8a84b',
    border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 10,
    fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
    cursor: 'pointer', fontFamily: 'Georgia, serif',
  }),
  btnGhost: {
    background: 'transparent', color: '#9a8a70', border: '1px solid #e8e2d8',
    borderRadius: 5, padding: '4px 9px', fontSize: 10, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'Georgia, serif',
  },
  empty: { textAlign: 'center', padding: '40px 20px', color: '#9a8a70', fontSize: 12, lineHeight: 1.6 },
  badge: { background: '#c8a84b22', border: '1px solid #c8a84b44', borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 700, color: '#8a6a20', letterSpacing: '0.08em' },
  statusBar: (type) => ({
    padding: '8px 14px', fontSize: 10, borderTop: '1px solid #f0ebe0', flexShrink: 0,
    background: type === 'saving' ? '#fffdf0' : type === 'saved' ? '#f0faf4' : type === 'error' ? '#fff0ee' : 'transparent',
    color: type === 'saving' ? '#8a6a20' : type === 'saved' ? '#2a7a4a' : type === 'error' ? '#a04030' : '#9a8a70',
  }),
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseFileName(name) {
  // Format: Acacia_ClientName_YYYY-MM-DD_RevN.json
  const parts = name.replace('.json', '').split('_');
  const revPart = parts.find(p => p.startsWith('Rev'));
  const rev = revPart ? parseInt(revPart.replace('Rev', '')) : 1;
  return { rev };
}

// Group files by base name (without _RevN)
function groupIntoEstimates(files) {
  const groups = {};
  files.forEach(f => {
    const base = f.name.replace(/_Rev\d+\.json$/, '').replace(/\.json$/, '');
    if (!groups[base]) groups[base] = { base, revisions: [] };
    const { rev } = parseFileName(f.name);
    groups[base].revisions.push({ ...f, rev });
  });
  // Sort revisions desc within each group
  Object.values(groups).forEach(g => g.revisions.sort((a, b) => b.rev - a.rev));
  return Object.values(groups).sort((a, b) =>
    new Date(b.revisions[0].modifiedTime) - new Date(a.revisions[0].modifiedTime)
  );
}

export default function EstimateHistory({ currentJob, onLoad, activeEstimateId, setActiveEstimateId }) {
  const [open, setOpen] = useState(false);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [expanded, setExpanded] = useState({});
  const [activeRevId, setActiveRevId] = useState(null);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEstimates(groupIntoEstimates(data.files || []));
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    }
    setLoading(false);
  };

  const handleLoad = async (fileId, fileName) => {
    setStatus({ type: 'saving', msg: 'Loading estimate…' });
    try {
      const res = await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', estimateId: fileId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onLoad(data.data);
      setActiveEstimateId(fileId);
      setActiveRevId(fileId);
      setStatus({ type: 'saved', msg: `Loaded: ${fileName}` });
      setOpen(false);
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const handleDelete = async (fileId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this revision?')) return;
    try {
      await fetch('/api/history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', estimateId: fileId }),
      });
      fetchHistory();
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    }
  };

  const grouped = estimates;

  return (
    <>
      <button style={S.toggle(open)} onClick={() => setOpen(o => !o)}>
        {open ? '✕ Close' : 'History'}
      </button>

      <div style={S.sidebar(open)}>
        <div style={S.header}>
          <div style={S.headerTitle}>📁 Estimate History</div>
          <button onClick={fetchHistory} style={{ background: 'none', border: 'none', color: '#6a5a30', cursor: 'pointer', fontSize: 14 }}>↻</button>
        </div>

        <div style={S.body}>
          {loading && <div style={S.empty}>Loading…</div>}
          {!loading && grouped.length === 0 && (
            <div style={S.empty}>No saved estimates yet.<br />Generate an estimate and it will appear here automatically.</div>
          )}
          {!loading && grouped.map(group => {
            const isExpanded = expanded[group.base];
            const latest = group.revisions[0];
            const isActive = group.revisions.some(r => r.id === activeRevId);

            return (
              <div key={group.base} style={S.estimateCard(isActive)}>
                <div style={S.cardHeader} onClick={() => setExpanded(e => ({ ...e, [group.base]: !e[group.base] }))}>
                  <div>
                    <div style={S.cardName}>
                      {group.base.replace('Acacia_', '').replace(/_\d{4}-\d{2}-\d{2}$/, '').replace(/_/g, ' ')}
                      {isActive && <span style={{ ...S.badge, marginLeft: 6 }}>Active</span>}
                    </div>
                    <div style={S.cardMeta}>
                      {group.revisions.length} revision{group.revisions.length !== 1 ? 's' : ''} · last updated {timeAgo(latest.modifiedTime)}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#9a8a70' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                  <div style={S.revList}>
                    {group.revisions.map(rev => (
                      <div key={rev.id} style={S.revItem(rev.id === activeRevId)} onClick={() => handleLoad(rev.id, rev.name)}>
                        <div>
                          <div style={S.revLabel}>Rev {rev.rev} {rev.rev === group.revisions.length ? <span style={S.badge}>Latest</span> : ''}</div>
                          <div style={S.revDate}>{timeAgo(rev.modifiedTime)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={S.btn('#c8a84b')} onClick={e => { e.stopPropagation(); handleLoad(rev.id, rev.name); }}>Load</button>
                          <button style={S.btnGhost} onClick={e => handleDelete(rev.id, e)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {status.msg && (
          <div style={S.statusBar(status.type)}>{status.msg}</div>
        )}
      </div>
    </>
  );
}
