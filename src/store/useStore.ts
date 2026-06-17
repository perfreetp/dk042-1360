import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { differenceInDays, format, startOfISOWeek, addWeeks, isWithinInterval } from 'date-fns'
import type {
  LifeLimitedPart,
  MaintenanceSlot,
  HandoverNote,
  PartFilter,
  RiskLevel,
  SlotProgress,
  PlanHistory,
  PlanHistoryType,
  SlotType,
} from '@/types'
import {
  INITIAL_PARTS,
  INITIAL_SLOTS,
  INITIAL_NOTES,
  INITIAL_PLAN_HISTORY,
} from '@/data/mockData'
import {
  SLOT_TYPE_LABELS,
  PROGRESS_LABELS,
  NOTE_STATUS_LABELS,
  PART_STATUS_LABELS,
  RISK_LEVEL_LABELS,
} from '@/types'

interface RiskFilter {
  calendarDays: number
  maxRemainingCycles: number | null
}

interface AppState {
  parts: LifeLimitedPart[]
  slots: MaintenanceSlot[]
  notes: HandoverNote[]
  planHistory: PlanHistory[]
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

  addSlot: (slot: Omit<MaintenanceSlot, 'id' | 'progress' | 'progressUpdatedAt'>) => void
  removeSlotByPartId: (partId: string) => void
  updateSlotProgress: (partId: string, progress: SlotProgress) => void

  addNote: (note: Omit<HandoverNote, 'id'>) => void
  confirmNote: (noteId: string, confirmedBy: string) => void
  resolveNote: (noteId: string, resolvedBy: string) => void

  addPlanHistory: (partId: string, type: PlanHistoryType, description: string, details?: Record<string, string>) => void

  getFilteredParts: () => LifeLimitedPart[]
  getPartById: (id: string) => LifeLimitedPart | undefined
  getNotesByPartId: (partId: string) => HandoverNote[]
  getPendingNotesCount: () => number
  getRiskParts: () => { level: RiskLevel; parts: LifeLimitedPart[] }[]
  getSlotByPartId: (partId: string) => MaintenanceSlot | undefined
  getPlanHistoryByPartId: (partId: string) => PlanHistory[]

  getWeeksData: () => Array<{
    weekStart: string
    weekEnd: string
    weekLabel: string
    aircraftGroups: Array<{
      aircraft: string
      slots: Array<{ slot: MaintenanceSlot; part: LifeLimitedPart }>
      isOverloaded: boolean
    }>
  }>

