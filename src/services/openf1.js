const BASE = 'https://api.openf1.org/v1'

async function get(endpoint, params = {}) {
  const url = new URL(`${BASE}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenF1 ${res.status}: ${endpoint}`)
  return res.json()
}

export const openf1 = {
  meetings: (year) => get('/meetings', { year }),
  sessions: (meetingKey) => get('/sessions', { meeting_key: meetingKey }),
  drivers: (sessionKey) => get('/drivers', { session_key: sessionKey }),
  laps: (sessionKey, driverNumber) =>
    get('/laps', { session_key: sessionKey, driver_number: driverNumber }),
  allLaps: (sessionKey) => get('/laps', { session_key: sessionKey }),
  intervals: (sessionKey) => get('/intervals', { session_key: sessionKey }),
  position: (sessionKey) => get('/position', { session_key: sessionKey }),
  carData: (sessionKey, driverNumber, lapNumber) =>
    get('/car_data', {
      session_key: sessionKey,
      driver_number: driverNumber,
      ...(lapNumber ? { lap_number: lapNumber } : {}),
    }),
  stints: (sessionKey) => get('/stints', { session_key: sessionKey }),
  pit: (sessionKey) => get('/pit', { session_key: sessionKey }),
  weather: (sessionKey) => get('/weather', { session_key: sessionKey }),
  raceControl: (sessionKey) => get('/race_control', { session_key: sessionKey }),
  latestSession: () => get('/sessions', { session_key: 'latest' }),
  location: (sessionKey, driverNumber, lapNumber) =>
    get('/location', {
      session_key: sessionKey,
      ...(driverNumber !== undefined ? { driver_number: driverNumber } : {}),
      ...(lapNumber !== undefined ? { lap_number: lapNumber } : {}),
    }),
  recentLocations: (sessionKey, sinceIso) =>
    fetch(`${BASE}/location?session_key=${sessionKey}&date>=${encodeURIComponent(sinceIso)}`)
      .then(r => { if (!r.ok) throw new Error('location'); return r.json() }),
}
