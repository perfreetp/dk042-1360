import { useState } from 'react'
import { differenceInDays, format, parseISO } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Download,
  User,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  PART_STATUS_LABELS,
  SLOT_TYPE_LABELS,
  PROGRESS_LABELS,
  SCHEDULE_STATUS_LABELS,
} from '@/types'
import type { LifeLimitedPart, MaintenanceSlot } from '@/types'

interface SectionProps {
  title: string
  subtitle: string
  count: number
  icon: React.ReactNode
  colorClass: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, subtitle, count, icon, colorClass, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
          isOpen ? 'bg-cockpit-700/80' : 'bg-cockpit-700/40 hover:bg-cockpit-700/60'
        }`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-cockpit-50">{title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
              {count} 件
            </span>
          </div>
          <p className="text-xs text-cockpit-400">{subtitle}</p>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-cockpit-400" /> : <ChevronRight className="w-4 h-4 text-cockpit-400" />}
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  )
}

function PartRow({
  part,
  slot,
  weekLabel,
  showCloseInfo = false,
}: {
  part: LifeLimitedPart
  slot?: MaintenanceSlot
  weekLabel?: string
  showCloseInfo?: boolean
}) {
  const setSelectedPartId = useStore((s) => s.setSelectedPartId)
  const daysLeft = differenceInDays(new Date(part.calendarLifeExpiry), new Date())
  const typeStr = slot ? SLOT_TYPE_LABELS[slot.type] : SCHEDULE_STATUS_LABELS[part.scheduleStatus]
  const progressStr = slot ? PROGRESS_LABELS[slot.progress] : '-'
  const weekStr = weekLabel || '-'

  return (
    <div
      className="flex items-center gap-2 p-2 hover:bg-cockpit-700/50 rounded border border-cockpit-600/30 cursor-pointer transition-colors"
      onClick={() => setSelectedPartId(part.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm text-cockpit-50">{part.partNumber}</span>
          <span className="font-mono text-xs text-cockpit-400">{part.serialNumber}</span>
          <span className="text-xs text-cyan font-mono">{part.installedAircraft}</span>
          <span className="text-xs text-cockpit-400">{part.installedPosition}</span>
        </div>
        <p className="text-xs text-cockpit-300 truncate">{part.partName}</p>
        <div className="flex items-center gap-4 mt-1 text-[11px]">
          <span className={`${daysLeft <= 30 ? 'text-risk-critical' : 'text-cockpit-300'}`}>
            <Clock className="w-3 h-3 inline mr-1" />
            {daysLeft}天
          </span>
          <span className="text-cockpit-300">
            {part.calendarLifeExpiry}
          </span>
          <span className="text-cockpit-300 font-mono">
            {part.remainingCycles.toLocaleString()}CS
          </span>
          <span className="text-cockpit-400">
            排程周: <span className="text-cockpit-200">{weekStr}</span>
          </span>
          <span className="text-cockpit-400">
            处理: <span className="text-cockpit-200">{typeStr}</span>
          </span>
          <span className="text-cockpit-400">
            进度: <span className="text-amber">{progressStr}</span>
          </span>
          {slot?.rescheduleReason && (
            <span className="text-violet-400">
              [改期: {slot.rescheduleReason}]
            </span>
          )}
        </div>
        {showCloseInfo && slot && slot.closeReason && (
          <div className="mt-1 p-1.5 bg-cockpit-800/50 rounded text-[10px]">
            <span className="text-emerald-400">关闭原因: </span>
            <span className="text-cockpit-300">{slot.closeReason}</span>
            {slot.closedBy && (
              <span className="text-cockpit-400 ml-2">
                <User className="w-2.5 h-2.5 inline mr-0.5" />
                {slot.closedBy}
                {slot.closedAt && ` ${format(parseISO(slot.closedAt), 'MM-dd HH:mm')}`}
              </span>
            )}
          </div>
        )}
      </div>
      <span
        className={`status-dot ${
          part.status === 'expired'
            ? 'status-critical'
            : part.status === 'critical'
              ? 'status-critical'
              : part.status === 'warning'
                ? 'status-warning'
                : 'status-normal'
        } shrink-0`}
        title={PART_STATUS_LABELS[part.status]}
      />
    </div>
  )
}

export default function ScheduleReportPreview({ onClose }: { onClose: () => void }) {
  const getReportData = useStore((s) => s.getReportData)
  const exportScheduleReport = useStore((s) => s.exportScheduleReport)
  const riskFilter = useStore((s) => s.riskFilter)

  const reportData = getReportData()

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
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel" style={{ animation: 'slideInRight 0.25s ease-out', width: '680px' }}>
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <div className="sticky top-0 z-10 bg-cockpit-800 border-b border-cockpit-500 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber" />
              <h2 className="text-lg font-bold text-cockpit-50">交班报表预览</h2>
            </div>
            <p className="text-xs text-cockpit-400 mt-1">
              筛选: 日历≤{riskFilter.calendarDays}天
              {riskFilter.maxRemainingCycles !== null && ` | 循环≤${riskFilter.maxRemainingCycles.toLocaleString()}`}
              {' | '}
              未排程 {reportData.unscheduled.length} | 已排窗口 {reportData.inWindow.length} | 已关闭 {reportData.closed.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 cockpit-btn-primary text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              导出报表
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-cockpit-600 text-cockpit-300 hover:text-cockpit-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(100vh-80px)]">
          <Section
            title="风险预警 - 未排程件"
            subtitle="满足筛选条件，但尚未排入检修窗口的风险件"
            count={reportData.unscheduled.length}
            icon={<AlertTriangle className="w-4 h-4" />}
            colorClass="bg-risk-warning/20 text-risk-warning"
            defaultOpen={reportData.unscheduled.length > 0}
          >
            <div className="space-y-2">
              {reportData.unscheduled.length === 0 ? (
                <div className="text-center py-6 text-cockpit-400 text-sm">
                  暂无未排程的风险件
                </div>
              ) : (
                reportData.unscheduled.map((part) => (
                  <PartRow key={part.id} part={part} />
                ))
              )}
            </div>
          </Section>

          <Section
            title="风险预警 - 已排窗口件"
            subtitle="已进入检修窗口，处理中但尚未完成的风险件"
            count={reportData.inWindow.length}
            icon={<Calendar className="w-4 h-4" />}
            colorClass="bg-cyan/20 text-cyan"
            defaultOpen={reportData.inWindow.length > 0}
          >
            <div className="space-y-2">
              {reportData.inWindow.length === 0 ? (
                <div className="text-center py-6 text-cockpit-400 text-sm">
                  暂无已排窗口的风险件
                </div>
              ) : (
                reportData.inWindow.map(({ part, slot, weekLabel }) => (
                  <PartRow key={part.id} part={part} slot={slot} weekLabel={weekLabel} />
                ))
              )}
            </div>
          </Section>

          <Section
            title="已完成关闭件"
            subtitle="已标记为已完成，从风险列表移除的件"
            count={reportData.closed.length}
            icon={<CheckCircle2 className="w-4 h-4" />}
            colorClass="bg-emerald-500/20 text-emerald-400"
            defaultOpen={reportData.closed.length > 0}
          >
            <div className="space-y-2">
              {reportData.closed.length === 0 ? (
                <div className="text-center py-6 text-cockpit-400 text-sm">
                  暂无已完成关闭的件
                </div>
              ) : (
                reportData.closed.map(({ part, slot }) => (
                  <PartRow key={part.id} part={part} slot={slot} showCloseInfo />
                ))
              )}
            </div>
          </Section>

          <div className="mt-6 p-4 bg-cockpit-800/50 rounded-lg border border-cockpit-600/30">
            <h4 className="text-sm font-semibold text-cockpit-200 mb-2">分组说明</h4>
            <ul className="text-xs text-cockpit-400 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-risk-warning shrink-0">•</span>
                <span><strong>未排程件</strong>：满足筛选条件，但没有排进任何未来8周检修窗口的件。即使 scheduleStatus 是需订件/需送修，只要没有周窗口位置，也属于未排程。</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan shrink-0">•</span>
                <span><strong>已排窗口件</strong>：已排进未来8周检修窗口，且进度不是「已完成」的件。</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">•</span>
                <span><strong>已完成关闭件</strong>：进度标记为「已完成」的件，关闭时记录了关闭原因、操作人和时间。这些件不再出现在风险列表中，但仍可在详情和报表中追溯。</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
