export type PartCategory = 'engine_llp' | 'landing_gear' | 'emergency_equip'
export type PartStatus = 'normal' | 'warning' | 'critical' | 'expired'
export type ScheduleStatus = 'none' | 'need_order' | 'need_repair' | 'merge_check'
export type NoteStatus = 'pending' | 'confirmed' | 'resolved'
export type Shift = 'day' | 'night'
export type SlotType = 'order' | 'repair' | 'merge_check'
export type RiskLevel = 'critical' | 'warning' | 'caution'

export interface LifeLimitedPart {
  id: string
  partNumber: string
  serialNumber: string
  partName: string
  category: PartCategory
  installedAircraft: string
  installedPosition: string
  totalLifeCycles: number
  usedCycles: number
  remainingCycles: number
  calendarLifeExpiry: string
  manufacturingDate: string
  lastRemovalDate: string | null
  lastInstallDate: string
  airworthinessDocRef: string
  status: PartStatus
  scheduleStatus: ScheduleStatus
}

export interface MaintenanceSlot {
  id: string
  partId: string
  aircraft: string
  plannedDate: string
  type: SlotType
  note: string
}

export interface HandoverNote {
  id: string
  partId: string
  author: string
  shift: Shift
  content: string
  reason: string
  pendingItems: string
  status: NoteStatus
  createdAt: string
  confirmedBy: string | null
  confirmedAt: string | null
  resolvedBy: string | null
  resolvedAt: string | null
}

export interface PartFilter {
  partNumber: string
  serialNumber: string
  aircraft: string
  category: PartCategory | ''
  remainingCyclesMin: string
  remainingCyclesMax: string
  calendarDaysPreset: '' | '30' | '60' | '90'
  scheduleStatus: ScheduleStatus | ''
}

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  engine_llp: '发动机LLP',
  landing_gear: '起落架大修件',
  emergency_equip: '应急设备',
}

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  none: '未排程',
  need_order: '需订件',
  need_repair: '需送修',
  merge_check: '合并定检',
}

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  resolved: '已处理',
}

export const PART_STATUS_LABELS: Record<PartStatus, string> = {
  normal: '正常',
  warning: '预警',
  critical: '紧急',
  expired: '超期',
}
