import { useEffect, useRef } from 'react'
import type { ReactNode, ComponentType } from 'react'
import {
  ArrowDownUp, ArrowRightLeft, Banknote, BarChart3, BookOpen, Boxes, BriefcaseBusiness,
  Building2, ChartNoAxesCombined, ChartPie, CircleDollarSign, ClipboardList,
  FileBarChart2, FileClock, FileSearch, FileSpreadsheet, FileText, FolderTree,
  Home, Landmark, Layers3, LayoutGrid, ListFilter, Network, NotebookPen,
  Receipt, Scale, Search, Settings, SquarePen, UsersRound, Wallet, X,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { PageDefinition } from './data'

const iconMap: Record<string, ComponentType<LucideProps>> = {
  home: Home, entry: SquarePen, draft: FileClock, search: FileSearch,
  voucher: Receipt, activity: ClipboardList, pie: ChartPie, scale: Scale,
  cashflow: CircleDollarSign, tax: FileSpreadsheet, network: Network,
  ledger: Building2, wallet: Wallet, folder: FolderTree, users: UsersRound,
  project: BriefcaseBusiness, inventory: Boxes, settings: Settings,
  'balance-0': FileText, 'balance-1': FileSpreadsheet, 'balance-2': FileBarChart2,
  'balance-3': Boxes, 'balance-4': ArrowDownUp, 'balance-5': Layers3, 'balance-6': Landmark,
  'detail-0': BookOpen, 'detail-1': FileSearch, 'detail-2': NotebookPen,
  'detail-3': ClipboardList, 'detail-4': ArrowRightLeft, 'detail-5': ListFilter, 'detail-6': FileSpreadsheet,
  录入: SquarePen, 管理: Search, 报表: ChartNoAxesCombined,
  余额表: BarChart3, 明细表: FileBarChart2, 设置: Settings,
  dashboard: LayoutGrid, banknote: Banknote,
}

export function AppIcon({ name, size = 24, ...props }: LucideProps & { name: string }) {
  const Icon = iconMap[name] ?? FileText
  return <Icon size={size} strokeWidth={1.7} {...props} />
}

export function Brand({ small = false }: { small?: boolean }) {
  return <svg className={`brand-mark ${small ? 'small' : ''}`} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 3 43 14v21L24 46 5 35V14Z" fill="#bd080d" />
    <path d="M24 10 37 18v13L24 39 11 31V18Z" fill="white" />
    <path d="m30 17 4 4m0-4-4 4" stroke="#bd080d" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M23 17v7l-4 3" fill="none" stroke="#e4e7ed" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
}

export function Tile({ page, onClick }: { page: PageDefinition; onClick: () => void }) {
  return <button className="app-tile" onClick={onClick} title={page.title}>
    <span className={`tile-icon ${page.accent ?? ''}`}><AppIcon name={page.icon} size={27} /></span>
    <span className="tile-label">{page.title}</span>
  </button>
}

export function EmptyState({ title = '这里还没有数据', text = '录入第一笔流水，经营就从这里开始。', action }: {
  title?: string; text?: string; action?: ReactNode
}) {
  return <div className="empty-state">
    <div className="empty-illustration"><FileSearch size={43} strokeWidth={1.25} /><span /><i /></div>
    <strong>{title}</strong><p>{text}</p>{action}
  </div>
}

export function Modal({ title, children, footer, onClose, wide = false }: {
  title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]') ?? [])
      .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)
    focusables()[0]?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const elements = focusables()
      if (!elements.length) { event.preventDefault(); return }
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler); previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭弹窗"><X size={19} /></button></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status === '已记账' || status === '已审核' ? 'posted' : status === '草稿' || status === '未审核' ? 'draft' : 'pending'}`}>
    <i />{status}
  </span>
}
