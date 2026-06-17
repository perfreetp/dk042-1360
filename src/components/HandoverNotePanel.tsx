import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Send, CheckCircle2, CircleDot, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { NOTE_STATUS_LABELS } from '@/types'
import type { NoteStatus } from '@/types'

function StatusIcon({ status }: { status: NoteStatus }) {
  switch (status) {
    case 'pending': return <CircleDot className="w-4 h-4 text-risk-critical" />
    case 'confirmed': return <Circle className="w-4 h-4 text-amber" />
    case 'resolved': return <CheckCircle2 className="w-4 h-4 text-risk-normal" />
  }
}

function NoteCard({ note }: { note: ReturnType<typeof useStore.getState>['notes'][0] }) {
  const currentShift = useStore((s) => s.currentShift)
  const confirmNote = useStore((s) => s.confirmNote)
  const resolveNote = useStore((s) => s.resolveNote)
  const [expanded, setExpanded] = useState(note.status === 'pending')

  const statusColor: Record<NoteStatus, string> = {
    pending: 'border-l-risk-critical',
    confirmed: 'border-l-amber',
    resolved: 'border-l-risk-normal',
  }

  const author = currentShift === 'day' ? '白班计划员' : '夜班计划员'

  return (
    <div className={`cockpit-card border-l-4 ${statusColor[note.status]} mb-3 overflow-hidden`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-cockpit-600/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon status={note.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-cockpit-50">{note.author}</span>
            <span className="text-xs text-cockpit-400 font-mono">{format(parseISO(note.createdAt), 'MM-dd HH:mm')}</span>
          </div>
          <p className="text-xs text-cockpit-300 truncate mt-0.5">{note.content}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`tag ${
            note.status === 'pending' ? 'bg-risk-critical/20 text-risk-critical border border-risk-critical/30' :
            note.status === 'confirmed' ? 'bg-amber/20 text-amber border border-amber/30' :
            'bg-risk-normal/20 text-risk-normal border border-risk-normal/30'
          }`}>
            {NOTE_STATUS_LABELS[note.status]}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-cockpit-400" /> : <ChevronDown className="w-4 h-4 text-cockpit-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-cockpit-600/50 pt-3 space-y-3">
          <div>
            <p className="text-xs text-cockpit-400 mb-1">判断原因</p>
            <p className="text-sm text-cockpit-100">{note.reason}</p>
          </div>
          <div>
            <p className="text-xs text-cockpit-400 mb-1">待确认事项</p>
            <p className="text-sm text-cockpit-100">{note.pendingItems}</p>
          </div>
          <div>
            <p className="text-xs text-cockpit-400 mb-1">详细说明</p>
            <p className="text-sm text-cockpit-100">{note.content}</p>
          </div>

          {note.confirmedBy && (
            <p className="text-xs text-cockpit-400">
              确认人: <span className="text-amber">{note.confirmedBy}</span>
              {note.confirmedAt && <span className="font-mono ml-2">{format(parseISO(note.confirmedAt), 'MM-dd HH:mm')}</span>}
            </p>
          )}
          {note.resolvedBy && (
            <p className="text-xs text-cockpit-400">
              处理人: <span className="text-risk-normal">{note.resolvedBy}</span>
              {note.resolvedAt && <span className="font-mono ml-2">{format(parseISO(note.resolvedAt), 'MM-dd HH:mm')}</span>}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {note.status === 'pending' && (
              <button
                onClick={(e) => { e.stopPropagation(); confirmNote(note.id, author) }}
                className="cockpit-btn-primary text-xs"
              >
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                确认
              </button>
            )}
            {note.status === 'confirmed' && (
              <button
                onClick={(e) => { e.stopPropagation(); resolveNote(note.id, author) }}
                className="cockpit-btn text-xs bg-risk-normal/20 text-risk-normal border border-risk-normal/30 hover:bg-risk-normal/30"
              >
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                标记已处理
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HandoverNotePanel({ partId }: { partId: string }) {
  const notes = useStore((s) => s.getNotesByPartId(partId))
  const addNote = useStore((s) => s.addNote)
  const currentShift = useStore((s) => s.currentShift)
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [reason, setReason] = useState('')
  const [pendingItems, setPendingItems] = useState('')

  const handleSubmit = () => {
    if (!content.trim()) return
    addNote({
      partId,
      author: currentShift === 'day' ? '白班计划员' : '夜班计划员',
      shift: currentShift,
      content: content.trim(),
      reason: reason.trim() || '-',
      pendingItems: pendingItems.trim() || '-',
      status: 'pending',
      createdAt: new Date().toISOString(),
      confirmedBy: null,
      confirmedAt: null,
      resolvedBy: null,
      resolvedAt: null,
    })
    setContent('')
    setReason('')
    setPendingItems('')
    setShowForm(false)
  }

  return (
    <div>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="cockpit-btn-secondary w-full text-center text-xs py-2"
        >
          <Send className="w-3 h-3 inline mr-1" />
          添加交接备注
        </button>
      ) : (
        <div className="cockpit-card p-4 space-y-3">
          <div>
            <label className="text-xs text-cockpit-400 mb-1 block">判断原因 *</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="cockpit-input w-full"
              placeholder="简述判断依据..."
            />
          </div>
          <div>
            <label className="text-xs text-cockpit-400 mb-1 block">待确认事项</label>
            <input
              value={pendingItems}
              onChange={(e) => setPendingItems(e.target.value)}
              className="cockpit-input w-full"
              placeholder="需下一班确认的事项..."
            />
          </div>
          <div>
            <label className="text-xs text-cockpit-400 mb-1 block">详细说明 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="cockpit-input w-full min-h-[80px] resize-y"
              placeholder="写明处理建议和注意事项..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="cockpit-btn-primary text-xs" disabled={!content.trim()}>
              <Send className="w-3 h-3 inline mr-1" />
              提交备注
            </button>
            <button onClick={() => setShowForm(false)} className="cockpit-btn-secondary text-xs">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
