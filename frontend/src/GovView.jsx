import { useState, useEffect } from 'react'

function GovView() {
  const [citizens, setCitizens] = useState([])
  const [filterTier, setFilterTier] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approvedMap, setApprovedMap] = useState({})   // aadhaar → 'loading' | 'done' | 'error'

  useEffect(() => {
    fetch('http://localhost:5000/citizens')
      .then(res => res.json())
      .then(data => {
        setCitizens(data.citizens)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not connect to server. Make sure Flask is running.')
        setLoading(false)
      })
  }, [])

  const handleApprove = (citizen) => {
    setApprovedMap(prev => ({ ...prev, [citizen.aadhaar]: 'loading' }))

    fetch('http://localhost:5000/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar: citizen.aadhaar })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'approved') {
          setApprovedMap(prev => ({ ...prev, [citizen.aadhaar]: 'done' }))
        } else {
          setApprovedMap(prev => ({ ...prev, [citizen.aadhaar]: 'error' }))
        }
      })
      .catch(() => {
        setApprovedMap(prev => ({ ...prev, [citizen.aadhaar]: 'error' }))
      })
  }

  const filtered = citizens.filter(c =>
    (!filterTier || c.priority_tier === filterTier) &&
    (!filterDistrict || c.district === filterDistrict)
  )

  const total = citizens.reduce((s, c) => s + c.compensation_inr, 0)
  const critical = citizens.filter(c => c.priority_tier === 'Critical').length
  const high = citizens.filter(c => c.priority_tier === 'High').length

  const approveBtn = (citizen) => {
    const status = approvedMap[citizen.aadhaar]

    if (status === 'loading') return (
      <button style={{
        padding: '6px 14px', borderRadius: '8px', border: 'none',
        background: '#e2e8f0', color: '#94a3b8',
        fontSize: '12px', fontWeight: 600, cursor: 'not-allowed'
      }}>
        Sending...
      </button>
    )

    if (status === 'done') return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '6px 14px', borderRadius: '8px',
        background: '#EAF3DE', color: '#3B6D11',
        fontSize: '12px', fontWeight: 700,
        border: '1px solid #97C459'
      }}>
        ✓ Email Sent
      </span>
    )

    if (status === 'error') return (
      <button
        onClick={() => handleApprove(citizen)}
        style={{
          padding: '6px 14px', borderRadius: '8px', border: '1.5px solid #F7C1C1',
          background: '#FCEBEB', color: '#A32D2D',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer'
        }}>
        ✕ Retry
      </button>
    )

    // default — not yet approved
    return (
      <button
        onClick={() => handleApprove(citizen)}
        style={{
          padding: '6px 16px', borderRadius: '8px', border: 'none',
          background: 'linear-gradient(135deg, #378ADD, #185FA5)',
          color: '#fff', fontSize: '12px', fontWeight: 700,
          cursor: 'pointer', transition: 'all .2s',
          boxShadow: '0 2px 8px rgba(24,95,165,0.35)'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
      >
        Approve
      </button>
    )
  }

  // count how many approved so far
  const approvedCount = Object.values(approvedMap).filter(v => v === 'done').length

  return (
    <div className="view">
      <div className="gov-header">
        <h2>Relief Distribution Dashboard</h2>
        <p>All affected citizens ranked by vulnerability score</p>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Loading citizens...</p>}
      {error && <div className="error-card">{error}</div>}

      {!loading && !error && (
        <>
          <div className="stats-grid">
            <div className="stat">
              <p>Total Citizens</p>
              <h3>{citizens.length}</h3>
            </div>
            <div className="stat">
              <p>Critical Priority</p>
              <h3 style={{ color: '#E24B4A' }}>{critical}</h3>
            </div>
            <div className="stat">
              <p>High Priority</p>
              <h3 style={{ color: '#EF9F27' }}>{high}</h3>
            </div>
            <div className="stat">
              <p>Total AI Allocation</p>
              <h3>₹{total.toLocaleString('en-IN')}</h3>
            </div>
            <div className="stat">
              <p>Uniform would cost</p>
              <h3 style={{ color: '#94a3b8' }}>₹{(citizens.length * 25000).toLocaleString('en-IN')}</h3>
            </div>
            <div className="stat">
              <p>Approvals Sent</p>
              <h3 style={{ color: '#3B6D11' }}>{approvedCount}</h3>
            </div>
          </div>

          <div className="filters">
            <select value={filterTier} onChange={e => setFilterTier(e.target.value)}>
              <option value="">All tiers</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
              <option value="">All districts</option>
              <option>Darbhanga, Bihar</option>
              <option>Araria, Bihar</option>
              <option>Morigaon, Assam</option>
              <option>Srikakulam, Andhra Pradesh</option>
              <option>Alappuzha, Kerala</option>
            </select>
          </div>

          {/* approved banner */}
          {approvedCount > 0 && (
            <div style={{
              background: 'rgba(59,109,17,0.2)', border: '1px solid rgba(151,196,89,0.5)',
              borderRadius: '12px', padding: '12px 18px', marginBottom: '16px',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>✅</span>
              {approvedCount} citizen{approvedCount > 1 ? 's' : ''} approved — email notification{approvedCount > 1 ? 's' : ''} sent successfully
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>District</th>
                  <th>Livelihood</th>
                  <th>Income Group</th>
                  <th>Score</th>
                  <th>Tier</th>
                  <th>Compensation</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((c, i) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td>{c.district}</td>
                    <td>{c.livelihood}</td>
                    <td>{c.income_category}</td>
                    <td>
                      <span className={`score-pill score-${c.priority_tier.toLowerCase()}`}>
                        {Math.round(c.vulnerability_score)}
                      </span>
                    </td>
                    <td>
                      <span className={`tier-badge ${c.priority_tier.toLowerCase()}`}>
                        {c.priority_tier}
                      </span>
                    </td>
                    <td>₹{c.compensation_inr.toLocaleString('en-IN')}</td>
                    <td>{approveBtn(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '12px' }}>
                Showing 100 of {filtered.length} citizens
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default GovView