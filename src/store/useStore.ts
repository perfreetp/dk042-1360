import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { differenceInDays } from 'date-fns'
import type { LifeLimitedPart, MaintenanceSlot, HandoverNote, PartFilter, RiskLevel } from '@/types'
import { INITIAL_PARTS, INITIAL_SLOTS, INITIAL_NOTES } from '@/data/mockData'

interface RiskFilter {
  calendarDays: number
  maxRemainingCycles: number | null
}

interface AppState {
  parts: LifeLimitedPart[]
  slots: MaintenanceSlot[]
  notes: HandoverNote[]
  selectedPartId: string | null
  filter: PartFilter
  currentShift: 'day' | 'night'
  riskFilter: RiskFilter

  setSelectedPartId: (id: string | null) => void
  setFilter: (filter: Partial<PartFilter>) => void
  resetFilter: () => void
  toggleShift: () => void
  setRiskFilter: (filter: Partial<RiskFilter>) => void
  updatePartScheduleStatus: (partId: string, status: LifeLimitedPart['scheduleStatus']) => void
  addSlot: (slot: Omit<MaintenanceSlot, 'id'>) => void
  removeSlotByPartId: (partId: string) => void
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

const defaultRiskFilter: RiskFilter = {
  calendarDays: 60,
  maxRemainingCycles: 3000,
}

function mergeParts(initial: LifeLimitedPart[], persisted: LifeLimitedPart[] | undefined): LifeLimitedPart[] {
  if (!persisted) return initial
  const persistedMap = new Map(persisted.map((p) => [p.id, p]))
  return initial.map((p) => {
    const saved = persistedMap.get(p.id)
    if (saved) {
      return { ...p, scheduleStatus: saved.scheduleStatus }
    }
    return p
  })
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      parts: INITIAL_PARTS,
      slots: INITIAL_SLOTS,
      notes: INITIAL_NOTES,
      selectedPartId: null,
      filter: { ...defaultFilter },
      currentShift: 'day',
      riskFilter: { ...defaultRiskFilter },

      setSelectedPartId: (id) => set({ selectedPartId: id }),

      setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),

      resetFilter: () => set({ filter: { ...defaultFilter } }),

      toggleShift: () => set((s) => ({ currentShift: s.currentShift === 'day' ? 'night' : 'day' })),

      setRiskFilter: (partial) => set((s) => ({ riskFilter: { ...s.riskFilter, ...partial } })),

      updatePartScheduleStatus: (partId, status) =>
        set((s) => ({
          parts: s.parts.map((p) => (p.id === partId ? { ...p, scheduleStatus: status } : p)),
        })),

      addSlot: (slot) =>
        set((s) => {
          const existingIdx = s.slots.findIndex((sl) => sl.partId === slot.partId)
          let newSlots: MaintenanceSlot[]
          if (existingIdx >= 0) {
            newSlots = [...s.slots]
            newSlots[existingIdx] = { ...slot, id: newSlots[existingIdx].id }
          } else {
            newSlots = [...s.slots, { ...slot, id: `s${Date.now()}` }]
          }
          return { slots: newSlots }
        }),

      removeSlotByPartId: (partId) =>
        set((s) => {
          const slotToRemove = s.slots.find((sl) => sl.partId === partId)
          if (!slotToRemove) return s
          return {
            slots: s.slots.filter((sl) => sl.partId !== partId),
            parts: s.parts.map((p) => (p.id === partId ? { ...p, scheduleStatus: 'none' as const } : p)),
          }
        }),

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
        const { parts, riskFilter } = get()
        const { calendarDays, maxRemainingCycles } = riskFilter

        const candidates = parts.filter((p) => {
          const daysLeft = differenceInDays(new Date(p.calendarLifeExpiry), now)
          if (daysLeft <= calendarDays) return true
          if (maxRemainingCycles !== null && p.remainingCycles > 0 && p.remainingCycles <= maxRemainingCycles) return true
          if (p.status === 'expired' || p.status === 'critical') return true
          return false
        })

        const critical: LifeLimitedPart[] = []
        const warning: LifeLimitedPart[] = []
        const caution: LifeLimitedPart[] = []

        for (const p of candidates) {
          const daysLeft = differenceInDays(new Date(p.calendarLifeExpiry), now)
          if (p.status === 'expired' || p.status === 'critical' || daysLeft <= 30 || (p.remainingCycles > 0 && p.remainingCycles <= 1000)) {
            critical.push(p)
          } else if (daysLeft <= 60 || (p.remainingCycles > 0 && p.remainingCycles <= 3000)) {
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
    }),
    {
      name: 'llp-tracker-storage',
      partialize: (state) => ({
        parts: state.parts.map((p) => ({ id: p.id, scheduleStatus: p.scheduleStatus })),
        slots: state.slots,
        notes: state.notes,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const persisted = state as unknown as { parts?: LifeLimitedPart[] }
          state.parts = mergeParts(INITIAL_PARTS, persisted.parts)
        }
      },
    }
  )
)
