import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { IPLookup } from './pages/IPLookup'
import { Landing } from './pages/Landing'
import { ThreatIntel } from './pages/ThreatIntel'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/intel" element={<ThreatIntel />} />
        <Route path="/ip/:ip" element={<IPLookup />} />
        <Route path="/ip" element={<IPLookup />} />
      </Routes>
    </BrowserRouter>
  )
}