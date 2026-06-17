import { differenceInDays, format, parseISO } from 'date-fns'
import { X, MapPin, Wrench, FileText, Clock, History, MessageSquare } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CATEGORY_LABELS, SCHEDULE_STATUS_LABELS, PART_STATUS_LABELS } from '@/types'
import type { LifeLimitedPart } from '@/types'
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

export default function PartDetailDrawer() {
  const selectedPartId = useStore((s) => s.selectedPartId)
  const setSelectedPartId = useStore((s) => s.setSelectedPartId)
  const getPartById = useStore((s) => s.getPartById)
  const getNotesByPartId = useStore((s) => s.getNotesByPartId)

  if (!selectedPartId) return null

  const part = getPartById(selectedPartId)
  if (!part) return null

  const notes = getNotesByPartId(selectedPartId)
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
            <p className="text-sm text-cockpit-300 font-mono mt-0.5">{part.partNumber} / {part.serialNumber}</p>
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
                <p className={`text-2xl font-bold font-mono ${daysToExpiry <= 30 ? 'text-risk-critical' : daysToExpiry <= 60 ? 'text-risk-warning' : 'text-cockpit-50'}`}>
                  {daysToExpiry}<span className="text-sm font-normal text-cockpit-300 ml-1">天</span>
                </p>
                <p className="text-xs text-cockpit-400 mt-1 font-mono">到期: {part.calendarLifeExpiry}</p>
              </div>
              {part.category === 'engine_llp' && (
                <div>
                  <p className="text-cockpit-300 text-xs mb-1">循环剩余</p>
                  <p className={`text-2xl font-bold font-mono ${part.remainingCycles <= 1000 ? 'text-risk-critical' : part.remainingCycles <= 3000 ? 'text-risk-warning' : 'text-cockpit-50'}`}>
                    {part.remainingCycles.toLocaleString()}<span className="text-sm font-normal text-cockpit-300 ml-1">CS</span>
                  </p>
                  <p className="text-xs text-cockpit-400 mt-1 font-mono">已用: {part.usedCycles.toLocaleString()} / {part.totalLifeCycles.toLocaleString()}</p>
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
                <p className="text-cockpit-300 text-sm">自装机以来未拆装 (装机日期: {format(parseISO(part.lastInstallDate), 'yyyy-MM-dd')})</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-cyan" />
              <h3 className="text-sm font-semibold text-cyan">适航文件依据</h3>
            </div>
            <div className="cockpit-card p-4">
              <p className="text-sm font-mono text-cockpit-50 leading-relaxed">{part.airworthinessDocRef}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-cyan" />
              <h3 className="text-sm font-semibold text-cyan">排程状态</h3>
            </div>
            <div className="cockpit-card p-4">
              <ScheduleTag status={part.scheduleStatus} />
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
