import { useState, useCallback } from 'react'
import { differenceInDays, addDays, format, parseISO } from 'date-fns'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { AlertTriangle, Calendar, GripVertical, ShoppingCart, Wrench, Merge, Trash2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CATEGORY_LABELS, SCHEDULE_STATUS_LABELS } from '@/types'
import type { RiskLevel, LifeLimitedPart, SlotType, ScheduleStatus } from '@/types'
import HandoverNotePanel from '@/components/HandoverNotePanel'

function RiskIcon({ level }: { level: RiskLevel }) {
  const colorMap: Record<RiskLevel, string> = {
    critical: 'text-risk-critical',
    warning: 'text-risk-warning',
    caution: 'text-risk-caution',
  }
  return <AlertTriangle className={`w-4 h-4 ${colorMap[level]}`} />
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

function DroppableWeekSlot({ weekStart, weekLabel, partsInSlot }: { weekStart: Date; weekLabel: string; partsInSlot: LifeLimitedPart[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: `week-${format(weekStart, 'yyyy-MM-dd')}`, data: { weekStart } })
  const removeSlot = useStore((s) => s.removeSlot)
  const updatePartScheduleStatus = useStore((s) => s.updatePartScheduleStatus)

  return (
    <div
      ref={setNodeRef}
      className={`cockpit-card p-3 min-h-[120px] transition-colors ${isOver ? 'border-amber/60 bg-amber/5' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-cockpit-200 font-mono">{weekLabel}</h4>
        <Calendar className="w-3 h-3 text-cockpit-400" />
      </div>
      {partsInSlot.length === 0 && !isOver && (
        <div className="flex items-center justify-center h-16 border border-dashed border-cockpit-500 rounded text-cockpit-400 text-xs">
          拖入寿命件排程
        </div>
      )}
      {partsInSlot.map((part) => (
        <div key={part.id} className="flex items-center gap-2 py-1.5 border-b border-cockpit-600/30 last:border-0">
          <span className="font-mono text-xs text-cockpit-50">{part.partNumber}</span>
          <span className="text-xs text-cockpit-300 truncate flex-1">{part.partName}</span>
          <span className="font-mono text-xs text-cyan">{part.installedAircraft}</span>
          <span className={`tag ${part.scheduleStatus === 'need_order' ? 'tag-order' : part.scheduleStatus === 'need_repair' ? 'tag-repair' : 'tag-merge'}`}>
            {SCHEDULE_STATUS_LABELS[part.scheduleStatus]}
          </span>
          <button
            onClick={() => { removeSlot(`slot-${part.id}`); updatePartScheduleStatus(part.id, 'none') }}
            className="p-0.5 rounded hover:bg-cockpit-500 text-cockpit-400 hover:text-risk-critical transition-colors"
            title="移除排程"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      {isOver && (
        <div className="flex items-center justify-center h-8 border border-dashed border-amber rounded mt-2 text-amber text-xs">
          释放以排入此周
        </div>
      )}
    </div>
  )
}

const SLOT_TYPE_OPTIONS: { value: SlotType; label: string; icon: React.ReactNode; cls: string }[] = [
  { value: 'order', label: '需订件', icon: <ShoppingCart className="w-3 h-3" />, cls: 'bg-blue-900/40 text-blue-300 border-blue-700/40 hover:bg-blue-900/60' },
  { value: 'repair', label: '需送修', icon: <Wrench className="w-3 h-3" />, cls: 'bg-orange-900/40 text-orange-300 border-orange-700/40 hover:bg-orange-900/60' },
  { value: 'merge_check', label: '合并定检', icon: <Merge className="w-3 h-3" />, cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40 hover:bg-emerald-900/60' },
]

export default function Schedule() {
  const getRiskParts = useStore((s) => s.getRiskParts)
  const slots = useStore((s) => s.slots)
  const parts = useStore((s) => s.parts)
  const addSlot = useStore((s) => s.addSlot)
  const updatePartScheduleStatus = useStore((s) => s.updatePartScheduleStatus)
  const [activePart, setActivePart] = useState<LifeLimitedPart | null>(null)
  const [scheduleModalPart, setScheduleModalPart] = useState<LifeLimitedPart | null>(null)
  const [selectedSlotType, setSelectedSlotType] = useState<SlotType>('order')
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [notePartId, setNotePartId] = useState<string | null>(null)

  const riskGroups = getRiskParts()

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(new Date(), i * 7)
    const end = addDays(start, 6)
    return {
      start,
      end,
      label: `${format(start, 'MM/dd')} - ${format(end, 'MM/dd')}`,
    }
  })

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePart(null)
      const { active, over } = event
      if (!over || !active.data.current) return

      const part = active.data.current.part as LifeLimitedPart
      const overId = over.id as string

      if (overId.startsWith('week-')) {
        const weekDateStr = overId.replace('week-', '')
        setScheduleModalPart(part)
        setSelectedWeek(weekDateStr)
      }
    },
    []
  )

  const handleScheduleConfirm = () => {
    if (!scheduleModalPart || !selectedWeek) return
    addSlot({
      partId: scheduleModalPart.id,
      aircraft: scheduleModalPart.installedAircraft,
      plannedDate: selectedWeek,
      type: selectedSlotType,
      note: '',
    })
    const statusMap: Record<SlotType, ScheduleStatus> = {
      order: 'need_order',
      repair: 'need_repair',
      merge_check: 'merge_check',
    }
    updatePartScheduleStatus(scheduleModalPart.id, statusMap[selectedSlotType])
    setScheduleModalPart(null)
  }

  const getPartsInSlot = (weekStart: Date) => {
    const weekEnd = addDays(weekStart, 6)
    return slots
      .map((slot) => {
        const part = parts.find((p) => p.id === slot.partId)
        if (!part) return null
        const slotDate = parseISO(slot.plannedDate)
        if (slotDate >= weekStart && slotDate <= weekEnd) return part
        const d = parseISO(slot.plannedDate)
        if (format(d, 'yyyy-MM-dd') === format(weekStart, 'yyyy-MM-dd')) return part
        return null
      })
      .filter(Boolean) as LifeLimitedPart[]
  }

  return (
    <DndContext onDragEnd={handleDragEnd} onDragStart={({ active }) => {
      if (active.data.current) setActivePart(active.data.current.part as LifeLimitedPart)
    }}>
      <div className="h-full flex">
        <div className="w-[320px] border-r border-cockpit-500 flex flex-col shrink-0 bg-cockpit-900/30">
          <div className="px-4 py-3 border-b border-cockpit-500">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber" />
              <h2 className="text-sm font-semibold text-amber">风险列表</h2>
            </div>
            <p className="text-xs text-cockpit-400 mt-1">拖拽寿命件到右侧排程</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {riskGroups.length === 0 && (
              <div className="text-center text-cockpit-400 text-sm py-8">当前无预警件</div>
            )}
            {riskGroups.map(({ level, parts: riskParts }) => (
              <div key={level} className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <RiskIcon level={level} />
                  <span className={`text-xs font-semibold ${
                    level === 'critical' ? 'text-risk-critical' :
                    level === 'warning' ? 'text-risk-warning' :
                    'text-risk-caution'
                  }`}>
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
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3">
              {weeks.map((week) => (
                <DroppableWeekSlot
                  key={week.label}
                  weekStart={week.start}
                  weekLabel={week.label}
                  partsInSlot={getPartsInSlot(week.start)}
                />
              ))}
            </div>
          </div>

          {notePartId && (
            <div className="border-t border-cockpit-500 bg-cockpit-900/50 max-h-[300px] overflow-y-auto">
              <div className="px-4 py-2 flex items-center justify-between border-b border-cockpit-600/50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber" />
                  <span className="text-sm font-semibold text-amber">交接备注</span>
                </div>
                <button onClick={() => setNotePartId(null)} className="text-cockpit-400 hover:text-cockpit-200 text-xs">关闭</button>
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
            <div className="cockpit-card w-[440px] p-6 shadow-2xl border-amber/30" style={{ animation: 'fadeIn 0.2s ease-out' }}>
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
                <p className="text-xs text-cockpit-400 mb-1">计划日期</p>
                <p className="font-mono text-sm text-cockpit-50">{selectedWeek}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={handleScheduleConfirm} className="cockpit-btn-primary">
                  确认排程
                </button>
                <button onClick={() => setScheduleModalPart(null)} className="cockpit-btn-secondary">
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
