import { useState, useEffect } from 'react'

// ── Complaint categories ────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'not_received',
    label: '💸 Relief Not Received',
    desc: 'System shows payment sent but money never arrived in my account',
    subcategories: ['Payment shows sent but not credited', 'Bank account not linked', 'Wrong bank account used', 'Payment returned/bounced']
  },
  {
    id: 'wrong_amount',
    label: '⚖️ Wrong Amount Received',
    desc: 'I received less relief than my vulnerability score entitles me to',
    subcategories: ['Got less than shown in portal', 'Partial payment only', 'Deduction without reason']
  },
  {
    id: 'wrong_data',
    label: '📋 Incorrect Profile Data',
    desc: 'My personal details, income group, or vulnerability factors are wrong',
    subcategories: ['Wrong income category assigned', 'Wrong number of dependents', 'Wrong livelihood/occupation', 'Wrong district or location', 'Insurance or savings data incorrect']
  },
  {
    id: 'fraud',
    label: '🚨 Fraud / Impersonation',
    desc: 'Someone filed a claim or received relief using my identity without my knowledge',
    subcategories: ['Someone used my Aadhaar without consent', 'Duplicate claim filed on my behalf', 'Relief redirected to unknown account', 'Identity theft suspected']
  },
  {
    id: 'corruption',
    label: '🏛️ Corruption / Bribery',
    desc: 'An official or middleman demanded money or favours for processing my relief',
    subcategories: ['Official demanded bribe', 'Middleman charging commission', 'Relief withheld unless payment made', 'Coercion or threats by official']
  },
  {
    id: 'excluded',
    label: '🚫 Wrongly Excluded',
    desc: 'I am a flood victim but my Aadhaar is not in the system or I was marked ineligible',
    subcategories: ['Aadhaar not in system', 'Marked ineligible despite being affected', 'Missed in survey', 'Excluded due to caste/community discrimination']
  },
  {
    id: 'death_disability',
    label: '🕊️ Death / Disability Not Updated',
    desc: 'A family member died or became disabled in the flood but records are not updated',
    subcategories: ['Death of primary earner not reflected', 'Disability assessment pending', 'Dependents not added after death']
  },
  {
    id: 'technical',
    label: '💻 Technical / Portal Issue',
    desc: 'Website or app errors preventing me from accessing or submitting information',
    subcategories: ['Cannot log in or verify Aadhaar', 'Documents not uploading', 'Score not calculating', 'Portal showing wrong information']
  },
  {
    id: 'others',
    label: '📝 Others',
    desc: 'My issue does not fit any of the above categories',
    subcategories: ['Other issue']
  }
]

const STATUS_COLORS = {
  Pending:      { bg: '#FFF8E1', text: '#F59E0B', dot: '#F59E0B' },
  'Under Review': { bg: '#EEF2FF', text: '#6366F1', dot: '#6366F1' },
  Resolved:     { bg: '#ECFDF5', text: '#10B981', dot: '#10B981' },
  Rejected:     { bg: '#FEF2F2', text: '#EF4444', dot: '#EF4444' },
}

