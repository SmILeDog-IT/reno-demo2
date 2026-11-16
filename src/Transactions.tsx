import { useMemo, useState } from 'react'
import {
  CheckCheck, ChevronLeft, ChevronRight, Download, FileCheck2, FilePlus2,
  Filter, MoreHorizontal, Pencil, Plus, Printer, Search, Trash2, X,
} from 'lucide-react'
import { currentMonth, exportCsv, KIND_LABEL, money, monthShift, totals } from './data'
import type { Ledger, Transaction } from './data'
import { useFinance } from './finance-context'
import { EmptyState, Modal, StatusBadge } from './ui'

interface Filters { month: string; search: string; kind: string; status: string; account: string; project: string }

export function Pagination({ count, page, pageSize, setPage, setPageSize }: {
  count: number; page: number; pageSize: number; setPage: (page: number) => void; setPageSize: (size: number) => void
}) {
  const totalPages = Math.max(Math.ceil(count / pageSize), 1)
  return <div className="pagination"><span>共 <strong>{count}</strong> 条</span><select aria-label="每页条数" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}><option value={10}>10 条 / 页</option><option value={20}>20 条 / 页</option><option value={50}>50 条 / 页</option></select><button disabled={page <= 1} className="icon-button" onClick={() => setPage(page - 1)} aria-label="上一页"><ChevronLeft size={16} /></button>{Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
    const value = start + i
    return <button key={value} className={`page-number ${page === value ? 'active' : ''}`} onClick={() => setPage(value)}>{value}</button>
  })}<button disabled={page >= totalPages} className="icon-button" onClick={() => setPage(page + 1)} aria-label="下一页"><ChevronRight size={16} /></button></div>
}

