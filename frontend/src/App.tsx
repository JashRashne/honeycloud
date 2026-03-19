import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { IPLookup } from './pages/IPLookup'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ip/:ip" element={<IPLookup />} />
        <Route path="/ip" element={<IPLookup />} />
      </Routes>
    </BrowserRouter>
  )
}