import { useState, useEffect } from 'react'

function CitizenView() {
  const [aadhaar, setAadhaar] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activePill, setActivePill] = useState('')
  const [scoreWidth, setScoreWidth] = useState(0)
  const [demoIds, setDemoIds] = useState([])

  // Load real demo IDs from Flask on startup
  useEffect(() => {
    fetch('http://localhost:5000/citizens')
      .then(res => res.json())
      .then(data => {
        const first5 = data.citizens.slice(0, 5)
        setDemoIds(first5.map(c => ({
          id: c.aadhaar,
          label: `${c.name.split(' ')[0]} — ${c.livelihood}`
        })))
      })
      .catch(() => {})
  }, [])

  const scoreBarColor = (score) => {
    if (score >= 70) return 'linear-gradient(90deg, #E24B4A, #ff6b6b)'
    if (score >= 45) return 'linear-gradient(90deg, #EF9F27, #f5c06e)'
    if (score >= 25) return 'linear-gradient(90deg, #378ADD, #60a5fa)'
    return 'linear-gradient(90deg, #639922, #84cc16)'
  }

  const scoreTextColor = (score) => {
    if (score >= 70) return '#E24B4A'
    if (score >= 45) return '#EF9F27'
    if (score >= 25) return '#378ADD'
    return '#639922'
  }

  useEffect(() => {
    if (result) {
      setScoreWidth(0)
      const t = setTimeout(() => setScoreWidth(result.score), 80)
      return () => clearTimeout(t)
    }
  }, [result])

  const fetchCitizen = (id) => {
    return fetch('http://localhost:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar: id.trim() })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setResult(null)
        } else {
          const c = data.citizen
          setResult({
            name: c.name,
            age: c.age,
            district: c.district,
            livelihood: c.livelihood,
            dependents: c.dependents,
            score: Math.round(c.vulnerability_score),
            tier: c.priority_tier,
            compensation: c.compensation_inr,
            breakdown: [
              { label: `Flood severity — ${c.district}`, pts: c.score_breakdown.flood_zone_impact },
              { label: `Livelihood loss (${c.livelihood})`, pts: c.score_breakdown.livelihood_loss },
              { label: 'Dependent burden', pts: c.score_breakdown.dependent_burden },
              { label: 'Recovery capacity reduction', pts: c.score_breakdown.recovery_capacity_reduction },
            ]
          })
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Could not connect to server. Make sure Flask is running.')
        setLoading(false)
      })
  }

  const handleSearch = () => {
    if (!aadhaar) return
    setLoading(true)
    setError('')
    setResult(null)
    setScoreWidth(0)
    fetchCitizen(aadhaar)
  }

  const loadDemo = (id) => {
    setAadhaar(id)
    setActivePill(id)
    setResult(null)
    setError('')
    setScoreWidth(0)
    setLoading(true)
    fetchCitizen(id)
  }

  const getInitials = (name) =>
    name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const uniformAmount = 25000

  return (
    <div className="view">

      <div className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          AI-powered vulnerability scoring
        </div>
        <h2>Check your flood relief status</h2>
        <p>Enter your Aadhaar number — our model scores your vulnerability across 11 factors</p>
      </div>

      <div className="search-card">
        <label>Aadhaar Number</label>
        <div className="search-row">
          <input
            type="text"
            value={aadhaar}
            onChange={e => setAadhaar(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="XXXX XXXX XXXX"
            maxLength={14}
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? 'Analysing...' : 'Check Status'}
          </button>
        </div>
        <div className="demos">
          <p>Quick demos</p>
          <div className="demo-pills">
            {demoIds.map(d => (
              <span
                key={d.id}
                onClick={() => loadDemo(d.id)}
                style={activePill === d.id ? {
                  borderColor: 'rgba(255,255,255,0.7)',
                  color: '#fff',
                  background: 'rgba(255,255,255,0.2)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                } : {}}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error-card">{error}</div>}

      {/* Shimmer skeleton while loading */}
      {loading && (
        <div className="skeleton-card">
          <div style={{ display: 'flex', gap: '14px', marginBottom: '24px' }}>
            <div className="skeleton-line" style={{ width: '52px', height: '52px', borderRadius: '15px', flexShrink: 0, marginBottom: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-line" style={{ width: '55%', height: '16px' }} />
              <div className="skeleton-line" style={{ width: '75%', height: '12px' }} />
            </div>
          </div>
          <div className="skeleton-line" style={{ width: '100%', height: '16px' }} />
          <div className="skeleton-line" style={{ width: '88%', height: '12px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginTop: '8px' }}>
            <div className="skeleton-line" style={{ height: '60px', borderRadius: '12px', marginBottom: 0 }} />
            <div className="skeleton-line" style={{ height: '60px', borderRadius: '12px', marginBottom: 0 }} />
            <div className="skeleton-line" style={{ height: '60px', borderRadius: '12px', marginBottom: 0 }} />
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="result-card">

          <div className="result-header">
            <div className="avatar">{getInitials(result.name)}</div>
            <div>
              <h3>{result.name}</h3>
              <p>{result.district} &nbsp;·&nbsp; Age {result.age} &nbsp;·&nbsp; {result.livelihood}</p>
            </div>
            <div className={`tier-badge ${result.tier.toLowerCase()}`}>
              {result.tier} Priority
            </div>
          </div>

          <div className="score-section">
            <div className="score-labels">
              <span>Vulnerability Score</span>
              <span style={{ color: scoreTextColor(result.score) }}>{result.score}/100</span>
            </div>
            <div className="score-bar">
              <div
                className="score-fill"
                style={{
                  width: `${scoreWidth}%`,
                  background: scoreBarColor(result.score),
                }}
              />
            </div>
            <div className="score-ticks">
              {['0', '25', '50', '75', '100'].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>

          <div className="metrics">
            <div className="metric">
              <p>Compensation</p>
              <h3 style={{ color: '#185FA5', fontSize: '17px' }}>
                ₹{result.compensation.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="metric">
              <p>Livelihood</p>
              <h3 style={{ fontSize: '14px', marginTop: '2px' }}>{result.livelihood}</h3>
            </div>
            <div className="metric">
              <p>Dependents</p>
              <h3>{result.dependents}</h3>
            </div>
          </div>

          <div className="comparison">
            <div style={{ fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Uniform vs context-aware
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', color: '#64748b' }}>
              <span>Flat amount — everyone gets same</span>
              <span style={{ textDecoration: 'line-through', color: '#cbd5e1' }}>₹{uniformAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0' }}>
              <span style={{ color: '#64748b' }}>Your context-aware amount</span>
              <span style={{ color: '#185FA5', fontWeight: 800, fontSize: '16px' }}>₹{result.compensation.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', lineHeight: 1.6 }}>
              {result.compensation > uniformAmount
                ? `You receive ₹${(result.compensation - uniformAmount).toLocaleString('en-IN')} more than a uniform system — your vulnerability is above average.`
                : result.compensation < uniformAmount
                ? `You receive ₹${(uniformAmount - result.compensation).toLocaleString('en-IN')} less — your recovery capacity is above average.`
                : `Your context-aware amount matches the uniform rate.`}
            </div>
          </div>

          <div className="breakdown">
            <p className="breakdown-title">Why you got this score</p>
            {result.breakdown.map((item, i) => (
              <div key={i} className="breakdown-item">
                <span
                  className="dot"
                  style={{ background: item.pts < 0 ? '#3B6D11' : item.pts === 0 ? '#cbd5e1' : '#185FA5' }}
                />
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{
                  fontWeight: 700, fontSize: '13px',
                  color: item.pts < 0 ? '#3B6D11' : item.pts === 0 ? '#94a3b8' : '#0f1923'
                }}>
                  {item.pts > 0 ? `+${item.pts}` : item.pts === 0 ? '—' : item.pts} pts
                </span>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}

export default CitizenView