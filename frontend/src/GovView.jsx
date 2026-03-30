import { useState, useEffect } from 'react'

function GovView() {
  const [citizens, setCitizens] = useState([])
  const [filterTier, setFilterTier] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const filtered = citizens.filter(c =>
    (!filterTier || c.priority_tier === filterTier) &&
    (!filterDistrict || c.district === filterDistrict)
  )

  const total = citizens.reduce((s, c) => s + c.compensation_inr, 0)
  const critical = citizens.filter(c => c.priority_tier === 'Critical').length
  const high = citizens.filter(c => c.priority_tier === 'High').length

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