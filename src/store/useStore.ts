import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { differenceInDays, format, parseISO, startOfISOWeek, addWeeks, isWithinInterval } from 'date-fns'
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

interface WeekAircraftGroup {
  aircraft: string
  slots: Array<{ slot: MaintenanceSlot; part: LifeLimitedPart }>
  isOverloaded: boolean
}

interface WeekData {
  weekStart: string
  weekEnd: string
  weekLabel: string
  aircraftGroups: WeekAircraftGroup[]
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

  addSlot: (slot: Omit<MaintenanceSlot, 'id' | 'progress' | 'progressUpdatedAt' | 'rescheduleReason' | 'closeReason' | 'closedBy' | 'closedAt'> & { progress?: SlotProgress; rescheduleReason?: string; closeReason?: string }) => void
  removeSlotByPartId: (partId: string) => void
  updateSlotProgress: (partId: string, progress: SlotProgress, closeReason?: string) => void

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

  getWeeksData: () => WeekData[]
  isPartInWindow: (partId: string) => boolean
  getClosedParts: () => Array<{ part: LifeLimitedPart; slot: MaintenanceSlot }>
  getReportData: () => {
    unscheduled: LifeLimitedPart[]
    inWindow: Array<{ part: LifeLimitedPart; slot: MaintenanceSlot; weekLabel: string }>
    closed: Array<{ part: LifeLimitedPart; slot: MaintenanceSlot }>
  }

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
          const newProgress = slot.progress || 'pending'
          const rescheduleReason = slot.rescheduleReason || ''
          const closeReason = slot.closeReason || ''
          const isClosing = newProgress === 'completed'
          const actor = getCurrentActor(s.currentShift)

