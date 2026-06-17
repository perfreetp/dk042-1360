import { useMemo, useState } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CATEGORY_LABELS, SCHEDULE_STATUS_LABELS, PART_STATUS_LABELS } from '@/types'
import type { PartCategory, ScheduleStatus, PartStatus } from '@/types'
import PartDetailDrawer from '@/components/PartDetailDrawer'

const PAGE_SIZE = 12

function StatusDot({ status }: { status: PartStatus }) {
  return <span className={`status-dot status-${status}`} />
}

function ScheduleTag({ status }: { status: ScheduleStatus }) {
  const cls = { none: 'tag-none', need_order: 'tag-order', need_repair: 'tag-repair', merge_check: 'tag-merge' }
  return <span className={cls[status]}>{SCHEDULE_STATUS_LABELS[status]}</span>
}

export default function PartsList() {
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const resetFilter = useStore((s) => s.resetFilter)
  const getFilteredParts = useStore((s) => s.getFilteredParts)
  const setSelectedPartId = useStore((s) => s.setSelectedPartId)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => getFilteredParts(), [filter, getFilteredParts])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasActiveFilter = Object.values(filter).some((v) => v !== '' && v !== undefined)

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-cockpit-500 bg-cockpit-900/50 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Filter className="w-4 h-4 text-amber" />
          <h2 className="text-sm font-semibold text-amber">筛选条件</h2>
          {hasActiveFilter && (
            <button onClick={resetFilter} className="ml-auto cockpit-btn-secondary text-xs flex items-center gap-1">
              <X className="w-3 h-3" /> 清除筛选
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cockpit-400" />
            <input
              value={filter.partNumber}
              onChange={(e) => setFilter({ partNumber: e.target.value })}
              className="cockpit-input w-full pl-8"
              placeholder="件号"
            />
          </div>
          <input
            value={filter.serialNumber}
            onChange={(e) => setFilter({ serialNumber: e.target.value })}
            className="cockpit-input"
            placeholder="序号"
          />
          <input
            value={filter.aircraft}
            onChange={(e) => setFilter({ aircraft: e.target.value })}
            className="cockpit-input"
            placeholder="装机飞机"
          />
          <select
            value={filter.category}
            onChange={(e) => setFilter({ category: e.target.value as PartCategory | '' })}
            className="cockpit-input"
          >
            <option value="">全部类别</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filter.scheduleStatus}
            onChange={(e) => setFilter({ scheduleStatus: e.target.value as ScheduleStatus | '' })}
            className="cockpit-input"
          >
            <option value="">全部排程</option>
            {Object.entries(SCHEDULE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <input
              value={filter.remainingCyclesMin}
              onChange={(e) => setFilter({ remainingCyclesMin: e.target.value })}
              className="cockpit-input w-full"
              placeholder="最小循环"
            />
            <input
              value={filter.remainingCyclesMax}
              onChange={(e) => setFilter({ remainingCyclesMax: e.target.value })}
              className="cockpit-input w-full"
              placeholder="最大循环"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-cockpit-400">日历到期预设:</span>
          {(['30', '60', '90'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilter({ calendarDaysPreset: filter.calendarDaysPreset === d ? '' : d })}
              className={`cockpit-btn text-xs ${
                filter.calendarDaysPreset === d
                  ? 'bg-amber/20 text-amber border border-amber/40'
                  : 'bg-cockpit-700 text-cockpit-200 border border-cockpit-500 hover:bg-cockpit-600'
              }`}
            >
              {d}天内
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cockpit-700 text-cockpit-200 text-xs font-medium">
              <th className="text-left px-4 py-3 w-10">状态</th>
              <th className="text-left px-4 py-3">件号</th>
              <th className="text-left px-4 py-3">序号</th>
              <th className="text-left px-4 py-3">件名</th>
              <th className="text-left px-4 py-3">类别</th>
              <th className="text-left px-4 py-3">装机飞机</th>
              <th className="text-left px-4 py-3">位置</th>
              <th className="text-right px-4 py-3">剩余循环</th>
              <th className="text-left px-4 py-3">日历到期</th>
              <th className="text-left px-4 py-3">排程</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((part, idx) => {
              const daysLeft = differenceInDays(parseISO(part.calendarLifeExpiry), new Date())
              return (
                <tr
                  key={part.id}
                  onClick={() => setSelectedPartId(part.id)}
                  className={`border-b border-cockpit-600/30 cursor-pointer transition-colors hover:bg-cockpit-600/40 ${
                    idx % 2 === 0 ? 'bg-cockpit-800/30' : ''
                  }`}
                >
                  <td className="px-4 py-3"><StatusDot status={part.status} /></td>
                  <td className="px-4 py-3 font-mono text-sm text-cockpit-50">{part.partNumber}</td>
                  <td className="px-4 py-3 font-mono text-sm text-cockpit-200">{part.serialNumber}</td>
                  <td className="px-4 py-3 text-sm text-cockpit-50">{part.partName}</td>
                  <td className="px-4 py-3 text-sm text-cockpit-200">{CATEGORY_LABELS[part.category]}</td>
                  <td className="px-4 py-3 font-mono text-sm text-cyan">{part.installedAircraft}</td>
                  <td className="px-4 py-3 text-sm text-cockpit-200">{part.installedPosition}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    <span className={
                      part.remainingCycles <= 1000 ? 'text-risk-critical font-bold' :
                      part.remainingCycles <= 3000 ? 'text-risk-warning' :
                      'text-cockpit-50'
                    }>
                      {part.remainingCycles > 0 ? part.remainingCycles.toLocaleString() : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${
                        daysLeft <= 30 ? 'text-risk-critical font-bold' :
                        daysLeft <= 60 ? 'text-risk-warning' :
                        'text-cockpit-50'
                      }`}>
                        {part.calendarLifeExpiry}
                      </span>
                      <span className={`text-xs ${
                        daysLeft <= 30 ? 'text-risk-critical' :
                        daysLeft <= 60 ? 'text-risk-warning' :
                        'text-cockpit-400'
                      }`}>
                        ({daysLeft}天)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><ScheduleTag status={part.scheduleStatus} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {paged.length === 0 && (
          <div className="flex items-center justify-center h-40 text-cockpit-400 text-sm">
            没有匹配的寿命件记录
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-cockpit-500 bg-cockpit-900/50 flex items-center justify-between shrink-0">
        <span className="text-xs text-cockpit-400">
          共 <span className="text-cockpit-50 font-mono">{filtered.length}</span> 条记录
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-cockpit-600 text-cockpit-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-cockpit-200 font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded hover:bg-cockpit-600 text-cockpit-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PartDetailDrawer />
    </div>
  )
}
