import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { differenceInDays, addDays, format, parseISO, isWithinInterval, startOfDay } from 'date-fns'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  AlertTriangle,
  Calendar,
  GripVertical,
  ShoppingCart,
  Wrench,
  Merge,
  Trash2,
  MessageSquare,
  RotateCcw,
  Download,
  ChevronDown,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  AlertCircle,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  SCHEDULE_STATUS_LABELS,
  SLOT_TYPE_LABELS,
  PROGRESS_LABELS,
  PROGRESS_STEPS,
} from '@/types'
import type {
  RiskLevel,
  LifeLimitedPart,
  SlotType,
  ScheduleStatus,
  MaintenanceSlot,
  SlotProgress,
} from '@/types'
import HandoverNotePanel from '@/components/HandoverNotePanel'

function RiskIcon({ level }: { level: RiskLevel }) {
  const colorMap: Record<RiskLevel, string> = {
    critical: 'text-risk-critical',
    warning: 'text-risk-warning',
    caution: 'text-risk-caution',
  }
  return <AlertTriangle className={`w-4 h-4 ${colorMap[level]}`} />
}

function ProgressStepIcon({ progress }: { progress: SlotProgress }) {
  const icons: Record<SlotProgress, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    ordered: <ShoppingCart className="w-3 h-3" />,
    in_repair: <Truck className="w-3 h-3" />,
    waiting_install: <Package className="w-3 h-3" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
  }
  return icons[progress]
}

