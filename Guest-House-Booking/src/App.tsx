import { useState } from 'react'
import logo  from '../assets/icons/logo.png'
import guetsHouse from '../assets/images/guestHouse.jpg'
import { useRef } from 'react'
import Login from './pages/login.tsx'
import { confirmBooking, createBookingHold, getAvailableRooms, type BookingHold, type Session } from './api'

type RoomType = 'standard' 
type RoomStatus = 'available' | 'selected' | 'unavailable'

interface Room {
  id: number
  number: string
  type: RoomType
  status: RoomStatus
  price: number
  view: string
}

interface Floor {
  id: number
  label: string
  shortLabel: string
  rooms: Room[]
  description: string
}

function generateRooms(floorId: number): Room[] {
  const configs: Record<number, { count: number; prefix: string; unavailableIds: number[] }> = {
    0: { count: 8, prefix: 'GF', unavailableIds: [2, 5] },
    1: { count: 10, prefix: '1F', unavailableIds: [3, 7, 9] },
    2: { count: 10, prefix: '2F', unavailableIds: [1, 4] },
    3: { count: 8, prefix: '3F', unavailableIds: [2, 6, 8] },
    4: { count: 6, prefix: '4F', unavailableIds: [3] },
  }
  const cfg = configs[floorId]
  const rooms: Room[] = []

  for (let i = 1; i <= cfg.count; i++) {
    const isUnavailable = cfg.unavailableIds.includes(i)
    let type: RoomType = 'standard'
    let price = 300

    if (i > cfg.count - 2) {
      type = 'standard'
      price = price
      
    } else if (i > cfg.count / 2) {
      type = 'standard'
      price = price
      
    }

    if (floorId === 4) {
      type = 'standard'
      price = price
      
    }

    rooms.push({
      id: floorId * 100 + i,
      number: `${cfg.prefix}${String(i).padStart(2, '0')}`,
      type,
      status: isUnavailable ? 'unavailable' : 'available',
      price,
      view: '',
    })
  }
  return rooms
}

const FLOORS: Floor[] = [
  {
    id: 0,
    label: 'Ground Floor',
    shortLabel: 'GF',
    description: 'Lobby-level rooms with garden access',
    rooms: generateRooms(0),
  },
  {
    id: 1,
    label: '1st Floor',
    shortLabel: '01',
    description: 'Standard &  corridor',
    rooms: generateRooms(1),
  },
  {
    id: 2,
    label: '2nd Floor',
    shortLabel: '02',
    description: 'Quiet wing with city views',
    rooms: generateRooms(2),
  },
  {
    id: 3,
    label: '3rd Floor',
    shortLabel: '03',
    description: '',
    rooms: generateRooms(3),
  },
  {
    id: 4,
    label: '4th Floor',
    shortLabel: '04',
    description: '',
    rooms: generateRooms(4),
  },
]