// ── Main Component ──────────────────────────────────────────────────────────
function CitizenView() {
  const [activeTab, setActiveTab] = useState('search')

  // ── Search state ──
  const [aadhaar, setAadhaar]       = useState('')
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [activePill, setActivePill] = useState(null)
  const [scoreWidth, setScoreWidth] = useState(0)

  // ── Report state ──
  const [form, setForm] = useState({
    aadhaar: '', name: '', phone: '',
    category: '', subcategory: '', description: '', is_urgent: false
  })
  const [documents, setDocuments]   = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(null)
  const [formError, setFormError]   = useState('')

  // ── Track state ──
  const [trackAadhaar, setTrackAadhaar] = useState('')
  const [trackResults, setTrackResults] = useState(null)
  const [tracking, setTracking]         = useState(false)

  useEffect(() => {
    if (result) setTimeout(() => setScoreWidth(result.score), 100)
  }, [result])

  // ── Search logic ──────────────────────────────────────────────────────────
  const handleSearch = (id) => {
    const query = id || aadhaar
    if (!query) return
    setLoading(true); setError(''); setResult(null); setScoreWidth(0)
    fetch('http://localhost:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar: query.trim() })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          const c = data.citizen
          setResult({
            name: c.name, age: c.age, district: c.district,
            livelihood: c.livelihood, dependents: c.dependents,
            score: Math.round(c.vulnerability_score),
            tier: c.priority_tier, compensation: c.compensation_inr,
            breakdown: [
              { label: `Flood severity — ${c.district}`,    pts: c.score_breakdown.flood_zone_impact },
              { label: `Livelihood loss (${c.livelihood})`, pts: c.score_breakdown.livelihood_loss },
              { label: 'Dependent burden',                   pts: c.score_breakdown.dependent_burden },
              { label: 'Recovery capacity reduction',        pts: c.score_breakdown.recovery_capacity_reduction },
            ]
          })
        }
        setLoading(false)
      })
      .catch(() => { setError('Could not connect to server. Make sure Flask is running.'); setLoading(false) })
  }

  const loadDemo = (id) => { setAadhaar(id); setActivePill(id); handleSearch(id) }

  const TIER_COLORS = { Critical: '#E24B4A', High: '#F59E0B', Medium: '#6366F1', Low: '#10B981' }
  const tierColor = result ? TIER_COLORS[result.tier] : '#6366F1'

  // ── Report logic ──────────────────────────────────────────────────────────
  const selectedCat = CATEGORIES.find(c => c.id === form.category)

  const handleFile = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => setDocuments(prev => [...prev, { name: file.name, data: ev.target.result }])
      reader.readAsDataURL(file)
    })
  }

  const removeDoc = (i) => setDocuments(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = () => {
    setFormError('')
    if (!form.aadhaar.trim())     return setFormError('Please enter your Aadhaar number.')
    if (!form.name.trim())        return setFormError('Please enter your name.')
    if (!form.category)           return setFormError('Please select a complaint category.')
    if (!form.description.trim()) return setFormError('Please describe your issue.')
    setSubmitting(true)
    fetch('http://localhost:5000/grievance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, documents: documents.map(d => d.name) })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setFormError(data.error)
        else setSubmitted({ complaint_id: data.complaint_id })
        setSubmitting(false)
      })
      .catch(() => { setFormError('Could not connect to server.'); setSubmitting(false) })
  }

  const resetForm = () => {
    setForm({ aadhaar: '', name: '', phone: '', category: '', subcategory: '', description: '', is_urgent: false })
    setDocuments([]); setSubmitted(null); setFormError('')
  }

  // ── Track logic ───────────────────────────────────────────────────────────
  const handleTrack = () => {
    if (!trackAadhaar.trim()) return
    setTracking(true); setTrackResults(null)
    fetch('http://localhost:5000/grievance/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar: trackAadhaar.trim() })
    })
      .then(r => r.json())
      .then(data => { setTrackResults(data.complaints); setTracking(false) })
      .catch(() => { setTrackResults([]); setTracking(false) })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, background: '#F1F5F9', borderRadius: 14, padding: 6 }}>
        {[
          { id: 'search', label: '🔍 Check My Status' },
          { id: 'report', label: '📢 Report an Issue' },
          { id: 'track',  label: '🔎 Track Complaint' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontWeight: 600, fontSize: 14, transition: 'all .2s',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#1E293B' : '#64748B',
              boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,.1)' : 'none'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Search ── */}
      {activeTab === 'search' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1E293B' }}>Check Your Relief Status</h2>
            <p style={{ margin: '0 0 20px', color: '#64748B', fontSize: 14 }}>Enter your 12-digit Aadhaar number to see your vulnerability score and compensation.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={aadhaar} onChange={e => setAadhaar(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. 2535 4582 4811"
                style={{ flex: 1, padding: '12px 16px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 15, outline: 'none' }} />
              <button onClick={() => handleSearch()}
                style={{ padding: '12px 24px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                {loading ? '…' : 'Search'}
              </button>
            </div>
            {/* ── DEMO PILLS — updated to real Aadhaar IDs ── */}
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>Try demo:</span>
              {[{id:'2535 4582 4811',label:'Suresh Kumar'},{id:'6574 5552 3547',label:'Vijay Yadav'},{id:'5803 6925 4150',label:'Murugan Das'}].map(({id,label}) => (
                <button key={id} onClick={() => loadDemo(id)}
                  style={{ padding: '5px 12px', border: `2px solid ${activePill === id ? '#4F46E5' : '#E2E8F0'}`,
                    borderRadius: 20, background: activePill === id ? '#EEF2FF' : '#fff',
                    color: activePill === id ? '#4F46E5' : '#64748B', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', color: '#DC2626', marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 22, color: '#1E293B' }}>{result.name}</h3>
                  <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>{result.age} yrs · {result.livelihood} · {result.district}</p>
                </div>
                <span style={{ background: tierColor + '22', color: tierColor, fontWeight: 700, fontSize: 13, padding: '6px 14px', borderRadius: 20 }}>
                  {result.tier} Priority
                </span>
              </div>

              <div style={{ margin: '0 0 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>Vulnerability Score</span>
                  <span style={{ fontWeight: 800, fontSize: 20, color: tierColor }}>{result.score}/100</span>
                </div>
                <div style={{ height: 10, background: '#F1F5F9', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${scoreWidth}%`, background: tierColor, borderRadius: 10, transition: 'width 1s ease' }} />
                </div>
              </div>

              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <p style={{ margin: '0 0 12px', fontWeight: 600, color: '#475569', fontSize: 13, textTransform: 'uppercase', letterSpacing: .5 }}>Score Breakdown</p>
                {result.breakdown.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <span style={{ color: '#64748B' }}>{b.label}</span>
                    <span style={{ fontWeight: 700, color: '#1E293B' }}>+{b.pts} pts</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, background: '#EEF2FF', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6366F1', fontWeight: 600, textTransform: 'uppercase' }}>AI-Assessed Relief</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#4F46E5' }}>₹{result.compensation.toLocaleString('en-IN')}</p>
                </div>
                <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Uniform System</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#94A3B8' }}>₹25,000</p>
                </div>
              </div>

              <button onClick={() => setActiveTab('report')}
                style={{ marginTop: 16, width: '100%', padding: '12px', border: '2px dashed #CBD5E1', borderRadius: 10,
                  background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                ⚠️ Disagree with this result? Report an Issue →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Report ── */}
      {activeTab === 'report' && (
        <div>
          {submitted ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,.07)', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <h2 style={{ margin: '0 0 8px', color: '#1E293B' }}>Complaint Submitted</h2>
              <p style={{ color: '#64748B', marginBottom: 20 }}>Your complaint has been registered and will be reviewed by the relief authority.</p>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Your Complaint ID</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#4F46E5', letterSpacing: 2 }}>{submitted.complaint_id}</p>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748B' }}>Save this ID to track your complaint status</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={resetForm}
                  style={{ flex: 1, padding: 12, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Submit Another
                </button>
                <button onClick={() => { setActiveTab('track'); setTrackAadhaar(form.aadhaar) }}
                  style={{ flex: 1, padding: 12, background: '#F1F5F9', color: '#1E293B', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Track This Complaint
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1E293B' }}>Report an Issue</h2>
              <p style={{ margin: '0 0 24px', color: '#64748B', fontSize: 14 }}>All complaints are reviewed by the District Relief Authority within 48 hours.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Aadhaar Number *</label>
                  <input value={form.aadhaar} onChange={e => setForm(f => ({ ...f, aadhaar: e.target.value }))}
                    placeholder="12-digit Aadhaar number" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="As per Aadhaar" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Optional" style={inputStyle} />
                </div>
              </div>

              <label style={labelStyle}>What is your complaint about? *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setForm(f => ({ ...f, category: cat.id, subcategory: '' }))}
                    style={{
                      padding: '12px 14px', textAlign: 'left', border: `2px solid ${form.category === cat.id ? '#4F46E5' : '#E2E8F0'}`,
                      borderRadius: 10, background: form.category === cat.id ? '#EEF2FF' : '#fff',
                      cursor: 'pointer', transition: 'all .15s'
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.category === cat.id ? '#4F46E5' : '#1E293B', marginBottom: 3 }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{cat.desc}</div>
                  </button>
                ))}
              </div>

              {selectedCat && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Specific Issue *</label>
                  <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                    style={{ ...inputStyle, background: '#fff' }}>
                    <option value="">Select the specific issue…</option>
                    {selectedCat.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Describe your issue in detail *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Please provide as much detail as possible — dates, amounts, names of officials if applicable…"
                  rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Supporting Documents (optional)</label>
                <label style={{ display: 'block', border: '2px dashed #CBD5E1', borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer', color: '#64748B', fontSize: 13 }}>
                  <input type="file" multiple accept="image/*,.pdf" onChange={handleFile} style={{ display: 'none' }} />
                  📎 Click to upload photos, bank statements, or documents
                </label>
                {documents.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {documents.map((d, i) => (
                      <div key={i} style={{ background: '#F1F5F9', borderRadius: 8, padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        📄 {d.name}
                        <button onClick={() => removeDoc(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontWeight: 700, padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer',
                padding: '12px 16px', background: form.is_urgent ? '#FEF2F2' : '#F8FAFC',
                border: `2px solid ${form.is_urgent ? '#FECACA' : '#E2E8F0'}`, borderRadius: 10 }}>
                <input type="checkbox" checked={form.is_urgent} onChange={e => setForm(f => ({ ...f, is_urgent: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: '#EF4444' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: form.is_urgent ? '#DC2626' : '#1E293B' }}>🚨 Mark as Urgent</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>Check this if your situation is life-threatening — no food, shelter, or medical access</div>
                </div>
              </label>

              {formError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', color: '#DC2626', fontSize: 14, marginBottom: 16 }}>
                  ⚠️ {formError}
                </div>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                style={{ width: '100%', padding: '14px', background: submitting ? '#94A3B8' : '#4F46E5',
                  color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 16 }}>
                {submitting ? 'Submitting…' : 'Submit Complaint →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Track ── */}
      {activeTab === 'track' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.07)', marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1E293B' }}>Track Your Complaints</h2>
            <p style={{ margin: '0 0 20px', color: '#64748B', fontSize: 14 }}>Enter your Aadhaar number to see all complaints filed under it.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={trackAadhaar} onChange={e => setTrackAadhaar(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTrack()}
                placeholder="Your 12-digit Aadhaar number"
                style={{ flex: 1, padding: '12px 16px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 15, outline: 'none' }} />
              <button onClick={handleTrack}
                style={{ padding: '12px 24px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                {tracking ? '…' : 'Track'}
              </button>
            </div>
          </div>

          {trackResults !== null && (
            trackResults.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', color: '#64748B', boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p style={{ margin: 0, fontWeight: 600 }}>No complaints found for this Aadhaar number.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {trackResults.map(g => {
                  const sc = STATUS_COLORS[g.status] || STATUS_COLORS.Pending
                  return (
                    <div key={g.complaint_id} style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        <div>
                          <span style={{ fontWeight: 800, color: '#4F46E5', fontSize: 15, letterSpacing: 1 }}>{g.complaint_id}</span>
                          {g.is_urgent && <span style={{ marginLeft: 8, background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>🚨 URGENT</span>}
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, background: sc.dot, borderRadius: '50%', display: 'inline-block' }} />
                          {g.status}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#1E293B', fontSize: 14 }}>
                        {CATEGORIES.find(c => c.id === g.category)?.label || g.category}
                        {g.subcategory && <span style={{ color: '#94A3B8', fontWeight: 400 }}> · {g.subcategory}</span>}
                      </p>
                      <p style={{ margin: '0 0 10px', color: '#64748B', fontSize: 13 }}>{g.description}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>Submitted: {g.submitted_at}</p>
                      {g.resolution_note && (
                        <div style={{ marginTop: 12, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Official Response</p>
                          <p style={{ margin: 0, fontSize: 13, color: '#065F46' }}>{g.resolution_note}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }
const inputStyle = {
  width: '100%', padding: '11px 14px', border: '2px solid #E2E8F0', borderRadius: 10,
  fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#1E293B'
}

export default CitizenView