function DraggablePartCard({ part, level }: { part: LifeLimitedPart; level: RiskLevel }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `part-${part.id}`,
    data: { part },
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000 }
    : undefined

  const borderColors: Record<RiskLevel, string> = {
    critical: 'border-l-risk-critical',
    warning: 'border-l-risk-warning',
    caution: 'border-l-risk-caution',
  }

  const bgColors: Record<RiskLevel, string> = {
    critical: 'bg-risk-critical/5',
    warning: 'bg-risk-warning/5',
    caution: 'bg-risk-caution/5',
  }

  const daysLeft = differenceInDays(parseISO(part.calendarLifeExpiry), new Date())

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cockpit-card border-l-4 ${borderColors[level]} ${bgColors[level]} p-3 mb-2 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : 'hover:border-cockpit-400'} transition-all`}
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="mt-1 text-cockpit-400 hover:text-cockpit-200 cursor-grab">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-cockpit-50 truncate">{part.partNumber}</span>
            <RiskIcon level={level} />
          </div>
          <p className="text-xs text-cockpit-300 truncate">{part.partName}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="font-mono text-xs text-cyan">{part.installedAircraft}</span>
            <span className="text-xs text-cockpit-400">{part.installedPosition}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {part.remainingCycles > 0 && (
              <span className={`text-xs font-mono ${part.remainingCycles <= 1000 ? 'text-risk-critical' : 'text-cockpit-200'}`}>
                {part.remainingCycles.toLocaleString()}CS
              </span>
            )}
            <span className={`text-xs font-mono ${daysLeft <= 30 ? 'text-risk-critical' : daysLeft <= 60 ? 'text-risk-warning' : 'text-cockpit-200'}`}>
              {daysLeft}天
            </span>
            <span className={`tag ${part.scheduleStatus === 'none' ? 'tag-none' : part.scheduleStatus === 'need_order' ? 'tag-order' : part.scheduleStatus === 'need_repair' ? 'tag-repair' : 'tag-merge'}`}>
              {SCHEDULE_STATUS_LABELS[part.scheduleStatus]}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlotCard({
  slot,
  part,
  onRemove,
}: {
  slot: MaintenanceSlot
  part: LifeLimitedPart
  onRemove: () => void
}) {
  const updateSlotProgress = useStore((s) => s.updateSlotProgress)
  const [showProgressMenu, setShowProgressMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProgressMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const progressIndex = PROGRESS_STEPS.indexOf(slot.progress)

  const typeColors: Record<SlotType, string> = {
    order: 'tag-order',
    repair: 'tag-repair',
    merge_check: 'tag-merge',
  }

  const progressColors: Record<SlotProgress, string> = {
    pending: 'text-cockpit-400',
    ordered: 'text-blue-400',
    in_repair: 'text-orange-400',
    waiting_install: 'text-cyan',
    completed: 'text-emerald-400',
  }

  const progressBgColors: Record<SlotProgress, string> = {
    pending: 'bg-cockpit-500',
    ordered: 'bg-blue-500',
    in_repair: 'bg-orange-500',
    waiting_install: 'bg-cyan',
    completed: 'bg-emerald-500',
  }

  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-start gap-2 py-1.5 border-b border-cockpit-600/30 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-cockpit-50">{part.partNumber}</span>
            <span className={`tag text-[10px] px-1.5 py-0 ${typeColors[slot.type]}`}>
              {SLOT_TYPE_LABELS[slot.type]}
            </span>
          </div>
          <p className="text-[11px] text-cockpit-300 truncate mt-0.5">{part.partName}</p>

          <div className="mt-1.5" ref={menuRef}>
            <button
              onClick={() => setShowProgressMenu(!showProgressMenu)}
              className={`flex items-center gap-1 text-[11px] ${progressColors[slot.progress]} hover:opacity-80 transition-opacity`}
            >
              <ProgressStepIcon progress={slot.progress} />
              <span>{PROGRESS_LABELS[slot.progress]}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            <div className="mt-1 flex gap-0.5">
              {PROGRESS_STEPS.map((step, idx) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    idx <= progressIndex ? progressBgColors[slot.progress] : 'bg-cockpit-700'
                  }`}
                />
              ))}
            </div>

            {showProgressMenu && (
              <div className="absolute left-0 right-0 mt-1 bg-cockpit-800 border border-cockpit-500 rounded-md shadow-lg z-20">
                {PROGRESS_STEPS.map((step) => (
                  <button
                    key={step}
                    onClick={() => {
                      updateSlotProgress(part.id, step)
                      setShowProgressMenu(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-cockpit-700 transition-colors ${
                      slot.progress === step ? 'text-amber bg-cockpit-700/50' : 'text-cockpit-200'
                    }`}
                  >
                    <ProgressStepIcon progress={step} />
                    <span>{PROGRESS_LABELS[step]}</span>
                    {slot.progress === step && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="font-mono text-xs text-cyan shrink-0">{part.installedAircraft}</span>
        <button
          onClick={onRemove}
          className="p-0.5 rounded hover:bg-cockpit-500 text-cockpit-400 hover:text-risk-critical transition-colors shrink-0"
          title="移除排程"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function DroppableWeekSlot({
  weekStart,
  weekLabel,
  weekStartStr,
  weekEndStr,
  aircraftGroups,
}: {
  weekStart: Date
  weekLabel: string
  weekStartStr: string
  weekEndStr: string
  aircraftGroups: Array<{
    aircraft: string
    slots: Array<{ slot: MaintenanceSlot; part: LifeLimitedPart }>
    isOverloaded: boolean
  }>
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `week-${format(weekStart, 'yyyy-MM-dd')}`,
    data: { weekStart },
  })
  const removeSlotByPartId = useStore((s) => s.removeSlotByPartId)

  const totalSlots = aircraftGroups.reduce((sum, g) => sum + g.slots.length, 0)

  return (
    <div
      ref={setNodeRef}
      className={`cockpit-card p-3 min-h-[180px] transition-colors ${
        isOver ? 'border-amber/60 bg-amber/5' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-semibold text-cockpit-200 font-mono">{weekLabel}</h4>
          <p className="text-[10px] text-cockpit-400">{weekStartStr} ~ {weekEndStr}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-cockpit-400">{totalSlots}件</span>
          <Calendar className="w-3 h-3 text-cockpit-400" />
        </div>
      </div>

      {totalSlots === 0 && !isOver && (
        <div className="flex items-center justify-center h-20 border border-dashed border-cockpit-500 rounded text-cockpit-400 text-xs">
          拖入寿命件排程
        </div>
      )}

      <div className="space-y-2">
        {aircraftGroups.map((ag) => (
          <div key={ag.aircraft} className="relative">
            {ag.isOverloaded && (
              <div className="flex items-center gap-1 mb-1 text-[10px] text-risk-warning bg-risk-warning/10 px-1.5 py-0.5 rounded">
                <AlertCircle className="w-3 h-3" />
                <span>{ag.aircraft} 本周 {ag.slots.length} 件，窗口拥挤</span>
              </div>
            )}
            <div className="text-[10px] text-cockpit-400 mb-1 font-mono border-b border-cockpit-600/30 pb-0.5">
              {ag.aircraft}
            </div>
            {ag.slots.map(({ slot, part }) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                part={part}
                onRemove={() => removeSlotByPartId(part.id)}
              />
            ))}
          </div>
        ))}
      </div>

      {isOver && (
        <div className="flex items-center justify-center h-8 border border-dashed border-amber rounded mt-2 text-amber text-xs">
          释放以排入此周
        </div>
      )}
    </div>
  )
}

const SLOT_TYPE_OPTIONS: {
  value: SlotType
  label: string
  icon: React.ReactNode
  cls: string
}[] = [
  {
    value: 'order',
    label: '需订件',
    icon: <ShoppingCart className="w-3 h-3" />,
    cls: 'bg-blue-900/40 text-blue-300 border-blue-700/40 hover:bg-blue-900/60',
  },
  {
    value: 'repair',
    label: '需送修',
    icon: <Wrench className="w-3 h-3" />,
    cls: 'bg-orange-900/40 text-orange-300 border-orange-700/40 hover:bg-orange-900/60',
  },
  {
    value: 'merge_check',
    label: '合并定检',
    icon: <Merge className="w-3 h-3" />,
    cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40 hover:bg-emerald-900/60',
  },
]

const CALENDAR_PRESETS = [30, 60, 90] as const

export default function Schedule() {
  const getRiskParts = useStore((s) => s.getRiskParts)
  const getWeeksData = useStore((s) => s.getWeeksData)
  const exportScheduleReport = useStore((s) => s.exportScheduleReport)
  const riskFilter = useStore((s) => s.riskFilter)
  const setRiskFilter = useStore((s) => s.setRiskFilter)
  const addSlot = useStore((s) => s.addSlot)
  const updatePartScheduleStatus = useStore((s) => s.updatePartScheduleStatus)
  const [activePart, setActivePart] = useState<LifeLimitedPart | null>(null)
  const [scheduleModalPart, setScheduleModalPart] = useState<LifeLimitedPart | null>(null)
  const [selectedSlotType, setSelectedSlotType] = useState<SlotType>('order')
  const [selectedProgress, setSelectedProgress] = useState<SlotProgress>('pending')
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [notePartId, setNotePartId] = useState<string | null>(null)
  const [cycleInput, setCycleInput] = useState(
    riskFilter.maxRemainingCycles?.toString() || '3000'
  )

  const riskGroups = useMemo(() => getRiskParts(), [riskFilter, getRiskParts])
  const weeksData = useMemo(() => getWeeksData(), [getWeeksData])

  const weeks = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const start = startOfDay(addDays(startOfDay(new Date()), i * 7))
        const end = addDays(start, 6)
        return {
          start,
          end,
          label: `第${i + 1}周`,
          dateRange: `${format(start, 'MM/dd')} - ${format(end, 'MM/dd')}`,
        }
      }),
    []
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActivePart(null)
    const { active, over } = event
    if (!over || !active.data.current) return

    const part = active.data.current.part as LifeLimitedPart
    const overId = over.id as string

    if (overId.startsWith('week-')) {
      const weekDateStr = overId.replace('week-', '')
      setScheduleModalPart(part)
      setSelectedWeek(weekDateStr)
      setSelectedProgress('pending')
    }
  }, [])

  const handleScheduleConfirm = () => {
    if (!scheduleModalPart || !selectedWeek) return
    addSlot({
      partId: scheduleModalPart.id,
      aircraft: scheduleModalPart.installedAircraft,
      plannedDate: selectedWeek,
      type: selectedSlotType,
      note: '',
      progress: selectedProgress,
    })
    const statusMap: Record<SlotType, ScheduleStatus> = {
      order: 'need_order',
      repair: 'need_repair',
      merge_check: 'merge_check',
    }
    updatePartScheduleStatus(scheduleModalPart.id, statusMap[selectedSlotType])
    setScheduleModalPart(null)
  }

  const handleCycleChange = (val: string) => {
    setCycleInput(val)
    const num = parseInt(val)
    if (val === '') {
      setRiskFilter({ maxRemainingCycles: null })
    } else if (!isNaN(num) && num >= 0) {
      setRiskFilter({ maxRemainingCycles: num })
    }
  }

  const handleResetFilter = () => {
    setRiskFilter({ calendarDays: 60, maxRemainingCycles: 3000 })
    setCycleInput('3000')
  }

  const handleExport = () => {
    const report = exportScheduleReport()
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `寿命件排程交班报表_${format(new Date(), 'yyyyMMdd_HHmm')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      onDragStart={({ active }) => {
        if (active.data.current)
          setActivePart(active.data.current.part as LifeLimitedPart)
      }}
    >
      <div className="h-full flex">
        <div className="w-[340px] border-r border-cockpit-500 flex flex-col shrink-0 bg-cockpit-900/30">
          <div className="px-4 py-3 border-b border-cockpit-500">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber" />
              <h2 className="text-sm font-semibold text-amber">风险列表</h2>
              <button
                onClick={handleResetFilter}
                className="ml-auto p-1 rounded hover:bg-cockpit-600 text-cockpit-400 hover:text-cockpit-200 transition-colors"
                title="重置筛选"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mb-2">
              <p className="text-xs text-cockpit-400 mb-1.5">日历到期范围</p>
              <div className="flex gap-1">
                {CALENDAR_PRESETS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setRiskFilter({ calendarDays: d })}
                    className={`flex-1 cockpit-btn text-xs py-1 ${
                      riskFilter.calendarDays === d
                        ? 'bg-amber/20 text-amber border border-amber/40'
                        : 'bg-cockpit-700 text-cockpit-200 border border-cockpit-500 hover:bg-cockpit-600'
                    }`}
                  >
                    {d}天内
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <p className="text-xs text-cockpit-400 mb-1.5">剩余循环 ≤</p>
              <input
                value={cycleInput}
                onChange={(e) => handleCycleChange(e.target.value)}
                className="cockpit-input w-full"
                placeholder="输入循环阈值，留空不限制"
              />
            </div>

            <p className="text-xs text-cockpit-400">拖拽寿命件到右侧排程</p>
            <p className="text-[11px] text-cockpit-400/80 mt-1">
              显示条件: ≤{riskFilter.calendarDays}天到期
              {riskFilter.maxRemainingCycles !== null &&
                ` 或 循环≤${riskFilter.maxRemainingCycles.toLocaleString()}`}
              {riskFilter.maxRemainingCycles === null && ' (不限制循环)'}
            </p>
            <p className="text-[11px] text-emerald-400/80 mt-1">
              ✅ 已完成件自动从风险列表移除
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {riskGroups.length === 0 && (
              <div className="text-center text-cockpit-400 text-sm py-8">当前无预警件</div>
            )}
            {riskGroups.map(({ level, parts: riskParts }) => (
              <div key={level} className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <RiskIcon level={level} />
                  <span
                    className={`text-xs font-semibold ${
                      level === 'critical'
                        ? 'text-risk-critical'
                        : level === 'warning'
                          ? 'text-risk-warning'
                          : 'text-risk-caution'
                    }`}
                  >
                    {level === 'critical' ? '紧急' : level === 'warning' ? '警告' : '关注'}
                  </span>
                  <span className="text-xs text-cockpit-400">({riskParts.length})</span>
                </div>
                {riskParts.map((part) => (
                  <div key={part.id} className="relative">
                    <DraggablePartCard part={part} level={level} />
                    <button
                      onClick={() => setNotePartId(notePartId === part.id ? null : part.id)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-cockpit-600 text-cockpit-400 hover:text-amber transition-colors"
                      title="交接备注"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-cockpit-500 bg-cockpit-900/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber" />
              <h2 className="text-sm font-semibold text-amber">计划检修窗口</h2>
              <span className="text-xs text-cockpit-400 ml-2">未来 8 周排程</span>
              <span className="text-[10px] text-cockpit-400/80 ml-2">（按飞机号分组）</span>
              <button
                onClick={handleExport}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 cockpit-btn-primary text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                导出交班报表
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3">
              {weeks.map((week, idx) => {
                const weekData = weeksData[idx]
                return (
                  <DroppableWeekSlot
                    key={week.label}
                    weekStart={week.start}
                    weekLabel={week.label}
                    weekStartStr={weekData?.weekStart || ''}
                    weekEndStr={weekData?.weekEnd || ''}
                    aircraftGroups={weekData?.aircraftGroups || []}
                  />
                )
              })}
            </div>
          </div>

          {notePartId && (
            <div className="border-t border-cockpit-500 bg-cockpit-900/50 max-h-[300px] overflow-y-auto">
              <div className="px-4 py-2 flex items-center justify-between border-b border-cockpit-600/50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber" />
                  <span className="text-sm font-semibold text-amber">交接备注</span>
                </div>
                <button
                  onClick={() => setNotePartId(null)}
                  className="text-cockpit-400 hover:text-cockpit-200 text-xs"
                >
                  关闭
                </button>
              </div>
              <div className="p-4">
                <HandoverNotePanel partId={notePartId} />
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {activePart ? (
          <div className="cockpit-card border-amber/50 bg-cockpit-700/95 p-3 shadow-xl shadow-amber/10 w-[280px]">
            <div className="font-mono text-sm text-cockpit-50">{activePart.partNumber}</div>
            <div className="text-xs text-cockpit-300 mt-1">{activePart.partName}</div>
            <div className="font-mono text-xs text-cyan mt-1">{activePart.installedAircraft}</div>
          </div>
        ) : null}
      </DragOverlay>

      {scheduleModalPart && (
        <>
          <div className="drawer-overlay" onClick={() => setScheduleModalPart(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="cockpit-card w-[440px] p-6 shadow-2xl border-amber/30"
              style={{ animation: 'fadeIn 0.2s ease-out' }}
            >
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
              <h3 className="text-lg font-bold text-cockpit-50 mb-1">排入检修窗口</h3>
              <p className="text-sm text-cockpit-300 mb-4">
                <span className="font-mono text-cyan">{scheduleModalPart.partNumber}</span>
                {' '}{scheduleModalPart.partName}
                {' '}→ {scheduleModalPart.installedAircraft}
              </p>

              <div className="mb-4">
                <p className="text-xs text-cockpit-400 mb-2">选择处理方式</p>
                <div className="flex gap-2">
                  {SLOT_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedSlotType(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                        selectedSlotType === opt.value
                          ? opt.cls + ' ring-1 ring-current'
                          : 'bg-cockpit-700 text-cockpit-300 border-cockpit-500 hover:bg-cockpit-600'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-cockpit-400 mb-1">计划周</p>
                <p className="font-mono text-sm text-cockpit-50">{selectedWeek}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-cockpit-400 mb-2">处理进度</p>
                <div className="grid grid-cols-5 gap-1">
                  {PROGRESS_STEPS.map((step) => {
                    const idx = PROGRESS_STEPS.indexOf(step)
                    const isSelected = selectedProgress === step
                    const colorClass = isSelected
                      ? 'bg-amber/20 text-amber border-amber/50'
                      : 'bg-cockpit-700 text-cockpit-300 border-cockpit-500 hover:bg-cockpit-600'
                    return (
                      <button
                        key={step}
                        onClick={() => setSelectedProgress(step)}
                        className={`flex flex-col items-center gap-1 px-1.5 py-2 rounded-md text-[10px] border transition-colors ${colorClass}`}
                      >
                        <ProgressStepIcon progress={step} />
                        <span>{PROGRESS_LABELS[step]}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-emerald-400/80 mt-2">
                  ✅ 选择「已完成」后自动从风险列表移除
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={handleScheduleConfirm} className="cockpit-btn-primary">
                  确认排程
                </button>
                <button
                  onClick={() => setScheduleModalPart(null)}
                  className="cockpit-btn-secondary"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </DndContext>
  )
}
