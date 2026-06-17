export type PartCategory = 'engine_llp' | 'landing_gear' | 'emergency_equip'
export type PartStatus = 'normal' | 'warning' | 'critical' | 'expired'
export type ScheduleStatus = 'none' | 'need_order' | 'need_repair' | 'merge_check'
export type NoteStatus = 'pending' | 'confirmed' | 'resolved'
export type Shift = 'day' | 'night'
export type SlotType = 'order' | 'repair' | 'merge_check'
export type RiskLevel = 'critical' | 'warning' | 'caution'
export type SlotProgress = 'pending' | 'ordered' | 'in_repair' | 'waiting_install' | 'completed'
export type PlanHistoryType =
  | 'schedule_created'
  | 'schedule_rescheduled'
  | 'type_changed'
  | 'progress_updated'
  | 'schedule_removed'
  | 'note_created'
  | 'note_confirmed'
  | 'note_resolved'

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
  progress: SlotProgress
  progressUpdatedAt: string
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

export interface PlanHistory {
  id: string
  partId: string
  type: PlanHistoryType
  description: string
  actor: string
  timestamp: string
  details?: Record<string, string>
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

export const SLOT_TYPE_LABELS: Record<SlotType, string> = {
  order: '需订件',
  repair: '需送修',
  merge_check: '合并定检',
}

export const PROGRESS_LABELS: Record<SlotProgress, string> = {
  pending: '待启动',
  ordered: '已下单',
  in_repair: '送修中',
  waiting_install: '等待装机',
  completed: '已完成',
}

export const PROGRESS_STEPS: SlotProgress[] = ['pending', 'ordered', 'in_repair', 'waiting_install', 'completed']

export const PLAN_HISTORY_TYPE_LABELS: Record<PlanHistoryType, string> = {
  schedule_created: '排入计划',
  schedule_rescheduled: '改期',
  type_changed: '变更处理方式',
  progress_updated: '更新进度',
  schedule_removed: '移除排程',
  note_created: '新增交接备注',
  note_confirmed: '确认交接备注',
  note_resolved: '处理交接备注',
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

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: '紧急',
  warning: '警告',
  caution: '关注',
}