type Step = 'landing' | 'selector' | 'confirmation'

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function RoomCell({
  room,
  onClick,
}: {
  room: Room
  onClick: () => void
}) {
  const isSelected = room.status === 'selected'
  const isUnavailable = room.status === 'unavailable'

  let bg = 'bg-[#0f2318] border-[rgba(52,168,83,0.3)] text-[#4ade80]'
  if (room.type === "standard" && !isUnavailable && !isSelected) {
        // bg = 'bg-[#0000] border-[#00801D] text-[#00801D]'
        bg = 'bg-[#001F33] border-[#6e95c9b3] text-[#0073C2]'
      }
  
  if (isSelected) {
    bg = 'bg-[#00300C] border-[#00801D] text-[#00B52E]'
  }
  if (isUnavailable) {
    bg = 'bg-[#111111] border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.18)] cursor-not-allowed'
  }

  return (
    <button
      onClick={isUnavailable ? undefined : onClick}
      disabled={isUnavailable}
      className={`relative flex flex-col items-center justify-center rounded-lg border p-3 transition-all duration-150 ${bg} ${
        !isUnavailable ? 'hover:scale-[1.04] hover:shadow-lg cursor-pointer' : ''
      } ${isSelected ? 'ring-1 ring-[#c9a96e]/40 shadow-[0_0_12px_rgba(201,169,110,0.15)]' : ''}`}
      style={{ minHeight: 72 }}
    >
      {isUnavailable && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-px bg-[rgba(255,255,255,0.08)] rotate-[135deg]" />
        </div>
      )}
      <span
        className="font-mono text-sm font-semibold tracking-wider"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {room.number}
      </span>
      <span className="text-[10px] mt-1 opacity-70 capitalize">{isUnavailable ? 'booked' : room.type}</span>
      {isSelected && (
        <span className="absolute top-1.5 right-1.5 text-[#c9a96e]">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  )
}

export default function App() {
  const checkOutDate = useRef<HTMLInputElement>(null)
  const checkInDate = useRef<HTMLInputElement>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [step, setStep] = useState<Step>('landing')
  const [checkIn, setCheckIn] = useState('2026-08-20')
  const [checkOut, setCheckOut] = useState('2026-08-22')
  const [guests, setGuests] = useState(2)
  const [selectedFloorId, setSelectedFloorId] = useState<number>(0)
  const [floors, setFloors] = useState<Floor[]>(FLOORS)
  const [bookingDone, setBookingDone] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [heldBooking, setHeldBooking] = useState<BookingHold['bookingRequest'] | null>(null)
  const [confirmationError, setConfirmationError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)

  const selectedFloor = floors.find((f) => f.id === selectedFloorId)!

  const allSelectedRooms = floors.flatMap((f) => f.rooms.filter((r) => r.status === 'selected'))
  const totalPrice = allSelectedRooms.reduce((sum, r) => sum + r.price, 0)

  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
  )

  function toggleRoom(floorId: number, roomId: number) {
    setFloors((prev) =>
      prev.map((f) =>
        f.id !== floorId
          ? f
          : {
              ...f,
              rooms: f.rooms.map((r) =>
                r.id !== roomId
                  ? r
                  : { ...r, status: r.status === 'selected' ? 'available' : 'selected' },
              ),
            },
      ),
    )
  }

  async function browseAvailableRooms() {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setAvailabilityError('Choose a valid check-in and check-out date.')
      return
    }

    setAvailabilityError('')
    setIsLoadingRooms(true)
    try {
      const { rooms, pricePerRoomPerDay } = await getAvailableRooms(checkIn, checkOut)
      const byFloor = new Map<number, Room[]>()
      for (const room of rooms) {
        const floor = Number(room.Floor)
        const floorRooms = byFloor.get(floor) ?? []
        floorRooms.push({
          id: room.RoomId,
          number: room.RoomNo,
          type: 'standard',
          status: room.isAvailable ? 'available' : 'unavailable',
          price: pricePerRoomPerDay,
          view: '',
        })
        byFloor.set(floor, floorRooms)
      }
      const availableFloors = [...byFloor.entries()]
        .sort(([left], [right]) => left - right)
        .map(([id, rooms]) => ({
          id,
          label: id === 0 ? 'Ground Floor' : `${id}${id === 1 ? 'st' : id === 2 ? 'nd' : id === 3 ? 'rd' : 'th'} Floor`,
          shortLabel: id === 0 ? 'GF' : String(id).padStart(2, '0'),
          description: '',
          rooms,
        }))

      if (!availableFloors.length) {
        setAvailabilityError('No rooms are available for the selected dates.')
        return
      }
      setFloors(availableFloors)
      setSelectedFloorId(availableFloors[0].id)
      setStep('selector')
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : 'Unable to load room availability.')
    } finally {
      setIsLoadingRooms(false)
    }
  }

  async function createHoldAfterVerification(verifiedSession: Session) {
    const { bookingRequest } = await createBookingHold(verifiedSession, checkIn, checkOut, allSelectedRooms.map((room) => room.id))
    setSession(verifiedSession)
    setHeldBooking(bookingRequest)
    setShowLogin(false)
    setBookingDone(false)
    setStep('confirmation')
  }

  async function submitBooking() {
    if (!session || !heldBooking) return
    setConfirmationError('')
    setIsSubmitting(true)
    try {
      await confirmBooking(session, heldBooking.requestId)
      setBookingDone(true)
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : 'Unable to confirm your booking.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function availableCount(floor: Floor) {
    return floor.rooms.filter((r) => r.status === 'available').length
  }

  function selectedCount(floor: Floor) {
    return floor.rooms.filter((r) => r.status === 'selected').length
  }

  // ── Landing ─────────────────────────────────────────────────────────────────
  if (step === 'landing') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#fff', fontFamily: "'Outfit', sans-serif" }}>
        {/* Hero */}
        <div className="relative flex-1 flex flex-col">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&h=900&fit=crop&auto=format')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#080808]" />

          {/* Nav */}
          <nav className="relative z-10 flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-3">

              {/* Logo */}
              <div className="w-8 h-8 flex items-center justify-center">
                <img src={logo} alt="RGUKT Logo" className="w-8 h-8 object-contain" />
              </div>

              {/* Website name */}
              <span className="text-white font-semibold text-lg tracking-tight">
                RGUKT
              </span>

            </div>

            <div className="flex items-center gap-6 text-sm text-white/60">
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Amenities</a>
              <a href="#" className="hover:text-white transition-colors">Gallery</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-32 text-center">
            <p
              className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase mb-4"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Est. 2008, Nuzvid, India
            </p>
            <h1 className="text-5xl md:text-7xl font-[600] text-[#8D0000] leading-none tracking-tight mb-4">
              RGUKT
            </h1>
            <p className="text-white/50 text-lg font-light max-w-md">
              Five floors of curated stillness, above the city's hum.
            </p>
          </div>

        
        </div>
          {/* Booking Card */}
          <div className="relative z-10 w-full  ">
            <div
              className=" p-6 md:p-8"
              style={{
                background: '#244f77',
                backdropFilter: 'blur(20px)',
                border: '1px solid #043c7c',
                
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Check In */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[10px] tracking-[0.2em] uppercase text-white"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Check In
                  </label>

                  <div className="relative">
                    <input
                  type="date"
                  ref = {checkInDate}
                  value={checkIn}
                  onClick = {() => checkInDate.current?.showPicker()}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full bg-white border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-black text-sm focus:outline-none focus:border-[#c9a96e]/50 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0"
                />

                    {/* Calendar Icon */}
                    <svg
                      className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                      fill="none"
                      onClick = {()=> checkInDate.current?.showPicker()}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2zm-2 5h2m2 0h2m2 0h2M6 16h2m2 0h2m2 0h2"
                      />
                    </svg>
                  </div>
                </div>

                {/* Check Out */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[10px] tracking-[0.2em] uppercase text-white"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Check Out
                  </label>

                  <div className="relative">
                    <input
                  type="date"
                  ref={checkOutDate}
                  value={checkOut}
                  onClick = {() => checkOutDate.current?.showPicker()}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full bg-white cursor-pointer border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-black text-sm focus:outline-none focus:border-[#c9a96e]/50 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0"
                />

                    {/* Calendar Icon */}
                    <svg
                      onClick={() => checkOutDate.current?.showPicker()}
                      className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 hover:text-gray-600 transition-colors duration-200"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 4h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2zm-2 5h2m2 0h2m2 0h2M6 16h2m2 0h2m2 0h2"
                      />
                    </svg>
                  </div>
                </div>
                {/* Guests */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[10px] tracking-[0.2em] uppercase text-[#fff]]"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Guests
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    className="bg-white border border-white/10 rounded-lg px-3 py-2.5 text-black text-sm focus:outline-none focus:border-[#c9a96e]/50 transition-colors cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </div>
                {/* CTA */}
                <button
                  onClick={browseAvailableRooms}
                  disabled={isLoadingRooms}
                  className="flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_20px_rgba(201,169,110,0.3)] active:scale-95 cursor-pointer"
                  style={{ background: '#e7e7e7', color: '#080808' }}
                >
                  {isLoadingRooms ? 'Loading…' : 'Browse Rooms'}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {availabilityError && <p role="alert" className="mt-3 text-sm text-red-100">{availabilityError}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 py-7 bg-white">
            <img src={guetsHouse} alt="RGUKT Guest House" className="w-full h-auto rounded-lg shadow-lg" />
            <div className="mt-4 text-center">
              <h2 className="text-xl font-bold text-[#000]">RGUKT Guest House</h2>
              <p className="text-[#000] text-sm">
                Experience comfort and hospitality in our guest house.<br/>
                RGUKT Nuzvid is a premier institute blending technology education with serene campus life.<br/>
                It fosters innovation, research, and holistic growth for students.
              </p>
            </div>
          </div>
        {/* Amenities Strip */}
        <div
          className="mt-16 mx-auto max-w-auto px-6 w-full bg-white/10 rounded"
        >
          <div className="grid grid-cols-3 md:grid-cols-3 gap-4 py-8">
            {[
              { icon: '⬟', label: 'Greenery & Nature' },
              { icon: '◉', label: 'Fine Dining' },
              { icon: '◧', label: 'Free WiFi' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2 text-center border border-black rounded-lg p-4 ">
                <span className="text-[#000] text-xl ">{item.icon}</span>
                <span className="text-[#000] text-xl ">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="h-px bg-white/5" />
          <p className="text-center text-[#800] text-xs py-7 "  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            © 2026 THE RGUKT · 14 MYLAVARAM Road, Nuzvid 521202
          </p>
        </div>
      </div>
    )
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────
  if (step === 'confirmation' || bookingDone) {
    const summaryRooms = heldBooking?.rooms.map((room) => room.RoomNo) ?? allSelectedRooms.map((room) => room.number)
    const summaryNights = heldBooking?.nights ?? nights
    const summaryTotal = heldBooking?.totalAmount ?? totalPrice * nights
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: '#ffffff', fontFamily: "'Outfit', sans-serif" }}
      >
        <div
          className="w-full max-w-lg rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ background: '#d4d4d4', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: 'rgba(30, 39, 153, 0.1)', border: '1px solid rgba(30, 39, 153, 0.3)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l6 6L23 8" stroke="#1E7799" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p
            className="text-[#1E7799] text-xs tracking-[0.25em] uppercase mb-3"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {bookingDone ? 'Booking Confirmed' : 'Booking Hold Created'}
          </p>
          <h2 className="text-black text-3xl font-light mb-2">{bookingDone ? "You're all set." : 'Review your booking.'}</h2>
          <p className="text-black/70 text-sm mb-8">
            {bookingDone
              ? 'A confirmation has been sent to your registered email. We look forward to welcoming you.'
              : 'Your rooms are temporarily held. Submit the booking to confirm it and receive your email confirmation.'}
          </p>

          <div
            className="w-full rounded-xl p-5 mb-6 text-left"
            style={{ background: '#f7f7f7', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-black/70">Hotel</span>
              <span className="text-black text-right">The RGUKT, Nuzvid</span>
              <span className="text-black/70">Check In</span>
              <span className="text-black text-right">{new Date(checkIn).toDateString()}</span>
              <span className="text-black/70">Check Out</span>
              <span className="text-black text-right">{new Date(checkOut).toDateString()}</span>
              <span className="text-black/70">Guests</span>
              <span className="text-black text-right">{guests}</span>
              <span className="text-black/70">Rooms</span>
              <span className="text-black text-right">{summaryRooms.join(', ')}</span>
              <div className="col-span-2 h-px bg-black/5 my-1" />
              <span className="text-[#1E7799] font-semibold">Total</span>
              <span className="text-[#1E7799] font-semibold text-right">
                {formatINR(summaryTotal)}
                <span className="text-black/30 font-normal text-xs ml-1">/ {summaryNights}N</span>
              </span>
            </div>
          </div>

          {confirmationError && <p role="alert" className="mb-4 text-sm text-red-700">{confirmationError}</p>}
          {bookingDone ? (
            <button
              onClick={() => {
                setStep('landing')
                setBookingDone(false)
                setHeldBooking(null)
                setSession(null)
                setFloors(FLOORS)
              }}
              className="text-black/70 text-sm hover:text-white transition-colors"
            >
              ← Back to Home
            </button>
          ) : (
            <button
              onClick={submitBooking}
              disabled={isSubmitting}
              className="rounded-xl px-7 py-3 font-semibold text-sm text-white transition-all disabled:opacity-60"
              style={{ background: '#2c36cc' }}
            >
              {isSubmitting ? 'Submitting…' : 'Submit Booking'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Room Selector ────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col text-black overflow-hidden"
      style={{ background: '#ececec', fontFamily: "'Outfit', sans-serif" }}
    >
      {/* Top Bar */}
      <header
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-20"
        style={{
          background: '#1e5799',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={() => setStep('landing')}
          className="flex items-center gap-2 text-white hover:text-white/90 cursor-pointer transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full  flex items-center justify-center">
            <img src={logo} alt="RGUKT Logo" className="w-6 h-6 object-contain" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight"> RGUKT</span>
        </div>

        <div
          className="text-xs text-white hidden md:block"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {new Date(checkIn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} →{' '}
          {new Date(checkOut).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {guests} guest
          {guests > 1 ? 's' : ''}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        {/* Floor List — Left Panel */}
        <aside
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: 220,
            background: '#c2c1c1',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="p-4">
            <p
              className="text-[10px] tracking-[0.25em] uppercase text-black mb-3 px-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Floors
            </p>
            <div className="flex flex-col gap-1">
              {floors.map((floor) => {
                const avail = availableCount(floor)
                const sel = selectedCount(floor)
                const isActive = floor.id === selectedFloorId
                return (
                  <button
                    key={floor.id}
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={`w-full text-left rounded-xl px-3 py-3.5 transition-all duration-150 ${
                      isActive? 'bg-[rgba(219, 216, 18, 0.96)] border border-[rgba(104, 81, 13, 0.47)]'
                        : 'bg-[rgba(255,255,255,0.05)] border border-black/10 hover:bg-white/4 hover:border-black cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-semibold ${isActive ? 'text-[#0082C2]' : 'text-black/60'}`}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {floor.shortLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {sel > 0 && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                            style={{
                              background: 'rgb(130, 209, 77)',
                              color: '#0e0c0a',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {sel} ✓
                          </span>
                        )}
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                          style={{
                            background: isActive ? 'rgba(73, 243, 135, 0.51)' : 'rgba(255,255,255,0.05)',
                            color: isActive ? '#036427' : 'rgba(255,255,255,0.3)',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {avail}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xs leading-tight ${isActive ? 'text-black/70' : 'text-black/35'}`}>
                      {floor.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div
            className="mx-4 mt-2 rounded-xl p-3"
            style={{ background: '#cecbcb', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            
            {[
              { color: '#1E2799', border: '#000', text: '#1E3799', label: 'Available' },
              { color: '#46b605', border: 'rgba(201,169,110,0.6)', text: '#ac7511', label: 'Selected' },
              { color: '#222', border: 'rgba(255,255,255,0.06)', text: 'rgba(17, 17, 17, 0.8)', label: 'Booked' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ background: item.color, border: `1px solid ${item.border}` }}
                />
                <span className="text-xs text-black/40">{item.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Panel — Room Grid */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Floor Header */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 mb-1">
                <h2 className="text-black text-2xl font-light">{selectedFloor.label}</h2>
                <span
                  className="text-xs text-black/90"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {availableCount(selectedFloor)} available · {selectedFloor.rooms.filter((r) => r.status === 'unavailable').length} booked
                </span>
              </div>
              <p className="text-black/70 text-sm">{selectedFloor.description}</p>
            </div>

            {/* Screen divider (like BookMyShow) */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span
                className="text-[10px] text-black/10 tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                ROOMS
                
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 mb-8">
              {selectedFloor.rooms.map((room) => (
                <RoomCell
                  key={room.id}
                  room={room}
                  onClick={() => toggleRoom(selectedFloor.id, room.id)}
                />
              ))}
            </div>

            {/* Price grid for selected */}
            {allSelectedRooms.length > 0 && (
              <div
                className="rounded-2xl p-5 mb-6"
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p
                  className="text-[10px] tracking-[0.2em] uppercase text-[#1E7799] mb-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Selected Rooms
                </p>
                <div className="flex flex-col gap-2">
                  {allSelectedRooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span
                          className="text-white/70 font-mono"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {room.number}
                        </span>
                        <span className="text-white/30 capitalize">{room.type} · {room.view}</span>
                      </div>
                      <span className="text-white/60">
                        {formatINR(room.price)}<span className="text-white/30 text-xs">/night</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom Booking Bar */}
      {allSelectedRooms.length > 0 && (
        <div
          className="sticky bottom-0 z-20"
          style={{
            background: 'rgba(17,17,17,0.97)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-white/40 text-xs mb-0.5">
                  {allSelectedRooms.length} room{allSelectedRooms.length > 1 ? 's' : ''} · {nights} night{nights > 1 ? 's' : ''}
                </p>
                <p className="text-white font-semibold text-lg leading-none">
                  {formatINR(totalPrice * nights)}
                  <span className="text-white/30 font-normal text-sm ml-1.5">total</span>
                </p>
              </div>
              <div className="hidden md:flex gap-2 flex-wrap">
                {allSelectedRooms.map((r) => (
                  <span
                    key={r.id}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{
                      background: 'rgba(32, 41, 177, 0.27)',
                      border: '1px solid rgba(30, 39, 153, 0.2)',
                      color: '#fdfdfd',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {r.number}
                  </span>
                ))}
              </div>
            </div>

            <button
              // onClick={() => setStep('confirmation')}
              onClick = {()=> setShowLogin(true)}
              className="flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_20px_#1e1799] active:scale-95 flex-shrink-0 cursor-pointer"
              style={{ background: '#2c36cc', color: '#f8f5f5' }}
            >
              Confirm Booking
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {showLogin && (
        <Login
          onLoginSuccess={createHoldAfterVerification}
        />
      )}
    </div>
  )
}
