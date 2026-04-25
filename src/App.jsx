import { useState } from 'react'
import Estimator from './Estimator.jsx'

const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || ''
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || ''

const S = {
  gate: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f7f5f0',
    fontFamily: "'Georgia', serif",
  },
  card: {
    background: '#fff',
    border: '1px solid #e8e2d8',
    borderRadius: 12,
    padding: '40px 44px',
    width: 360,
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    textAlign: 'center',
  },
  logo: {
    width: 44, height: 44,
    background: '#c8a84b',
    borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 22, color: '#1a1714',
    margin: '0 auto 18px',
  },
  title: { fontSize: 16, fontWeight: 700, color: '#1a1714', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 },
  sub: { fontSize: 12, color: '#9a8a70', marginBottom: 28, letterSpacing: '0.06em' },
  input: {
    width: '100%',
    border: '1px solid #ddd8cc',
    borderRadius: 6,
    padding: '10px 13px',
    fontSize: 14,
    fontFamily: "'Georgia', serif",
    color: '#1a1714',
    background: '#fdfcfa',
    outline: 'none',
    marginBottom: 12,
  },
  btn: {
    width: '100%',
    background: '#c8a84b',
    color: '#1a1714',
    border: 'none',
    borderRadius: 6,
    padding: '11px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'Georgia', serif",
  },
  err: { fontSize: 11, color: '#c05040', marginTop: 8 },
}

function PasswordGate({ onPass }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  const attempt = () => {
    if (!SITE_PASSWORD || pw === SITE_PASSWORD) {
      onPass()
    } else {
      setErr(true)
      setPw('')
    }
  }

  return (
    <div style={S.gate}>
      <div style={S.card}>
        <div style={S.logo}>A</div>
        <div style={S.title}>Acacia Cabinets</div>
        <div style={S.sub}>ESTIMATING TOOL · INTERNAL</div>
        <input
          style={S.input}
          type="password"
          placeholder="Enter password"
          value={pw}
          onChange={e => { setPw(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          autoFocus
        />
        <button style={S.btn} onClick={attempt}>Enter</button>
        {err && <div style={S.err}>Incorrect password</div>}
      </div>
    </div>
  )
}

export default function App() {
  const needsPassword = !!SITE_PASSWORD
  const [authed, setAuthed] = useState(!needsPassword)

  if (!authed) return <PasswordGate onPass={() => setAuthed(true)} />

  // Pass the env API key into the Estimator so the team doesn't need to enter it
  return <Estimator injectedAnthropicKey={ANTHROPIC_KEY} />
}