export default function Transactions({ drafts = false, title, detail = false }: { drafts?: boolean; title?: string; detail?: boolean }) {
  const { ledger, updateLedger, openPage, notify, confirm } = useFinance()
  const initial: Filters = { month: drafts ? '' : currentMonth, search: '', kind: 'all', status: 'all', account: 'all', project: 'all' }
  const [form, setForm] = useState(initial)
  const [filters, setFilters] = useState(initial)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<string[]>([])
  const [menu, setMenu] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Transaction | null>(null)
  const filtered = useMemo(() => ledger.transactions.filter((tx) => {
    if ((tx.status === '草稿') !== drafts) return false
    return (!filters.month || tx.date.startsWith(filters.month)) &&
      (filters.kind === 'all' || tx.kind === filters.kind) &&
      (filters.status === 'all' || tx.status === filters.status) &&
      (filters.account === 'all' || tx.accountId === filters.account || tx.targetAccountId === filters.account) &&
      (filters.project === 'all' || tx.project === filters.project) &&
      (!filters.search || `${tx.summary} ${tx.code} ${tx.relative} ${tx.category} ${tx.project}`.toLowerCase().includes(filters.search.trim().toLowerCase()))
  }).sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code)), [ledger.transactions, filters, drafts])
  const effectivePage = Math.max(1, Math.min(page, Math.ceil(filtered.length / pageSize)))
  const visible = filtered.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)
  const selection = selected.filter((id) => filtered.some((tx) => tx.id === id))
  const sum = totals(filtered)
  const updateForm = (key: keyof Filters, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const apply = () => { setFilters(form); setPage(1); setSelected([]); setMenu(null) }
  const reset = () => { setForm(initial); setFilters(initial); setPage(1); setSelected([]) }
  const setMonth = (value: string) => { const next = { ...filters, month: value }; setForm(next); setFilters(next); setPage(1); setSelected([]) }
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const deleteRows = (ids: string[]) => confirm('删除流水', `确定删除这 ${ids.length} 笔流水吗？关联的凭证和统计会同步更新。`, () => {
    updateLedger((current) => ({ ...current, transactions: current.transactions.filter((tx) => !ids.includes(tx.id)) }), `删除 ${ids.length} 笔流水`)
    setSelected([]); setMenu(null); setViewing(null); notify('流水已删除，相关统计已更新')
  })
  const post = (tx: Transaction) => {
    updateLedger((current) => ({ ...current, transactions: current.transactions.map((item) => item.id === tx.id ? { ...item, status: '已记账' } : item) }), `完成${tx.kind === 'income' ? '收款' : '付款'}：${tx.summary}`)
    setMenu(null); notify('收付已完成，账户余额已更新')
  }
  const generateVouchers = () => {
    const eligible = selection.filter((id) => !ledger.transactions.find((tx) => tx.id === id)?.voucherNo)
    if (!eligible.length) { notify('所选流水已有凭证，无需重复生成', 'info'); return }
    updateLedger((current) => {
      const sequences = new Map<string, number>()
      for (const tx of current.transactions) {
        if (!tx.voucherNo) continue
        const period = tx.date.slice(0, 7).replace('-', '')
        sequences.set(period, Math.max(sequences.get(period) ?? 0, Number(tx.voucherNo.split('-').at(-1)) || 0))
      }
      return { ...current, transactions: current.transactions.map((tx) => {
        if (!eligible.includes(tx.id)) return tx
        const period = tx.date.slice(0, 7).replace('-', '')
        const next = (sequences.get(period) ?? 0) + 1
        sequences.set(period, next)
        return { ...tx, reviewed: true, voucherNo: `记-${period}-${String(next).padStart(3, '0')}` }
      }) }
    }, `生成 ${eligible.length} 张记账凭证`)
    setSelected([]); notify(`已生成 ${eligible.length} 张凭证，可在凭证管理中查看`)
  }
  const exportRows = () => {
    const rows = selection.length ? filtered.filter((tx) => selection.includes(tx.id)) : filtered
    exportCsv(`${drafts ? '流水草稿' : '业务流水'}-${filters.month || '全部'}.csv`, ['日期', '流水号', '业务类型', '类别', '摘要', '往来单位', '项目', '账户', '金额（元）', '状态', '凭证号'], rows.map((tx) => [tx.date, tx.code, KIND_LABEL[tx.kind], tx.category, tx.summary, tx.relative, tx.project, ledger.accounts.find((a) => a.id === tx.accountId)?.name ?? '', (tx.amount / 100).toFixed(2), tx.status, tx.voucherNo ?? '']))
    notify(`已导出 ${rows.length} 笔流水`)
  }
  return <div className="workspace-page transactions-page">
    <div className="page-heading"><div><h1>{title ?? (drafts ? '流水草稿' : '流水管理')}</h1><p>{drafts ? '未完成的业务，留在这里慢慢补齐。' : detail ? '顺着每一笔明细，了解资金和业务的来龙去脉。' : '每一笔来往都有记录，每一分收支都有去向。'}</p></div><div className="heading-actions"><button className="button" onClick={exportRows} disabled={!filtered.length}><Download size={15} />导出</button><button className="button primary" onClick={() => openPage('entry')}><Plus size={16} />新增流水</button></div></div>
    <div className="data-panel">
      <form className="filter-panel" onSubmit={(e) => { e.preventDefault(); apply() }}>
        <div className="filter-title"><Filter size={14} />筛选条件</div>
        <div className="filter-fields"><label>期间<input type="month" value={form.month} onChange={(e) => updateForm('month', e.target.value)} /></label><label>业务类型<select value={form.kind} onChange={(e) => updateForm('kind', e.target.value)}><option value="all">全部类型</option><option value="income">收入</option><option value="expense">支出</option><option value="transfer">转账</option></select></label><label>资金账户<select value={form.account} onChange={(e) => updateForm('account', e.target.value)}><option value="all">全部账户</option>{ledger.accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label>{!drafts && <label>收付状态<select value={form.status} onChange={(e) => updateForm('status', e.target.value)}><option value="all">全部状态</option><option>已记账</option><option>待收款</option><option>待付款</option></select></label>}{detail && <label>项目<select value={form.project} onChange={(e) => updateForm('project', e.target.value)}><option value="all">全部项目</option>{ledger.projects.map((p) => <option key={p}>{p}</option>)}</select></label>}
          <label className="search-field">关键词<div className="search-input"><Search size={15} /><input aria-label="搜索流水" placeholder="摘要 / 往来 / 流水号" value={form.search} onChange={(e) => updateForm('search', e.target.value)} />{form.search && <button type="button" onClick={() => updateForm('search', '')} aria-label="清空搜索"><X size={12} /></button>}</div></label><div className="filter-buttons"><button className="button primary" type="submit">查询</button><button className="button" type="button" onClick={reset}>重置</button></div>
        </div>
      </form>
      <div className="table-toolbar"><div className="month-switch"><button className="icon-button" aria-label="上个月" onClick={() => setMonth(monthShift(filters.month || currentMonth, -1))}><ChevronLeft size={16} /></button><strong>{filters.month ? filters.month.replace('-', ' 年 ') + ' 月' : '全部期间'}</strong><button className="icon-button" aria-label="下个月" onClick={() => setMonth(monthShift(filters.month || currentMonth, 1))}><ChevronRight size={16} /></button></div><div className="table-actions">{selection.length > 0 && <span className="selected-count">已选 {selection.length} 笔</span>}{!drafts && <><button className="button small" disabled={!selection.length} onClick={generateVouchers}><FilePlus2 size={14} />生成凭证</button><button className="button small" disabled={!selection.length} onClick={() => { updateLedger((current) => ({ ...current, transactions: current.transactions.map((tx) => selection.includes(tx.id) ? { ...tx, reviewed: true } : tx) }), `审核 ${selection.length} 笔流水`); notify('所选流水已审核'); setSelected([]) }}><CheckCheck size={14} />审核</button></>}<button className="button small danger-quiet" disabled={!selection.length} onClick={() => deleteRows(selection)}><Trash2 size={14} />删除</button></div></div>
      <div className="table-scroll"><table className="data-table transaction-table"><thead><tr><th className="checkbox-cell"><input aria-label="选择本页全部流水" type="checkbox" checked={visible.length > 0 && visible.every((tx) => selection.includes(tx.id))} onChange={(e) => setSelected((current) => e.target.checked ? [...new Set([...current, ...visible.map((tx) => tx.id)])] : current.filter((id) => !visible.some((tx) => tx.id === id)))} /></th><th>日期 / 流水号</th><th>业务类型</th><th>流水类别 / 摘要</th><th>往来单位</th><th>资金账户</th><th className="text-right">金额（元）</th><th>状态</th><th className="text-center">操作</th></tr></thead><tbody>{visible.map((tx) => <tr key={tx.id} className={selection.includes(tx.id) ? 'selected-row' : ''}>
        <td className="checkbox-cell"><input type="checkbox" aria-label={`选择流水 ${tx.code}`} checked={selection.includes(tx.id)} onChange={() => toggle(tx.id)} /></td><td><span className="table-primary">{tx.date}</span><span className="table-secondary mono">{tx.code}</span></td><td><span className={`kind-badge ${tx.kind}`}>{KIND_LABEL[tx.kind]}</span></td><td className="summary-cell"><button className="table-summary" onClick={() => setViewing(tx)}>{tx.summary}</button><span className="table-secondary">{tx.category}{tx.project ? ` · ${tx.project}` : ''}</span></td><td>{tx.relative || <span className="muted">—</span>}</td><td><span>{ledger.accounts.find((a) => a.id === tx.accountId)?.name ?? '已停用账户'}</span>{tx.kind === 'transfer' && <span className="table-secondary">→ {ledger.accounts.find((a) => a.id === tx.targetAccountId)?.name}</span>}</td><td className={`text-right amount-cell ${tx.kind}`}>{tx.kind === 'income' ? '+' : tx.kind === 'expense' ? '−' : ''}{money(tx.amount)}</td><td><StatusBadge status={tx.status} />{tx.reviewed && <span className="table-secondary reviewed-label"><FileCheck2 size={11} />已审核</span>}</td><td className="row-action-cell"><button className="icon-button" title={drafts ? '继续编辑' : '编辑流水'} onClick={() => openPage('entry', tx)}><Pencil size={14} /></button><div className="row-menu-wrap"><button className="icon-button" aria-label={`更多操作 ${tx.code}`} onClick={() => setMenu(menu === tx.id ? null : tx.id)}><MoreHorizontal size={17} /></button>{menu === tx.id && <><button className="menu-dismiss" aria-label="关闭操作菜单" onClick={() => setMenu(null)} /><div className="row-menu">{(tx.status === '待收款' || tx.status === '待付款') && <button onClick={() => post(tx)}><CheckCheck size={14} />完成收付</button>}<button onClick={() => { setViewing(tx); setMenu(null) }}><Search size={14} />查看详情</button><button className="danger-text" onClick={() => deleteRows([tx.id])}><Trash2 size={14} />删除流水</button></div></>}</div></td>
      </tr>)}</tbody></table></div>
      {!visible.length && <EmptyState title={drafts ? '没有未完成的草稿' : '没有找到符合条件的流水'} text={drafts ? '新业务可以直接录入，暂时没填完的再存为草稿。' : '试试调整筛选条件，或开始录入一笔新业务。'} action={<button className="button primary-outline" onClick={() => openPage('entry')}><Plus size={14} />录入流水</button>} />}
      {!drafts && <div className="table-summary-bar"><span>筛选结果合计</span><span>收入 <strong className="income-text">¥{money(sum.income)}</strong></span><span>支出 <strong className="expense-text">¥{money(sum.expense)}</strong></span><span>收支结余 <strong>¥{money(sum.profit)}</strong></span></div>}
      <Pagination count={filtered.length} page={effectivePage} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />
    </div>
    {viewing && <Modal title="流水详情" wide onClose={() => setViewing(null)} footer={<><button className="button" onClick={() => setViewing(null)}>关闭</button><button className="button primary" onClick={() => { openPage('entry', viewing); setViewing(null) }}><Pencil size={14} />编辑流水</button></>}><div className="detail-amount"><span className={`kind-badge ${viewing.kind}`}>{KIND_LABEL[viewing.kind]}</span><strong>¥{money(viewing.amount)}</strong><StatusBadge status={viewing.status} /></div><dl className="details-grid">{[['流水号', viewing.code], ['业务日期', viewing.date], ['摘要', viewing.summary], ['流水类别', viewing.category], ['往来单位', viewing.relative || '—'], ['项目', viewing.project || '—'], ['资金账户', ledger.accounts.find((a) => a.id === viewing.accountId)?.name ?? '—'], ['凭证号', viewing.voucherNo ?? '尚未生成'], ['审核状态', viewing.reviewed ? '已审核' : '未审核']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Modal>}
  </div>
}

export function VoucherPreview({ transaction: tx, ledger }: { transaction: Transaction; ledger: Ledger }) {
  const account = ledger.accounts.find((a) => a.id === tx.accountId)
  const cashSubject = account?.type === '现金账户' ? '1001 库存现金' : '1002 银行存款'
  const debit = tx.kind === 'income' ? tx.status === '待收款' ? '1122 应收账款' : `${cashSubject} / ${account?.name ?? ''}` : tx.kind === 'transfer' ? `1002 银行存款 / ${ledger.accounts.find((a) => a.id === tx.targetAccountId)?.name ?? ''}` : tx.category === '采购支出' ? '6401 主营业务成本' : `6602 管理费用 / ${tx.category}`
  const credit = tx.kind === 'income' ? `6001 主营业务收入 / ${tx.category}` : tx.status === '待付款' ? '2202 应付账款' : `${cashSubject} / ${account?.name ?? ''}`
  return <div className="voucher-preview print-area"><h2>记 账 凭 证</h2><div className="voucher-meta"><span>单位：{ledger.name}</span><span>{tx.date}</span><strong>{tx.voucherNo}</strong></div><table className="voucher-table"><thead><tr><th>摘要</th><th>会计科目</th><th>借方金额</th><th>贷方金额</th></tr></thead><tbody><tr><td>{tx.summary}</td><td>{debit}</td><td>{money(tx.amount)}</td><td>—</td></tr><tr><td>{tx.summary}</td><td>{credit}</td><td>—</td><td>{money(tx.amount)}</td></tr><tr className="voucher-total"><td colSpan={2}>合计</td><td>{money(tx.amount)}</td><td>{money(tx.amount)}</td></tr></tbody></table><div className="voucher-signatures"><span>记账：小番</span><span>审核：{tx.reviewed ? '管理员' : '未审核'}</span><span>制单：小番</span></div></div>
}

export function Vouchers() {
  const { ledger, openPage, notify } = useFinance()
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<Transaction | null>(null)
  const rows = ledger.transactions.filter((tx) => tx.voucherNo && (!month || tx.date.startsWith(month)) && `${tx.summary} ${tx.voucherNo}`.includes(search)).sort((a, b) => b.date.localeCompare(a.date))
  return <div className="workspace-page"><div className="page-heading"><div><h1>凭证管理</h1><p>业务与凭证一一对应，记账更轻松。</p></div><div className="heading-actions"><button className="button" disabled={!rows.length} onClick={() => { exportCsv(`记账凭证-${month || '全部'}.csv`, ['日期', '凭证号', '摘要', '借方金额', '贷方金额', '审核状态'], rows.map((tx) => [tx.date, tx.voucherNo!, tx.summary, (tx.amount / 100).toFixed(2), (tx.amount / 100).toFixed(2), tx.reviewed ? '已审核' : '未审核'])); notify('记账凭证已导出') }}><Download size={15} />导出凭证</button><button className="button primary" onClick={() => openPage('transactions')}><FilePlus2 size={15} />从流水生成</button></div></div><div className="data-panel"><div className="simple-filter"><label>会计期间<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><div className="search-input"><Search size={15} /><input aria-label="搜索凭证" placeholder="搜索摘要或凭证号" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="muted">共 {rows.length} 张凭证</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>日期</th><th>凭证号</th><th>摘要</th><th className="text-right">借方金额</th><th className="text-right">贷方金额</th><th>审核状态</th><th>操作</th></tr></thead><tbody>{rows.map((tx) => <tr key={tx.id}><td>{tx.date}</td><td><button className="text-link" onClick={() => setView(tx)}>{tx.voucherNo}</button></td><td>{tx.summary}</td><td className="text-right mono">{money(tx.amount)}</td><td className="text-right mono">{money(tx.amount)}</td><td><StatusBadge status={tx.reviewed ? '已审核' : '未审核'} /></td><td><button className="text-link" onClick={() => setView(tx)}>查看凭证</button></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="这个期间还没有凭证" text="在流水管理中勾选业务流水，就可以生成记账凭证。" action={<button className="button primary-outline" onClick={() => openPage('transactions')}>去生成凭证</button>} />}</div>{view && <Modal title="凭证详情" wide onClose={() => setView(null)} footer={<><button className="button" onClick={() => setView(null)}>关闭</button><button className="button primary" onClick={() => window.print()}><Printer size={15} />打印凭证</button></>}><VoucherPreview transaction={view} ledger={ledger} /></Modal>}</div>
}
