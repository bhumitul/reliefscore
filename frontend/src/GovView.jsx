import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:5000'

const STATUS_OPTIONS = ['Pending', 'Under Review', 'Resolved', 'Rejected']

const STATUS_COLORS = {
  Pending:        { bg: '#FFF8E1', text: '#F59E0B', dot: '#F59E0B' },
  'Under Review': { bg: '#EEF2FF', text: '#6366F1', dot: '#6366F1' },
  Resolved:       { bg: '#ECFDF5', text: '#10B981', dot: '#10B981' },
  Rejected:       { bg: '#FEF2F2', text: '#EF4444', dot: '#EF4444' },
}

const CATEGORY_LABELS = {
  not_received:    '💸 Relief Not Received',
  wrong_amount:    '⚖️ Wrong Amount',
  wrong_data:      '📋 Incorrect Data',
  fraud:           '🚨 Fraud / Impersonation',
  corruption:      '🏛️ Corruption / Bribery',
  excluded:        '🚫 Wrongly Excluded',
  death_disability:'🕊️ Death / Disability',
  technical:       '💻 Technical Issue',
  others:          '📝 Others',
}

function GovView() {
  const [activeTab, setActiveTab]           = useState('dashboard')

  // ── Dashboard state ──
  const [citizens, setCitizens]             = useState([])
  const [filterTier, setFilterTier]         = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [approving, setApproving]           = useState(null)
  const [approvedSet, setApprovedSet]       = useState(new Set())

  // ── Grievances state ──
  const [grievances, setGrievances]         = useState([])
  const [gLoading, setGLoading]             = useState(false)
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterUrgent, setFilterUrgent]     = useState(false)
  const [filterCat, setFilterCat]           = useState('')
  const [expanded, setExpanded]             = useState(null)
  const [resNote, setResNote]               = useState({})
  const [saving, setSaving]                 = useState(null)

  // ── Load citizens ──────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/citizens`)
      .then(res => setCitizens(res.data.citizens))
      .catch(err => console.log(err))
  }, [])

  // ── Load grievances ────────────────────────────────────────────────────────
  const loadGrievances = () => {
    setGLoading(true)
    axios.get(`${API}/grievances`)
      .then(res => { setGrievances(res.data.grievances); setGLoading(false) })
      .catch(() => setGLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'grievances') loadGrievances()
  }, [activeTab])

  // ── Approve + email ────────────────────────────────────────────────────────
  const handleApprove = (aadhaar) => {
    setApproving(aadhaar)
    axios.post(`${API}/approve`, { aadhaar })
      .then(res => {
        setApprovedSet(prev => new Set([...prev, aadhaar]))
        setApproving(null)
        const r = res.data
        alert(`✅ Approved: ${r.citizen}\n💰 ₹${r.compensation_inr.toLocaleString('en-IN')}\n📧 ${r.email_sent?.message || r.email_sent?.error || ''}`)
      })
      .catch(() => { setApproving(null); alert('❌ Approval failed. Check Flask console.') })
  }

  // ── Dashboard filters ──────────────────────────────────────────────────────
  const filtered = citizens.filter(c =>
    (!filterTier     || c.priority_tier === filterTier) &&
    (!filterDistrict || c.district === filterDistrict)
  )

  const total    = citizens.reduce((s, c) => s + c.compensation_inr, 0)
  const critical = citizens.filter(c => c.priority_tier === 'Critical').length

  // ── Grievance filters ──────────────────────────────────────────────────────
  const urgentCount = grievances.filter(g => g.is_urgent && g.status === 'Pending').length

  const filteredG = grievances.filter(g =>
    (!filterStatus || g.status === filterStatus) &&
    (!filterUrgent || g.is_urgent) &&
    (!filterCat    || g.category === filterCat)
  ).sort((a, b) => {
    if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1
    return 0
  })

  // ── Update grievance ───────────────────────────────────────────────────────
  const updateGrievance = (complaint_id, status) => {
    setSaving(complaint_id)
    const note = resNote[complaint_id] || ''
    axios.patch(`${API}/grievance/${complaint_id}`, { status, resolution_note: note })
      .then(res => {
        setGrievances(prev => prev.map(g => g.complaint_id === complaint_id ? res.data.grievance : g))
        setSaving(null)
      })
      .catch(() => setSaving(null))
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, background: '#F1F5F9', borderRadius: 14, padding: 6 }}>
        {[
          { id: 'dashboard',  label: '📊 Relief Dashboard' },
          { id: 'grievances', label: `📢 Grievances${urgentCount > 0 ? ` 🔴${urgentCount}` : ''}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontWeight: 600, fontSize: 15, transition: 'all .2s',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#1E293B' : '#64748B',
              boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,.1)' : 'none'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Dashboard ── */}
      {activeTab === 'dashboard' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 4px', color: '#1E293B' }}>Relief Distribution Dashboard</h2>
            <p style={{ margin: 0, color: '#64748B' }}>All affected citizens ranked by vulnerability score</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Citizens',    value: citizens.length,                                           color: '#1E293B' },
              { label: 'Critical Priority', value: critical,                                                   color: '#E24B4A' },
              { label: 'Total Allocation',  value: '₹' + total.toLocaleString('en-IN'),                        color: '#4F46E5' },
              { label: 'Uniform Would Cost',value: '₹' + (citizens.length * 25000).toLocaleString('en-IN'),  color: '#94A3B8' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <select value={filterTier} onChange={e => setFilterTier(e.target.value)} style={selStyle}>
              <option value="">All tiers</option>
              {['Critical','High','Medium','Low'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} style={selStyle}>
              <option value="">All districts</option>
              {['Darbhanga, Bihar','Araria, Bihar','Morigaon, Assam','Srikakulam, AP','Alappuzha, Kerala'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Name','District','Income Group','Score','Tier','Compensation','Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const TIER_C   = { Critical:'#E24B4A', High:'#F59E0B', Medium:'#6366F1', Low:'#10B981' }
                    const tc       = TIER_C[c.priority_tier]
                    const isApproved  = approvedSet.has(c.aadhaar)
                    const isApproving = approving === c.aadhaar
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E293B', fontSize: 14 }}>{c.name}</td>
                        <td style={{ padding: '12px 16px', color: '#64748B', fontSize: 13 }}>{c.district}</td>
                        <td style={{ padding: '12px 16px', color: '#64748B', fontSize: 13 }}>{c.income_category}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: tc + '22', color: tc, fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontSize: 13 }}>
                            {Math.round(c.vulnerability_score)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: tc + '18', color: tc, fontWeight: 700, padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                            {c.priority_tier}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B', fontSize: 14 }}>
                          ₹{c.compensation_inr.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            disabled={isApproved || isApproving}
                            onClick={() => handleApprove(c.aadhaar)}
                            style={{
                              padding: '6px 16px',
                              background: isApproved ? '#10B981' : isApproving ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5, #6366F1)',
                              color: '#fff', border: 'none', borderRadius: 8,
                              fontWeight: 700, fontSize: 12,
                              cursor: isApproved || isApproving ? 'default' : 'pointer',
                              whiteSpace: 'nowrap', transition: 'all .2s'
                            }}>
                            {isApproved ? '✅ Approved' : isApproving ? 'Sending…' : '✉️ Approve'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Grievances ── */}
      {activeTab === 'grievances' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', color: '#1E293B' }}>Citizen Grievances</h2>
              <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>{grievances.length} total · {urgentCount} urgent pending</p>
            </div>
            <button onClick={loadGrievances}
              style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              🔄 Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {STATUS_OPTIONS.map(s => {
              const count = grievances.filter(g => g.status === s).length
              const sc = STATUS_COLORS[s]
              return (
                <div key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                  style={{ background: filterStatus === s ? sc.bg : '#fff', border: `2px solid ${filterStatus === s ? sc.dot : '#E2E8F0'}`,
                    borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: sc.text }}>{count}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{s}</p>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={selStyle}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px',
              background: filterUrgent ? '#FEE2E2' : '#F8FAFC', border: `2px solid ${filterUrgent ? '#FECACA' : '#E2E8F0'}`,
              borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: filterUrgent ? '#DC2626' : '#64748B' }}>
              <input type="checkbox" checked={filterUrgent} onChange={e => setFilterUrgent(e.target.checked)} style={{ accentColor: '#EF4444' }} />
              🚨 Urgent Only
            </label>
          </div>

          {gLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>Loading grievances…</div>
          ) : filteredG.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#94A3B8', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ margin: 0, fontWeight: 600 }}>No grievances found with current filters.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredG.map(g => {
                const sc    = STATUS_COLORS[g.status] || STATUS_COLORS.Pending
                const isOpen = expanded === g.complaint_id
                return (
                  <div key={g.complaint_id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.07)',
                    border: g.is_urgent && g.status === 'Pending' ? '2px solid #FECACA' : '2px solid transparent' }}>

                    <div style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
                      onClick={() => setExpanded(isOpen ? null : g.complaint_id)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: '#4F46E5', fontSize: 13, letterSpacing: 1 }}>{g.complaint_id}</span>
                          {g.is_urgent && <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>🚨 URGENT</span>}
                          <span style={{ background: sc.bg, color: sc.text, fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 5, height: 5, background: sc.dot, borderRadius: '50%', display: 'inline-block' }} />
                            {g.status}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: 14, marginBottom: 2 }}>
                          {CATEGORY_LABELS[g.category] || g.category}
                          {g.subcategory && <span style={{ color: '#94A3B8', fontWeight: 400 }}> · {g.subcategory}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: '#64748B' }}>{g.name} · Aadhaar: {g.aadhaar}{g.phone && ` · 📞 ${g.phone}`}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>{g.submitted_at}</div>
                        <div style={{ fontSize: 18, marginTop: 4, color: '#CBD5E1' }}>{isOpen ? '▲' : '▼'}</div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px 20px 20px' }}>
                        <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Citizen's Description</p>
                          <p style={{ margin: 0, fontSize: 14, color: '#1E293B', lineHeight: 1.6 }}>{g.description}</p>
                        </div>

                        {g.documents && g.documents.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Attached Documents</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {g.documents.map((d, i) => (
                                <span key={i} style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8 }}>📄 {d}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase' }}>
                            Resolution Note (visible to citizen)
                          </label>
                          <textarea
                            value={resNote[g.complaint_id] ?? g.resolution_note}
                            onChange={e => setResNote(prev => ({ ...prev, [g.complaint_id]: e.target.value }))}
                            placeholder="Enter your response or action taken…"
                            rows={3}
                            style={{ width: '100%', padding: '10px 14px', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {STATUS_OPTIONS.map(s => {
                            const sc2     = STATUS_COLORS[s]
                            const isCurrent = g.status === s
                            return (
                              <button key={s} disabled={saving === g.complaint_id} onClick={() => updateGrievance(g.complaint_id, s)}
                                style={{
                                  padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                  border: `2px solid ${isCurrent ? sc2.dot : '#E2E8F0'}`,
                                  background: isCurrent ? sc2.bg : '#F8FAFC',
                                  color: isCurrent ? sc2.text : '#64748B',
                                  opacity: saving === g.complaint_id ? .6 : 1
                                }}>
                                {saving === g.complaint_id && isCurrent ? 'Saving…' : s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const selStyle = {
  padding: '10px 14px', border: '2px solid #E2E8F0', borderRadius: 10,
  fontSize: 13, background: '#fff', color: '#374151', outline: 'none', cursor: 'pointer'
}

export default GovView