          if (existingIdx >= 0) {
            const oldSlot = s.slots[existingIdx]
            const oldWeek = getWeekNumber(oldSlot.plannedDate)
            const oldType = SLOT_TYPE_LABELS[oldSlot.type]
            const oldProgressLabel = PROGRESS_LABELS[oldSlot.progress]
            const newProgressLabel = PROGRESS_LABELS[newProgress]
            newSlots = [...s.slots]
            newSlots[existingIdx] = {
              ...oldSlot,
              ...slot,
              id: oldSlot.id,
              progress: newProgress,
              progressUpdatedAt: now,
              rescheduleReason: oldWeek !== weekNumber ? rescheduleReason : oldSlot.rescheduleReason,
              closeReason: isClosing ? closeReason || oldSlot.closeReason : oldSlot.closeReason,
              closedBy: isClosing ? actor : oldSlot.closedBy,
              closedAt: isClosing ? now : oldSlot.closedAt,
            }

            const historyDetails: Record<string, string> = {
              week: `第${weekNumber}周`,
              type: typeLabel,
              plannedDate: slot.plannedDate,
            }
            if (rescheduleReason && oldWeek !== weekNumber) {
              historyDetails.reason = rescheduleReason
            }

            if (oldWeek !== weekNumber && oldType === typeLabel) {
              const desc = rescheduleReason
                ? `改期：第${oldWeek}周 → 第${weekNumber}周（${rescheduleReason}）`
                : `改期：第${oldWeek}周 → 第${weekNumber}周`
              get().addPlanHistory(
                slot.partId,
                'schedule_rescheduled',
                desc,
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
              const desc = rescheduleReason
                ? `改期：第${oldWeek}周(${oldType}) → 第${weekNumber}周(${typeLabel})（${rescheduleReason}）`
                : `改期：第${oldWeek}周(${oldType}) → 第${weekNumber}周(${typeLabel})`
              get().addPlanHistory(
                slot.partId,
                'schedule_rescheduled',
                desc,
                { ...historyDetails, oldWeek: `第${oldWeek}周`, newWeek: `第${weekNumber}周`, oldType, newType: typeLabel }
              )
            }

            if (slot.progress && oldSlot.progress !== newProgress) {
              let progressDesc = `更新进度：${oldProgressLabel} → ${newProgressLabel}`
              const progressDetails: Record<string, string> = {
                oldProgress: oldProgressLabel,
                newProgress: newProgressLabel,
              }
              if (isClosing && closeReason) {
                progressDesc = `关闭件：${oldProgressLabel} → ${newProgressLabel}（${closeReason}）`
                progressDetails.closeReason = closeReason
                progressDetails.closedBy = actor
                progressDetails.closedAt = now
              }
              get().addPlanHistory(
                slot.partId,
                'progress_updated',
                progressDesc,
                progressDetails
              )
            }
          } else {
            newSlots = [
              ...s.slots,
              {
                ...slot,
                id: `s${Date.now()}`,
                progress: newProgress,
                progressUpdatedAt: now,
                rescheduleReason: '',
                closeReason: isClosing ? closeReason : '',
                closedBy: isClosing ? actor : null,
                closedAt: isClosing ? now : null,
              },
            ]
            let createDesc = `排入第${weekNumber}周检修窗口，标记${typeLabel}，进度：${PROGRESS_LABELS[newProgress]}`
            const createDetails: Record<string, string> = {
              week: `第${weekNumber}周`,
              type: typeLabel,
              plannedDate: slot.plannedDate,
              progress: PROGRESS_LABELS[newProgress],
            }
            if (isClosing && closeReason) {
              createDesc += `（已关闭：${closeReason}）`
              createDetails.closeReason = closeReason
              createDetails.closedBy = actor
              createDetails.closedAt = now
            }
            get().addPlanHistory(
              slot.partId,
              'schedule_created',
              createDesc,
              createDetails
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

      updateSlotProgress: (partId, progress, closeReason) =>
        set((s) => {
          const slot = s.slots.find((sl) => sl.partId === partId)
          if (!slot) return s

          const oldProgressLabel = PROGRESS_LABELS[slot.progress]
          const newProgressLabel = PROGRESS_LABELS[progress]
          const now = new Date().toISOString()
          const isClosing = progress === 'completed'
          const actor = getCurrentActor(s.currentShift)

          let desc = `更新进度：${oldProgressLabel} → ${newProgressLabel}`
          const historyDetails: Record<string, string> = {
            oldProgress: oldProgressLabel,
            newProgress: newProgressLabel,
          }

          if (isClosing && closeReason) {
            desc = `关闭件：${oldProgressLabel} → ${newProgressLabel}（${closeReason}）`
            historyDetails.closeReason = closeReason
            historyDetails.closedBy = actor
            historyDetails.closedAt = now
          }

          get().addPlanHistory(
            partId,
            'progress_updated',
            desc,
            historyDetails
          )

          return {
            slots: s.slots.map((sl) =>
              sl.partId === partId
                ? {
                    ...sl,
                    progress,
                    progressUpdatedAt: now,
                    closeReason: isClosing ? closeReason || sl.closeReason : sl.closeReason,
                    closedBy: isClosing ? actor : sl.closedBy,
                    closedAt: isClosing ? now : sl.closedAt,
                  }
                : sl
            ),
          }
        }),

      addNote: (note) => {
        set((s) => ({
          notes: [...s.notes, { ...note, id: `n${Date.now()}` }],
        }))
        get().addPlanHistory(
          note.partId,
          'note_created',
          `新增交接备注：${note.reason}`,
          { reason: note.reason, pendingItems: note.pendingItems }
        )
      },

      confirmNote: (noteId, confirmedBy) => {
        const note = get().notes.find((n) => n.id === noteId)
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === noteId
              ? { ...n, status: 'confirmed' as const, confirmedBy, confirmedAt: new Date().toISOString() }
              : n
          ),
        }))
        if (note) {
          get().addPlanHistory(
            note.partId,
            'note_confirmed',
            `确认交接备注`,
            { confirmedBy, reason: note.reason }
          )
        }
      },

      resolveNote: (noteId, resolvedBy) => {
        const note = get().notes.find((n) => n.id === noteId)
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === noteId
              ? { ...n, status: 'resolved' as const, resolvedBy, resolvedAt: new Date().toISOString() }
              : n
          ),
        }))
        if (note) {
          get().addPlanHistory(
            note.partId,
            'note_resolved',
            `处理交接备注`,
            { resolvedBy, reason: note.reason }
          )
        }
      },

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

        const weeks: WeekData[] = []

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

      isPartInWindow: (partId) => {
        const { getWeeksData } = get()
        const weeks = getWeeksData()
        for (const week of weeks) {
          for (const ag of week.aircraftGroups) {
            if (ag.slots.some((s) => s.slot.partId === partId)) {
              return true
            }
          }
        }
        return false
      },

      getClosedParts: () => {
        const { parts, slots } = get()
        const result: Array<{ part: LifeLimitedPart; slot: MaintenanceSlot }> = []
        for (const slot of slots) {
          if (slot.progress === 'completed') {
            const part = parts.find((p) => p.id === slot.partId)
            if (part) {
              result.push({ part, slot })
            }
          }
        }
        return result
      },

      getReportData: () => {
        const { getRiskParts, getWeeksData, getClosedParts, parts } = get()
        const riskGroups = getRiskParts()
        const weeks = getWeeksData()
        const closedParts = getClosedParts()

        const allRiskParts: LifeLimitedPart[] = []
        for (const group of riskGroups) {
          allRiskParts.push(...group.parts)
        }

        const inWindow: Array<{ part: LifeLimitedPart; slot: MaintenanceSlot; weekLabel: string }> = []
        const inWindowPartIds = new Set<string>()

        for (const week of weeks) {
          for (const ag of week.aircraftGroups) {
            for (const { slot, part } of ag.slots) {
              if (slot.progress !== 'completed') {
                inWindow.push({ part, slot, weekLabel: week.weekLabel })
                inWindowPartIds.add(part.id)
              }
            }
          }
        }

        const unscheduled = allRiskParts.filter((p) => !inWindowPartIds.has(p.id))

        return { unscheduled, inWindow, closed: closedParts }
      },

      exportScheduleReport: () => {
        const { parts, riskFilter, getReportData, getWeeksData, getSlotByPartId } = get()
        const reportData = getReportData()
        const weeks = getWeeksData()
        const today = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

        function getPartScheduleWeek(partId: string): string {
          const slot = getSlotByPartId(partId)
          if (!slot) return '-'
          const slotDate = new Date(slot.plannedDate)
          const startOfThisWeek = startOfISOWeek(new Date())
          for (let w = 0; w < 52; w++) {
            const ws = addWeeks(startOfThisWeek, w)
            const we = addWeeks(ws, 1)
            if (isWithinInterval(slotDate, { start: ws, end: we })) {
              return `第${w + 1}周`
            }
          }
          return '-'
        }

        function formatPartLine(
          part: LifeLimitedPart,
          slot?: MaintenanceSlot,
          weekLabel?: string,
          includeExtra: boolean = true
        ): string {
          const daysLeft = differenceInDays(new Date(part.calendarLifeExpiry), new Date())
          const realSlot = slot || getSlotByPartId(part.id)
          const weekStr = weekLabel || (realSlot ? getPartScheduleWeek(part.id) : '-')
          const typeStr = realSlot ? SLOT_TYPE_LABELS[realSlot.type] : '未排程'
          const progressStr = realSlot ? PROGRESS_LABELS[realSlot.progress] : '-'
          let line =
            `${part.partNumber.padEnd(14)}` +
            `${part.serialNumber.padEnd(12)}` +
            `${padChinese(part.partName, 20)}` +
            `${part.installedAircraft.padEnd(8)}` +
            `${padChinese(part.installedPosition, 8)}` +
            `${PART_STATUS_LABELS[part.status].padEnd(6)}` +
            `${String(part.remainingCycles).padStart(8)} ` +
            `${part.calendarLifeExpiry.padEnd(12)}` +
            `${String(daysLeft).padStart(5)}天 ` +
            `${weekStr.padEnd(6)}${typeStr.padEnd(8)}${progressStr.padEnd(8)}`

          if (includeExtra && realSlot) {
            if (realSlot.rescheduleReason) {
              line += ` [改期: ${realSlot.rescheduleReason}]`
            }
          }
          return line
        }

        function formatClosedLine(part: LifeLimitedPart, slot: MaintenanceSlot): string {
          const daysLeft = differenceInDays(new Date(part.calendarLifeExpiry), new Date())
          const weekStr = getPartScheduleWeek(part.id)
          return (
            `${part.partNumber.padEnd(14)}` +
            `${part.serialNumber.padEnd(12)}` +
            `${padChinese(part.partName, 20)}` +
            `${part.installedAircraft.padEnd(8)}` +
            `${padChinese(part.installedPosition, 8)}` +
            `${PART_STATUS_LABELS[part.status].padEnd(6)}` +
            `${String(part.remainingCycles).padStart(8)} ` +
            `${part.calendarLifeExpiry.padEnd(12)}` +
            `${String(daysLeft).padStart(5)}天 ` +
            `${weekStr.padEnd(6)}${SLOT_TYPE_LABELS[slot.type].padEnd(8)}${PROGRESS_LABELS[slot.progress].padEnd(8)}` +
            ` [关闭: ${slot.closeReason || '-'}]` +
            ` [${slot.closedBy || '-'} ${slot.closedAt ? format(parseISO(slot.closedAt), 'MM-dd HH:mm') : ''}]`
          )
        }

        const lines: string[] = []
        const totalWidth = 140

        lines.push('='.repeat(totalWidth))
        lines.push('  寿命件预警排程 - 交班报表')
        lines.push(`  生成时间: ${today}`)
        lines.push(`  筛选条件: 日历≤${riskFilter.calendarDays}天 ${riskFilter.maxRemainingCycles !== null ? `| 循环≤${riskFilter.maxRemainingCycles.toLocaleString()}` : ''}`)
        lines.push(`  风险件总数: ${reportData.unscheduled.length + reportData.inWindow.length} 件 (未排程: ${reportData.unscheduled.length} | 已排窗口: ${reportData.inWindow.length} | 已关闭: ${reportData.closed.length})`)
        lines.push('='.repeat(totalWidth))
        lines.push('')

        lines.push('【一、风险预警 - 未排程件】（未进入检修窗口的风险件）')
        lines.push('-'.repeat(totalWidth))
        lines.push('件号          序号        件名                  飞机    位置    状态  剩余循环 到寿日期      天数  排程周  处理方式  进度  备注')
        lines.push('-'.repeat(totalWidth))

        if (reportData.unscheduled.length === 0) {
          lines.push('  （无未排程风险件）')
        } else {
          for (const p of reportData.unscheduled) {
            lines.push(formatPartLine(p))
          }
        }
        lines.push(`  小计: ${reportData.unscheduled.length} 件`)
        lines.push('')

        lines.push('【二、风险预警 - 已排窗口件】（已进入检修窗口但未完成的风险件）')
        lines.push('-'.repeat(totalWidth))
        lines.push('件号          序号        件名                  飞机    位置    状态  剩余循环 到寿日期      天数  排程周  处理方式  进度  备注')
        lines.push('-'.repeat(totalWidth))

        if (reportData.inWindow.length === 0) {
          lines.push('  （无已排窗口的风险件）')
        } else {
          for (const { part, slot, weekLabel } of reportData.inWindow) {
            lines.push(formatPartLine(part, slot, weekLabel))
          }
        }
        lines.push(`  小计: ${reportData.inWindow.length} 件`)
        lines.push('')

        lines.push('【三、已完成关闭件】（进度已标记为已完成的件）')
        lines.push('-'.repeat(totalWidth))
        lines.push('件号          序号        件名                  飞机    位置    状态  剩余循环 到寿日期      天数  排程周  处理方式  进度  关闭原因和操作人')
        lines.push('-'.repeat(totalWidth))

        if (reportData.closed.length === 0) {
          lines.push('  （暂无已完成关闭的件）')
        } else {
          for (const { part, slot } of reportData.closed) {
            lines.push(formatClosedLine(part, slot))
          }
        }
        lines.push(`  小计: ${reportData.closed.length} 件`)
        lines.push('')

        lines.push('【四、未来8周检修窗口排程明细】')
        lines.push('-'.repeat(totalWidth))

        let totalScheduled = 0
        for (const week of weeks) {
          const weekTotal = week.aircraftGroups.reduce((sum, g) => sum + g.slots.length, 0)
          totalScheduled += weekTotal
          if (weekTotal === 0) continue

          lines.push('')
          lines.push(`  ▶ ${week.weekLabel} (${week.weekStart} ~ ${week.weekEnd})  [${weekTotal}件]`)
          lines.push('  ' + '-'.repeat(totalWidth - 2))
          lines.push('    件号          序号        件名                  飞机    位置    处理方式  进度      到寿日期    剩余循环  最近改期原因')
          lines.push('  ' + '-'.repeat(totalWidth - 2))

          for (const ag of week.aircraftGroups) {
            for (const { slot, part } of ag.slots) {
              const daysLeft = differenceInDays(new Date(part.calendarLifeExpiry), new Date())
              const rescheduleNote = slot.rescheduleReason ? `[${slot.rescheduleReason}]` : '-'
              lines.push(
                `    ${part.partNumber.padEnd(14)}` +
                `${part.serialNumber.padEnd(12)}` +
                `${padChinese(part.partName, 20)}` +
                `${ag.aircraft.padEnd(8)}` +
                `${padChinese(part.installedPosition, 8)}` +
                `${SLOT_TYPE_LABELS[slot.type].padEnd(10)}` +
                `${PROGRESS_LABELS[slot.progress].padEnd(10)}` +
                `${part.calendarLifeExpiry.padEnd(12)}` +
                `${String(part.remainingCycles).padStart(8)} ` +
                `${rescheduleNote}`
              )
            }
            if (ag.isOverloaded) {
              lines.push(`    ⚠️  ${ag.aircraft} 本周排程 ${ag.slots.length} 件，检修窗口拥挤，建议分散！`)
            }
          }
        }

        if (totalScheduled === 0) {
          lines.push('  （未来8周暂无排程）')
        }

        lines.push('')
        lines.push('='.repeat(totalWidth))
        lines.push(`  总计: 风险件 ${reportData.unscheduled.length + reportData.inWindow.length} 件 | 未排程 ${reportData.unscheduled.length} 件 | 已排窗口 ${reportData.inWindow.length} 件 | 已关闭 ${reportData.closed.length} 件 | 8周窗口 ${totalScheduled} 件次`)
        lines.push('='.repeat(totalWidth))

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
