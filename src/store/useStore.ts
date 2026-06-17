import { create } from 'zustand'
import { differenceInDays } from 'date-fns'
import type { LifeLimitedPart, MaintenanceSlot, HandoverNote, PartFilter, RiskLevel } from '@/types'
import { INITIAL_PARTS, INITIAL_SLOTS, INITIAL_NOTES } from '@/data/mockData'

interface AppState {
  parts: LifeLimitedPart[]
  slots: MaintenanceSlot[]
  notes: HandoverNote[]
  selectedPartId: string | null
  filter: PartFilter
  currentShift: 'day' | 'night'

  setSelectedPartId: (id: string | null) => void
  setFilter: (filter: Partial<PartFilter>) => void
  resetFilter: () => void
  toggleShift: () => void
  updatePartScheduleStatus: (partId: string, status: LifeLimitedPart['scheduleStatus']) => void
  addSlot: (slot: Omit<MaintenanceSlot, 'id'>) => void
  removeSlot: (slotId: string) => void
  addNote: (note: Omit<HandoverNote, 'id'>) => void
  confirmNote: (noteId: string, confirmedBy: string) => void
  resolveNote: (noteId: string, resolvedBy: string) => void

  getFilteredParts: () => LifeLimitedPart[]
  getPartById: (id: string) => LifeLimitedPart | undefined
  getNotesByPartId: (partId: string) => HandoverNote[]
  getPendingNotesCount: () => number
  getRiskParts: () => { level: RiskLevel; parts: LifeLimitedPart[] }[]
  getSlotByPartId: (partId: string) => MaintenanceSlot | undefined
}

const defaultFilter: PartFilter = {
  partNumber: '',
  serialNumber: '',
  aircraft: '',
  category: '',
  remainingCyclesMin: '',
  remainingCyclesMax: '',
  calendarDaysPreset: '',
  scheduleStatus: '',
}

export const useStore = create<AppState>((set, get) => ({
  parts: INITIAL_PARTS,
  slots: INITIAL_SLOTS,
  notes: INITIAL_NOTES,
  selectedPartId: null,
  filter: { ...defaultFilter },
  currentShift: 'day',

  setSelectedPartId: (id) => set({ selectedPartId: id }),

  setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),

  resetFilter: () => set({ filter: { ...defaultFilter } }),

  toggleShift: () => set((s) => ({ currentShift: s.currentShift === 'day' ? 'night' : 'day' })),

  updatePartScheduleStatus: (partId, status) =>
    set((s) => ({
      parts: s.parts.map((p) => (p.id === partId ? { ...p, scheduleStatus: status } : p)),
    })),

  addSlot: (slot) =>
    set((s) => ({
      slots: [...s.slots, { ...slot, id: `s${Date.now()}` }],
    })),

  removeSlot: (slotId) => set((s) => ({ slots: s.slots.filter((sl) => sl.id !== slotId) })),

  addNote: (note) =>
    set((s) => ({
      notes: [...s.notes, { ...note, id: `n${Date.now()}` }],
    })),

  confirmNote: (noteId, confirmedBy) =>
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === noteId
          ? { ...n, status: 'confirmed' as const, confirmedBy, confirmedAt: new Date().toISOString() }
          : n
      ),
    })),

  resolveNote: (noteId, resolvedBy) =>
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === noteId
          ? { ...n, status: 'resolved' as const, resolvedBy, resolvedAt: new Date().toISOString() }
          : n
      ),
    })),

  getFilteredParts: () => {
    const { parts, filter } = get()
    const now = new Date()
    return parts.filter((p) => {
      if (filter.partNumber && !p.partNumber.toLowerCase().includes(filter.partNumber.toLowerCase())) return false
      if (filter.serialNumber && !p.serialNumber.toLowerCase().includes(filter.serialNumber.toLowerCase())) return false
      if (filter.aircraft && !p.installedAircraft.toLowerCase().includes(filter.aircraft.toLowerCase())) return false
      if (filter.category && p.category !== filter.category) return false
      if (filter.scheduleStatus && p.scheduleStatus !== filter.scheduleStatus) return false
      if (filter.remainingCyclesMin) {
        const min = parseInt(filter.remainingCyclesMin)
        if (!isNaN(min) && p.remainingCycles < min) return false
      }
      if (filter.remainingCyclesMax) {
        const max = parseInt(filter.remainingCyclesMax)
        if (!isNaN(max) && p.remainingCycles > max) return false
      }
      if (filter.calendarDaysPreset) {
        const days = parseInt(filter.calendarDaysPreset)
        const daysLeft = differenceInDays(new Date(p.calendarLifeExpiry), now)
        if (daysLeft > days) return false
      }
      return true
    })
  },

  getPartById: (id) => get().parts.find((p) => p.id === id),

  getNotesByPartId: (partId) =>
    get().notes.filter((n) => n.partId === partId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  getPendingNotesCount: () => get().notes.filter((n) => n.status === 'pending').length,

  getRiskParts: () => {
    const now = new Date()
    const { parts } = get()
    const atRisk = parts.filter((p) => p.status !== 'normal')
    const critical: LifeLimitedPart[] = []
    const warning: LifeLimitedPart[] = []
    const caution: LifeLimitedPart[] = []

    for (const p of atRisk) {
      const daysLeft = differenceInDays(new Date(p.calendarLifeExpiry), now)
      if (p.status === 'expired' || p.status === 'critical' || daysLeft <= 30 || p.remainingCycles <= 1000) {
        critical.push(p)
      } else if (daysLeft <= 60 || p.remainingCycles <= 3000) {
        warning.push(p)
      } else {
        caution.push(p)
      }
    }

    const result: { level: RiskLevel; parts: LifeLimitedPart[] }[] = []
    if (critical.length) result.push({ level: 'critical', parts: critical })
    if (warning.length) result.push({ level: 'warning', parts: warning })
    if (caution.length) result.push({ level: 'caution', parts: caution })
    return result
  },

  getSlotByPartId: (partId) => get().slots.find((s) => s.partId === partId),
}))
