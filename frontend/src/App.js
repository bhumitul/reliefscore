import { useState } from 'react'
import CitizenView from './CitizenView'
import GovView from './GovView'
import './App.css'

function App() {
  const [view, setView] = useState('citizen')

  return (
    <div className="app">
      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <h1>ReliefScore India</h1>
            <p>AI-powered flood aid system</p>
          </div>
        </div>

        <div className="tabs">
          <button
            className={view === 'citizen' ? 'tab active' : 'tab'}
            onClick={() => setView('citizen')}>
            Citizen Portal
          </button>
          <button
            className={view === 'gov' ? 'tab active' : 'tab'}
            onClick={() => setView('gov')}>
            Government Dashboard
          </button>
        </div>
      </nav>

      {view === 'citizen' && <CitizenView />}
      {view === 'gov'     && <GovView />}
    </div>
  )
}

export default App