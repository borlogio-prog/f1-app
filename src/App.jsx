import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Session from './pages/Session'
import Telemetry from './pages/Telemetry'
import Live from './pages/Live'
import Map from './pages/Map'
import LiveTiming from './pages/LiveTiming'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <main className="py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/live" element={<Live />} />
            <Route path="/timing" element={<LiveTiming />} />
            <Route path="/session/:sessionKey" element={<Session />} />
            <Route path="/session/:sessionKey/map" element={<Map />} />
            <Route path="/session/:sessionKey/telemetry/:driverNumber" element={<Telemetry />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
