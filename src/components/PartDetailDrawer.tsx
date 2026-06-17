import { differenceInDays, format, parseISO } from 'date-fns'
import {
  X,
  MapPin,
  Wrench,
  FileText,
  Clock,
  History,
  MessageSquare,
  Calendar,
  GitBranch,
  ShoppingCart,
  CheckCircle2,
  Trash2,
  User,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  CATEGORY_LABELS,
  SCHEDULE_STATUS_LABELS,
  PART_STATUS_LABELS,
  PLAN_HISTORY_TYPE_LABELS,
  SLOT_TYPE_LABELS,
  PROGRESS_LABELS,
} from '@/types'
import type { LifeLimitedPart, PlanHistory, PlanHistoryType } from '@/types'
import HandoverNotePanel from './HandoverNotePanel'

function StatusBadge({ status }: { status: LifeLimitedPart['status'] }) {
  const colorMap = {
    normal: 'bg-risk-normal/20 text-risk-normal border-risk-normal/30',
    warning: 'bg-risk-caution/20 text-risk-caution border-risk-caution/30',
    critical: 'bg-risk-critical/20 text-risk-critical border-risk-critical/30',
    expired: 'bg-red-900/40 text-red-300 border-red-700/40',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorMap[status]}`}>
      <span className={`status-dot status-${status}`} />
      {PART_STATUS_LABELS[status]}
    </span>
  )
}

function ScheduleTag({ status }: { status: LifeLimitedPart['scheduleStatus'] }) {
  const tagClass = {
    none: 'tag-none',
    need_order: 'tag-order',
    need_repair: 'tag-repair',
    merge_check: 'tag-merge',
  }
  return <span className={tagClass[status]}>{SCHEDULE_STATUS_LABELS[status]}</span>
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-cockpit-600/50 last:border-0">
      <span className="text-cockpit-300 text-sm w-28 shrink-0">{label}</span>
      <span className={`text-cockpit-50 text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function HistoryIcon({ type }: { type: PlanHistoryType }) {
  const icons: Record<PlanHistoryType, React.ReactNode> = {
    schedule_created: <Calendar className="w-3.5 h-3.5" />,
    schedule_rescheduled: <GitBranch className="w-3.5 h-3.5" />,
    type_changed: <Wrench className="w-3.5 h-3.5" />,
    progress_updated: <ShoppingCart className="w-3.5 h-3.5" />,
    schedule_removed: <Trash2 className="w-3.5 h-3.5" />,
    note_created: <MessageSquare className="w-3.5 h-3.5" />,
    note_confirmed: <CheckCircle2 className="w-3.5 h-3.5" />,
    note_resolved: <CheckCircle2 className="w-3.5 h-3.5" />,
  }
  return icons[type]
}

function HistoryTimelineItem({ history }: { history: PlanHistory }) {
  const colorMap: Record<PlanHistoryType, string> = {
    schedule_created: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
    schedule_rescheduled: 'text-amber bg-amber/20 border-amber/30',
    type_changed: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    progress_updated: 'text-cyan bg-cyan/20 border-cyan/30',
    schedule_removed: 'text-risk-critical bg-risk-critical/20 border-risk-critical/30',
    note_created: 'text-violet-400 bg-violet-500/20 border-violet-500/30',
    note_confirmed: 'text-sky-400 bg-sky-500/20 border-sky-500/30',
    note_resolved: 'text-teal-400 bg-teal-500/20 border-teal-500/30',
  }

  const dotColorMap: Record<PlanHistoryType, string> = {
    schedule_created: 'bg-emerald-500',
    schedule_rescheduled: 'bg-amber',
    type_changed: 'bg-blue-500',
    progress_updated: 'bg-cyan',
    schedule_removed: 'bg-risk-critical',
    note_created: 'bg-violet-500',
    note_confirmed: 'bg-sky-500',
    note_resolved: 'bg-teal-500',
  }

  return (
    <div className="relative pl-6 pb-4 last:pb-0">
      <div className={`absolute left-0 top-1 w-5 h-5 rounded-full ${colorMap[history.type]} border flex items-center justify-center`}>
        <HistoryIcon type={history.type} />
      </div>
      <div className="absolute left-[9px] top-6 bottom-0 w-px bg-cockpit-600/50" />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-cockpit-200">
          {PLAN_HISTORY_TYPE_LABELS[history.type]}
        </span>
        <span className={`text-[10px] ${colorMap[history.type].split(' ')[0]} px-1.5 py-0.5 rounded`}>
          {PLAN_HISTORY_TYPE_LABELS[history.type]}
        </span>
      </div>

      <p className="text-sm text-cockpit-300 mb-1">{history.description}</p>

      {history.details && Object.keys(history.details).length > 0 && (
        <div className="bg-cockpit-800/50 rounded px-2.5 py-1.5 mb-1">
          {Object.entries(history.details).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <span className="text-cockpit-400">{formatDetailKey(key)}:</span>
              <span className="text-cockpit-200 font-mono">{val}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-[10px] text-cockpit-400">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {history.actor}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(parseISO(history.timestamp), 'MM-dd HH:mm')}
        </span>
      </div>
    </div>
  )
}

function formatDetailKey(key: string): string {
  const map: Record<string, string> = {
    week: '周',
    oldWeek: '原周',
    newWeek: '新周',
    type: '处理方式',
    oldType: '原方式',
    newType: '新方式',
    plannedDate: '计划日期',
    oldProgress: '原进度',
    newProgress: '新进度',
    orderNo: '订单号',
    vendor: '修理厂',
  }
  return map[key] || key
}

export default function PartDetailDrawer() {
  const selectedPartId = useStore((s) => s.selectedPartId)
  const setSelectedPartId = useStore((s) => s.setSelectedPartId)
  const getPartById = useStore((s) => s.getPartById)
  const getNotesByPartId = useStore((s) => s.getNotesByPartId)
  const getPlanHistoryByPartId = useStore((s) => s.getPlanHistoryByPartId)
  const getSlotByPartId = useStore((s) => s.getSlotByPartId)

  if (!selectedPartId) return null

  const part = getPartById(selectedPartId)
  if (!part) return null

  const notes = getNotesByPartId(selectedPartId)
  const planHistory = getPlanHistoryByPartId(selectedPartId)
  const slot = getSlotByPartId(selectedPartId)
  const daysToExpiry = differenceInDays(parseISO(part.calendarLifeExpiry), new Date())
  const expiryUrgent = daysToExpiry <= 30

  return (
    <>
      <div className="drawer-overlay" onClick={() => setSelectedPartId(null)} />
      <div className="drawer-panel" style={{ animation: 'slideInRight 0.25s ease-out' }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <div className="sticky top-0 z-10 bg-cockpit-800 border-b border-cockpit-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-cockpit-50">{part.partName}</h2>
            <p className="text-sm text-cockpit-300 font-mono mt-0.5">
              {part.partNumber} / {part.serialNumber}
            </p>
          </div>
          <button
            onClick={() => setSelectedPartId(null)}
            className="p-1.5 rounded-md hover:bg-cockpit-600 text-cockpit-300 hover:text-cockpit-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div className="flex items-center gap-3">
            <StatusBadge status={part.status} />
            <ScheduleTag status={part.scheduleStatus} />
            <span className="tag bg-cockpit-600 text-cockpit-200 border border-cockpit-500">
              {CATEGORY_LABELS[part.category]}
            </span>
          </div>

          <div className={`cockpit-card p-4 ${expiryUrgent ? 'border-risk-critical/50' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-semibold text-amber">到寿倒计时</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-cockpit-300 text-xs mb-1">日历剩余</p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    daysToExpiry <= 30
                      ? 'text-risk-critical'
                      : daysToExpiry <= 60
                        ? 'text-risk-warning'
                        : 'text-cockpit-50'
                  }`}
                >
                  {daysToExpiry}
                  <span className="text-sm font-normal text-cockpit-300 ml-1">天</span>
                </p>
                <p className="text-xs text-cockpit-400 mt-1 font-mono">到期: {part.calendarLifeExpiry}</p>
              </div>
              {part.category === 'engine_llp' && (
                <div>
                  <p className="text-cockpit-300 text-xs mb-1">循环剩余</p>
                  <p
                    className={`text-2xl font-bold font-mono ${
                      part.remainingCycles <= 1000
                        ? 'text-risk-critical'
                        : part.remainingCycles <= 3000
                          ? 'text-risk-warning'
                          : 'text-cockpit-50'
                    }`}
                  >
                    {part.remainingCycles.toLocaleString()}
                    <span className="text-sm font-normal text-cockpit-300 ml-1">CS</span>
                  </p>
                  <p className="text-xs text-cockpit-400 mt-1 font-mono">
                    已用: {part.usedCycles.toLocaleString()} / {part.totalLifeCycles.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            {part.category === 'engine_llp' && (
              <div className="mt-3">
                <div className="h-2 bg-cockpit-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      part.remainingCycles / part.totalLifeCycles <= 0.1
                        ? 'bg-risk-critical'
                        : part.remainingCycles / part.totalLifeCycles <= 0.2
                          ? 'bg-risk-warning'
                          : 'bg-cyan'
                    }`}
                    style={{ width: `${(part.usedCycles / part.totalLifeCycles) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-cyan" />
              <h3 className="text-sm font-semibold text-cyan">装机信息</h3>
            </div>
            <div className="cockpit-card p-4">
              <InfoRow label="装机飞机" value={part.installedAircraft} mono />
              <InfoRow label="装机位置" value={part.installedPosition} />
              <InfoRow label="制造日期" value={part.manufacturingDate} mono />
              <InfoRow label="上次装机" value={format(parseISO(part.lastInstallDate), 'yyyy-MM-dd')} mono />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-cyan" />
              <h3 className="text-sm font-semibold text-cyan">拆装记录</h3>
            </div>
            <div className="cockpit-card p-4">
              {part.lastRemovalDate ? (
                <>
                  <InfoRow label="上次拆下" value={format(parseISO(part.lastRemovalDate), 'yyyy-MM-dd')} mono />
                  <InfoRow label="本次装机" value={format(parseISO(part.lastInstallDate), 'yyyy-MM-dd')} mono />
                </>
              ) : (
                <p className="text-cockpit-300 text-sm">
                  自装机以来未拆装 (装机日期: {format(parseISO(part.lastInstallDate), 'yyyy-MM-dd')})
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-cyan" />
              <h3 className="text-sm font-semibold text-cyan">适航文件依据</h3>
            </div>
            <div className="cockpit-card p-4">
              <p className="text-sm font-mono text-cockpit-50 leading-relaxed">
                {part.airworthinessDocRef}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-cyan" />
              <h3 className="text-sm font-semibold text-cyan">排程状态</h3>
            </div>
            <div className="cockpit-card p-4">
              <div className="flex items-center gap-3">
                <ScheduleTag status={part.scheduleStatus} />
                {slot && (
                  <>
                    <span className="text-xs text-cockpit-400">|</span>
                    <span className="text-xs text-cockpit-300">
                      处理方式: <span className="text-cockpit-50">{SLOT_TYPE_LABELS[slot.type]}</span>
                    </span>
                    <span className="text-xs text-cockpit-300">
                      进度: <span className="text-amber">{PROGRESS_LABELS[slot.progress]}</span>
                    </span>
                    <span className="text-xs text-cockpit-300 font-mono">
                      计划: {slot.plannedDate}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-semibold text-amber">计划历史</h3>
              <span className="text-[10px] text-cockpit-400 ml-1">
                ({planHistory.length} 条记录)
              </span>
            </div>
            <div className="cockpit-card p-4">
              {planHistory.length === 0 ? (
                <p className="text-sm text-cockpit-400 text-center py-4">暂无计划历史记录</p>
              ) : (
                <div className="mt-2">
                  {planHistory.map((h) => (
                    <HistoryTimelineItem key={h.id} history={h} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-semibold text-amber">交接备注</h3>
              {notes.filter((n) => n.status === 'pending').length > 0 && (
                <span className="bg-risk-critical text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {notes.filter((n) => n.status === 'pending').length}待处理
                </span>
              )}
            </div>
            <HandoverNotePanel partId={part.id} />
          </div>
        </div>
      </div>
    </>
  )
}