  exportScheduleReport: () => string
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

function getCurrentActor(shift: 'day' | 'night'): string {
  const actors = {
    day: '陈芳(白班)',
    night: '张伟(夜班)',
  }
  return actors[shift]
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      parts: INITIAL_PARTS,
      slots: INITIAL_SLOTS,
      notes: INITIAL_NOTES,
      planHistory: INITIAL_PLAN_HISTORY,
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

      addPlanHistory: (partId, type, description, details) => {
        const actor = getCurrentActor(get().currentShift)
        set((s) => ({
          planHistory: [
            ...s.planHistory,
            {
              id: `h${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              partId,
              type,
              description,
              actor,
              timestamp: new Date().toISOString(),
              details,
            },
          ],
        }))
      },

      addSlot: (slot) =>
        set((s) => {
          const existingIdx = s.slots.findIndex((sl) => sl.partId === slot.partId)
          const now = new Date().toISOString()
          let newSlots: MaintenanceSlot[]
          const weekNumber = getWeekNumber(slot.plannedDate)
          const typeLabel = SLOT_TYPE_LABELS[slot.type]

          if (existingIdx >= 0) {
            const oldSlot = s.slots[existingIdx]
            const oldWeek = getWeekNumber(oldSlot.plannedDate)
            const oldType = SLOT_TYPE_LABELS[oldSlot.type]
            newSlots = [...s.slots]
            newSlots[existingIdx] = {
              ...slot,
              id: oldSlot.id,
              progress: oldSlot.progress,
              progressUpdatedAt: oldSlot.progressUpdatedAt,
            }

            const historyDetails: Record<string, string> = {
              week: `第${weekNumber}周`,
              type: typeLabel,
              plannedDate: slot.plannedDate,
            }

            if (oldWeek !== weekNumber && oldType === typeLabel) {
              get().addPlanHistory(
                slot.partId,
                'schedule_rescheduled',
                `改期：第${oldWeek}周 → 第${weekNumber}周`,
                { ...historyDetails, oldWeek: `第${oldWeek}周`, newWeek: `第${weekNumber}周` }
              )
            } else if (oldWeek === weekNumber && oldType !== typeLabel) {
              get().addPlanHistory(
                slot.partId,
                'type_changed',
                `变更处理方式：${oldType} → ${typeLabel}`,
                { ...historyDetails, oldType, newType: typeLabel }
              )
            } else if (oldWeek !== weekNumber && oldType !== typeLabel) {
              get().addPlanHistory(
                slot.partId,
                'schedule_rescheduled',
                `改期：第${oldWeek}周(${oldType}) → 第${weekNumber}周(${typeLabel})`,
                { ...historyDetails, oldWeek: `第${oldWeek}周`, newWeek: `第${weekNumber}周`, oldType, newType: typeLabel }
              )
            }
          } else {
            newSlots = [
              ...s.slots,
              {
                ...slot,
                id: `s${Date.now()}`,
                progress: 'pending',
                progressUpdatedAt: now,
              },
            ]
            get().addPlanHistory(
              slot.partId,
              'schedule_created',
              `排入第${weekNumber}周检修窗口，标记${typeLabel}`,
              { week: `第${weekNumber}周`, type: typeLabel, plannedDate: slot.plannedDate }
            )
          }

          const scheduleStatusMap: Record<SlotType, LifeLimitedPart['scheduleStatus']> = {
            order: 'need_order',
            repair: 'need_repair',
            merge_check: 'merge_check',
          }

          return {
            slots: newSlots,
            parts: s.parts.map((p) =>
              p.id === slot.partId ? { ...p, scheduleStatus: scheduleStatusMap[slot.type] } : p
            ),
          }
        }),

      removeSlotByPartId: (partId) =>
        set((s) => {
          const slotToRemove = s.slots.find((sl) => sl.partId === partId)
          if (!slotToRemove) return s

          get().addPlanHistory(
            partId,
            'schedule_removed',
            `从检修窗口移除排程`,
            { plannedDate: slotToRemove.plannedDate, type: SLOT_TYPE_LABELS[slotToRemove.type] }
          )

          return {
            slots: s.slots.filter((sl) => sl.partId !== partId),
            parts: s.parts.map((p) => (p.id === partId ? { ...p, scheduleStatus: 'none' as const } : p)),
          }
        }),

      updateSlotProgress: (partId, progress) =>
        set((s) => {
          const slot = s.slots.find((sl) => sl.partId === partId)
          if (!slot) return s

          const oldProgressLabel = PROGRESS_LABELS[slot.progress]
          const newProgressLabel = PROGRESS_LABELS[progress]
          const now = new Date().toISOString()

          get().addPlanHistory(
            partId,
            'progress_updated',
            `更新进度：${oldProgressLabel} → ${newProgressLabel}`,
            { oldProgress: oldProgressLabel, newProgress: newProgressLabel }
          )

          return {
            slots: s.slots.map((sl) =>
              sl.partId === partId ? { ...sl, progress, progressUpdatedAt: now } : sl
            ),
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
        const { parts, riskFilter, slots } = get()
        const { calendarDays, maxRemainingCycles } = riskFilter

        const completedPartIds = new Set(
          slots.filter((s) => s.progress === 'completed').map((s) => s.partId)
        )

        const candidates = parts.filter((p) => {
          if (completedPartIds.has(p.id)) return false
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

      getPlanHistoryByPartId: (partId) =>
        get().planHistory
          .filter((h) => h.partId === partId)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),

      getWeeksData: () => {
        const { slots, parts } = get()
        const today = new Date()
        const startOfThisWeek = startOfISOWeek(today)

        const weeks: AppState['getWeeksData']['return'] = []

        for (let w = 0; w < 8; w++) {
          const weekStart = addWeeks(startOfThisWeek, w)
          const weekEnd = addWeeks(weekStart, 1)
          const weekStartStr = format(weekStart, 'yyyy-MM-dd')
          const weekEndStr = format(addDays(weekEnd, -1), 'yyyy-MM-dd')

          const weekSlots = slots.filter((s) => {
            const planned = new Date(s.plannedDate)
            return isWithinInterval(planned, { start: weekStart, end: weekEnd })
          })

          const aircraftMap = new Map<string, Array<{ slot: MaintenanceSlot; part: LifeLimitedPart }>>()
          for (const slot of weekSlots) {
            const part = parts.find((p) => p.id === slot.partId)
            if (!part) continue
            if (!aircraftMap.has(slot.aircraft)) {
              aircraftMap.set(slot.aircraft, [])
            }
            aircraftMap.get(slot.aircraft)!.push({ slot, part })
          }

          const aircraftGroups = Array.from(aircraftMap.entries()).map(([aircraft, groupSlots]) => ({
            aircraft,
            slots: groupSlots,
            isOverloaded: groupSlots.length >= 3,
          }))

          aircraftGroups.sort((a, b) => a.aircraft.localeCompare(b.aircraft))

          weeks.push({
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            weekLabel: `第${w + 1}周`,
            aircraftGroups,
          })
        }

        return weeks
      },

      exportScheduleReport: () => {
        const { parts, riskFilter, getRiskParts, getWeeksData, getSlotByPartId } = get()
        const riskGroups = getRiskParts()
        const weeks = getWeeksData()
        const today = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

        const lines: string[] = []
        lines.push('='.repeat(100))
        lines.push('  寿命件预警排程 - 交班报表')
        lines.push(`  生成时间: ${today}`)
        lines.push(`  筛选条件: 日历≤${riskFilter.calendarDays}天 ${riskFilter.maxRemainingCycles !== null ? `| 循环≤${riskFilter.maxRemainingCycles}` : ''}`)
        lines.push('='.repeat(100))
        lines.push('')

        lines.push('【一、风险预警列表】')
        lines.push('-'.repeat(100))
        lines.push('件号            序号        件名                    飞机    位置    状态    剩余循环  到寿日期    距今天数')
        lines.push('-'.repeat(100))

        let riskCount = 0
        for (const group of riskGroups) {
          for (const p of group.parts) {
            const daysLeft = differenceInDays(new Date(p.calendarLifeExpiry), new Date())
            lines.push(
              `${p.partNumber.padEnd(16)}${p.serialNumber.padEnd(12)}${padChinese(p.partName, 24)}${p.installedAircraft.padEnd(8)}${padChinese(p.installedPosition, 8)}${PART_STATUS_LABELS[p.status].padEnd(8)}${String(p.remainingCycles).padStart(8)}  ${p.calendarLifeExpiry.padEnd(12)}${String(daysLeft).padStart(6)}天`
            )
            riskCount++
          }
        }
        lines.push(`  合计: ${riskCount} 件`)
        lines.push('')

        lines.push('【二、未来8周检修窗口排程】')
        lines.push('-'.repeat(100))

        for (const week of weeks) {
          const totalInWeek = week.aircraftGroups.reduce((sum, g) => sum + g.slots.length, 0)
          if (totalInWeek === 0) continue

          lines.push('')
          lines.push(`  ▶ ${week.weekLabel} (${week.weekStart} ~ ${week.weekEnd})`)
          lines.push('  ' + '-'.repeat(96))
          lines.push('    飞机    件号            件名                    处理方式      进度          到寿日期    剩余循环  备注')
          lines.push('  ' + '-'.repeat(96))

          for (const ag of week.aircraftGroups) {
            for (const { slot, part } of ag.slots) {
              lines.push(
                `    ${ag.aircraft.padEnd(8)}${part.partNumber.padEnd(16)}${padChinese(part.partName, 24)}${SLOT_TYPE_LABELS[slot.type].padEnd(12)}${PROGRESS_LABELS[slot.progress].padEnd(12)}${part.calendarLifeExpiry.padEnd(12)}${String(part.remainingCycles).padStart(8)}  ${slot.note || '-'}`
              )
            }
            if (ag.isOverloaded) {
              lines.push(`    ⚠️  ${ag.aircraft} 本周排程 ${ag.slots.length} 件，检修窗口拥挤！`)
            }
          }
        }

        lines.push('')
        lines.push('='.repeat(100))
        lines.push('  报表结束')
        lines.push('='.repeat(100))

        return lines.join('\n')
      },
    }),
    {
      name: 'llp-tracker-storage',
      partialize: (state) => ({
        parts: state.parts.map((p) => ({ id: p.id, scheduleStatus: p.scheduleStatus })),
        slots: state.slots,
        notes: state.notes,
        planHistory: state.planHistory,
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

function padChinese(str: string, width: number): string {
  let len = 0
  for (let i = 0; i < str.length; i++) {
    len += str.charCodeAt(i) > 127 ? 2 : 1
  }
  if (len >= width) return str
  return str + ' '.repeat(width - len)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr)
  const today = new Date()
  const startOfThisWeek = startOfISOWeek(today)
  for (let w = 0; w < 52; w++) {
    const weekStart = addWeeks(startOfThisWeek, w)
    const weekEnd = addWeeks(weekStart, 1)
    if (isWithinInterval(date, { start: weekStart, end: weekEnd })) {
      return w + 1
    }
  }
  return 1
}

function getRiskLevel(part: LifeLimitedPart): RiskLevel {
  const daysLeft = differenceInDays(new Date(part.calendarLifeExpiry), new Date())
  if (part.status === 'expired' || part.status === 'critical' || daysLeft <= 30 || (part.remainingCycles > 0 && part.remainingCycles <= 1000)) {
    return 'critical'
  } else if (daysLeft <= 60 || (part.remainingCycles > 0 && part.remainingCycles <= 3000)) {
    return 'warning'
  } else {
    return 'caution'
  }
}
