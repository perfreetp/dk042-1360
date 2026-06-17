import { NavLink, useLocation } from 'react-router-dom'
import { Plane, CalendarClock, Bell, Sun, Moon } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pendingCount = useStore((s) => s.getPendingNotesCount())
  const currentShift = useStore((s) => s.currentShift)
  const toggleShift = useStore((s) => s.toggleShift)
  const location = useLocation()

  return (
    <div className="h-screen w-screen flex flex-col bg-cockpit-800 font-sans">
      <header className="h-14 bg-cockpit-900 border-b border-cockpit-500 flex items-center px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber/20 flex items-center justify-center">
            <Plane className="w-4 h-4 text-amber" />
          </div>
          <h1 className="text-lg font-bold text-cockpit-50 tracking-wide">
            航材寿命件<span className="text-amber">追踪台账</span>
          </h1>
        </div>

        <nav className="flex items-center gap-1 ml-10">
          <NavLink
            to="/parts"
            className={() =>
              `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/parts' || location.pathname === '/'
                  ? 'bg-cockpit-600 text-amber'
                  : 'text-cockpit-200 hover:text-cockpit-50 hover:bg-cockpit-700'
              }`
            }
          >
            <Plane className="w-4 h-4" />
            寿命件清单
          </NavLink>
          <NavLink
            to="/schedule"
            className={() =>
              `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/schedule'
                  ? 'bg-cockpit-600 text-amber'
                  : 'text-cockpit-200 hover:text-cockpit-50 hover:bg-cockpit-700'
              }`
            }
          >
            <CalendarClock className="w-4 h-4" />
            预警排程
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={toggleShift}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              currentShift === 'night'
                ? 'bg-indigo-900/40 border-indigo-700/50 text-indigo-300'
                : 'bg-amber/10 border-amber/30 text-amber'
            }`}
          >
            {currentShift === 'night' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {currentShift === 'night' ? '夜班' : '白班'}
          </button>

          <div className="relative">
            <Bell className="w-5 h-5 text-cockpit-200" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-risk-critical text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </div>

          <div className="w-8 h-8 rounded-full bg-cockpit-600 flex items-center justify-center text-xs font-mono text-amber">
            PL
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
