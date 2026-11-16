import { useState } from 'react'
import { ChevronDown, ChevronUp, CircleHelp, Download, Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { accountBalance, homeWidgets, money, pageById, uid } from './data'
import type { Account, InventoryItem } from './data'
import { useFinance } from './finance-context'
import { AppIcon, EmptyState, Modal, StatusBadge } from './ui'
import { Pagination } from './Transactions'

export function HomeLayoutEditor({ hidden, order, setHidden, setOrder }: {
  hidden: string[]; order: string[]; setHidden: (hidden: string[]) => void; setOrder: (order: string[]) => void
}) {
  const move = (id: string, step: number) => {
    const column = homeWidgets.find((w) => w.id === id)?.column
    const members = order.filter((key) => homeWidgets.find((w) => w.id === key)?.column === column)
    const target = members[members.indexOf(id) + step]
    if (!target) return
    const next = [...order], from = next.indexOf(id), to = next.indexOf(target)
    ;[next[from], next[to]] = [next[to], next[from]]
    setOrder(next)
  }
  return <div className="layout-editor"><p className="modal-description">选择想要展示的组件，调整它们在工作台的位置。</p><div className="layout-columns">{['left', 'right'].map((column) => <div key={column}><h3>{column === 'left' ? '左侧组件' : '右侧组件'}</h3>{order.filter((id) => homeWidgets.find((w) => w.id === id)?.column === column).map((id, index, columnRows) => <div className="layout-row" key={id}><label><input type="checkbox" checked={!hidden.includes(id)} onChange={(e) => setHidden(e.target.checked ? hidden.filter((key) => key !== id) : [...hidden, id])} /><span>{homeWidgets.find((w) => w.id === id)?.title}</span></label><div><button className="icon-button" disabled={index === 0} aria-label={`上移${homeWidgets.find((w) => w.id === id)?.title}`} onClick={() => move(id, -1)}><ChevronUp size={15} /></button><button className="icon-button" disabled={index === columnRows.length - 1} aria-label={`下移${homeWidgets.find((w) => w.id === id)?.title}`} onClick={() => move(id, 1)}><ChevronDown size={15} /></button></div></div>)}</div>)}</div><button className="text-link" onClick={() => { setHidden([]); setOrder(homeWidgets.map((w) => w.id)) }}>恢复默认布局</button></div>
}

export default function SettingsPage({ id, onNewLedger, onHomeSettings }: { id: string; onNewLedger: () => void; onHomeSettings: () => void }) {
  if (id === 'settings-accounts') return <AccountSettings />
  if (id === 'settings-inventory') return <InventorySettings />
  if (id === 'settings-ledger') return <LedgerSettings onNew={onNewLedger} />
  if (id === 'settings-home') return <div className="workspace-page"><div className="page-heading"><div><h1>首页设置</h1><p>工作台怎么排，由你决定。</p></div></div><div className="settings-intro"><span className="settings-intro-icon"><AppIcon name="dashboard" size={42} /></span><h2>你的财务，你的工作台</h2><p>常用入口、老板驾驶舱、账户余额、财务动态……<br />选择关心的组件，按顺手的顺序摆放。</p><button className="button primary" onClick={onHomeSettings}><Settings2 size={16} />设置首页布局</button></div></div>
  return <ListSettings id={id} />
}

function LedgerSettings({ onNew }: { onNew: () => void }) {
  const { ledger, ledgers, activeId, selectLedger, updateLedger, removeLedger, notify, confirm } = useFinance()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(ledger.name)
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ format: 'xiaofan-finance-v1', exportedAt: new Date().toISOString(), ledger }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `${ledger.name}-账套备份.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('账套数据备份已导出')
  }
  return <div className="workspace-page"><div className="page-heading"><div><h1>账套设置</h1><p>一个账套，一份清晰的经营记录。</p></div><button className="button primary" onClick={onNew}><Plus size={16} />新增账套</button></div><div className="ledger-cards">{ledgers.map((item) => <div key={item.id} className={`ledger-card ${item.id === activeId ? 'active' : ''}`}><span className="ledger-card-icon"><AppIcon name="ledger" size={29} /></span><div><h2>{item.name}</h2><p>{item.version} <i />{item.transactions.filter((tx) => tx.status !== '草稿').length} 笔流水 <i />{item.accounts.length} 个账户</p></div>{item.id === activeId ? <span className="current-ledger-tag">当前账套</span> : <button className="button" onClick={() => selectLedger(item.id)}>切换账套</button>}{ledgers.length > 1 && <button className="icon-button danger-text" title="删除账套" onClick={() => confirm('删除账套', `确定删除「${item.name}」及其中的数据吗？建议先导出备份。`, () => { removeLedger(item.id); notify('账套已删除') })}><Trash2 size={16} /></button>}</div>)}</div><div className="data-panel settings-details"><h2>当前账套信息</h2><dl className="details-grid"><div><dt>账套名称</dt><dd>{ledger.name}<button className="text-link" onClick={() => { setName(ledger.name); setRenaming(true) }}>修改</button></dd></div><div><dt>版本</dt><dd>{ledger.version}</dd></div><div><dt>数据备份</dt><dd><button className="button small" onClick={exportBackup}><Download size={14} />导出账套备份</button></dd></div><div><dt>使用模式</dt><dd>体验账套 · 自由探索</dd></div></dl></div>{renaming && <Modal title="修改账套名称" onClose={() => setRenaming(false)} footer={<><button className="button" onClick={() => setRenaming(false)}>取消</button><button className="button primary" onClick={() => { const value = name.trim(); if (!value) { notify('账套名称不能为空', 'error'); return } if (ledgers.some((item) => item.id !== ledger.id && item.name === value)) { notify('已有同名账套，请换一个名称', 'error'); return } updateLedger((item) => ({ ...item, name: value }), '修改账套名称'); setRenaming(false); notify('账套名称已更新') }}>保存</button></>}><label className="form-field"><span>账套名称</span><input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label></Modal>}</div>
}

function AccountSettings() {
  const { ledger, updateLedger, notify, confirm } = useFinance()
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [form, setForm] = useState({ name: '', type: '银行账户' as Account['type'], opening: '0.00' })
  const [error, setError] = useState('')
  const edit = (account?: Account) => { setEditing(account ?? 'new'); setForm({ name: account?.name ?? '', type: account?.type ?? '银行账户', opening: ((account?.opening ?? 0) / 100).toFixed(2) }); setError('') }
  const save = () => {
    const name = form.name.trim(), previous = editing && editing !== 'new' ? editing : null
    if (!name) { setError('请填写账户名称'); return }
    if (ledger.accounts.some((a) => a.name === name && a.id !== previous?.id)) { setError('这个账户名称已经存在'); return }
    if (!Number.isFinite(Number(form.opening)) || !/^-?\d+(\.\d{1,2})?$/.test(form.opening)) { setError('请输入有效的期初余额，最多两位小数'); return }
    const account: Account = { id: previous?.id ?? uid(), name, type: form.type, opening: Math.round(Number(form.opening) * 100), enabled: previous?.enabled ?? true }
    updateLedger((current) => ({ ...current, accounts: previous ? current.accounts.map((a) => a.id === account.id ? account : a) : [...current.accounts, account] }), `${previous ? '修改' : '新增'}资金账户：${name}`)
    setEditing(null); notify('账户已保存')
  }
  const remove = (account: Account) => {
    if (ledger.transactions.some((tx) => tx.accountId === account.id || tx.targetAccountId === account.id)) { notify('该账户已有流水记录，可以停用以保留历史账目', 'info'); return }
    confirm('删除账户', `确定删除「${account.name}」吗？`, () => { updateLedger((current) => ({ ...current, accounts: current.accounts.filter((a) => a.id !== account.id) }), `删除账户：${account.name}`); notify('账户已删除') })
  }
  return <div className="workspace-page"><div className="page-heading"><div><h1>账户设置</h1><p>管理资金账户，让每一笔收付都有归属。</p></div><button className="button primary" onClick={() => edit()}><Plus size={16} />新增账户</button></div><div className="data-panel"><div className="table-scroll"><table className="data-table account-settings-table"><thead><tr><th>账户名称</th><th>账户类型</th><th className="text-right">期初余额</th><th className="text-right">当前余额</th><th>状态</th><th>操作</th></tr></thead><tbody>{ledger.accounts.map((account) => <tr key={account.id}><td><span className="account-name"><span className="mini-account-icon"><AppIcon name={account.type === '现金账户' ? 'banknote' : 'wallet'} size={17} /></span>{account.name}</span></td><td>{account.type}</td><td className="text-right mono">{money(account.opening)}</td><td className="text-right mono">{money(accountBalance(ledger, account.id))}</td><td><button className={`toggle ${account.enabled ? 'on' : ''}`} role="switch" aria-checked={account.enabled} aria-label={`${account.enabled ? '停用' : '启用'}${account.name}`} onClick={() => { updateLedger((current) => ({ ...current, accounts: current.accounts.map((a) => a.id === account.id ? { ...a, enabled: !a.enabled } : a) }), `${account.enabled ? '停用' : '启用'}账户：${account.name}`); notify(`账户已${account.enabled ? '停用' : '启用'}`) }}><i /></button><span className="toggle-label">{account.enabled ? '启用' : '停用'}</span></td><td><div className="inline-actions"><button className="text-link" onClick={() => edit(account)}><Pencil size={13} />编辑</button><button className="text-link danger-text" onClick={() => remove(account)}><Trash2 size={13} />删除</button></div></td></tr>)}</tbody></table></div>{!ledger.accounts.length && <EmptyState title="先添加一个资金账户" text="银行、现金或网络账户，都可以在这里管理。" />}</div>{editing && <Modal title={editing === 'new' ? '新增资金账户' : '编辑资金账户'} onClose={() => setEditing(null)} footer={<><button className="button" onClick={() => setEditing(null)}>取消</button><button className="button primary" onClick={save}>保存账户</button></>}><div className="modal-form"><label className="form-field"><span>账户名称 <b>*</b></span><input value={form.name} maxLength={40} placeholder="例如：招商银行基本户" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label><label className="form-field"><span>账户类型</span><select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Account['type'] }))}><option>银行账户</option><option>现金账户</option><option>网络账户</option></select></label><label className="form-field"><span>期初余额（元）</span><input type="number" step="0.01" value={form.opening} onChange={(e) => setForm((f) => ({ ...f, opening: e.target.value }))} /></label><p className="muted form-note">当前余额 = 期初余额 + 已收款 − 已付款 + 账户转账。</p>{error && <div role="alert" className="form-error">{error}</div>}</div></Modal>}</div>
}

function ListSettings({ id }: { id: string }) {
  const { ledger, updateLedger, notify, confirm } = useFinance()
  const [categoryKind, setCategoryKind] = useState<'income' | 'expense'>('income')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const category = id === 'settings-categories'
  const project = id === 'settings-projects'
  const title = pageById(id).title
  const entries = category ? ledger.categories[categoryKind] : project ? ledger.projects : ledger.relatives
  const field = category ? 'category' : project ? 'project' : 'relative'
  const count = (name: string) => ledger.transactions.filter((tx) => tx[field] === name).length
  const change = (next: string[], rename?: { from: string; to: string }) => updateLedger((current) => ({
    ...current,
    ...(category ? { categories: { ...current.categories, [categoryKind]: next } } : project ? { projects: next } : { relatives: next }),
    transactions: rename ? current.transactions.map((tx) => tx[field] === rename.from ? { ...tx, [field]: rename.to } : tx) : current.transactions,
  }), `${rename ? '修改' : '更新'}${title}`)
  const save = () => {
    const name = value.trim()
    if (!name) { setError('名称不能为空'); return }
    if (entries.some((item) => item === name && item !== editing)) { setError('已经有同名资料了'); return }
    if (editing) change(entries.map((item) => item === editing ? name : item), { from: editing, to: name })
    else change([...entries, name])
    setEditing(null); notify('资料已保存')
  }
  return <div className="workspace-page"><div className="page-heading"><div><h1>{title}</h1><p>{category ? '把收支分好类，统计自然更清楚。' : project ? '按项目管理业务，经营投入看得见。' : '客户、供应商与合作伙伴，一处管理。'}</p></div><button className="button primary" onClick={() => { setEditing(''); setValue(''); setError('') }}><Plus size={15} />新增{category ? '类别' : project ? '项目' : '往来单位'}</button></div><div className="data-panel"><div className="simple-filter">{category && <div className="compact-tabs"><button className={categoryKind === 'income' ? 'active' : ''} onClick={() => setCategoryKind('income')}>收入类别</button><button className={categoryKind === 'expense' ? 'active' : ''} onClick={() => setCategoryKind('expense')}>支出类别</button></div>}<div className="search-input"><Search size={15} /><input aria-label={`搜索${title}`} placeholder="搜索名称" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="muted">共 {entries.length} 项</span></div><table className="data-table"><thead><tr><th>名称</th><th>关联流水</th><th>状态</th><th>操作</th></tr></thead><tbody>{entries.filter((entry) => entry.includes(search)).map((entry) => <tr key={entry}><td><span className="account-name"><span className="mini-account-icon"><AppIcon name={category ? 'folder' : project ? 'project' : 'users'} size={17} /></span>{entry}</span></td><td>{count(entry)} 笔</td><td><StatusBadge status="已记账" /></td><td><div className="inline-actions"><button className="text-link" onClick={() => { setEditing(entry); setValue(entry); setError('') }}><Pencil size={13} />编辑</button><button className="text-link danger-text" onClick={() => { if (count(entry)) { notify('该资料已有业务关联，可以修改名称并同步历史流水', 'info'); return } confirm('删除资料', `确定删除「${entry}」吗？`, () => { change(entries.filter((name) => name !== entry)); notify('资料已删除') }) }}><Trash2 size={13} />删除</button></div></td></tr>)}</tbody></table>{!entries.length && <EmptyState title={`还没有${title}`} text="点击右上角添加第一项基础资料。" />}</div>{editing !== null && <Modal title={`${editing ? '编辑' : '新增'}${category ? '流水类别' : project ? '项目' : '往来单位'}`} onClose={() => setEditing(null)} footer={<><button className="button" onClick={() => setEditing(null)}>取消</button><button className="button primary" onClick={save}>保存</button></>}><label className="form-field"><span>名称 <b>*</b></span><input maxLength={50} value={value} onChange={(e) => setValue(e.target.value)} placeholder="请输入名称" /></label>{error && <div className="form-error" role="alert">{error}</div>}</Modal>}</div>
}

function InventorySettings() {
  const { ledger, updateLedger, notify, confirm } = useFinance()
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null)
  const [form, setForm] = useState({ name: '', unit: '个', quantity: '0', cost: '0.00' })
  const [error, setError] = useState('')
  const open = (item?: InventoryItem) => { setEditing(item ?? 'new'); setForm({ name: item?.name ?? '', unit: item?.unit ?? '个', quantity: String(item?.quantity ?? 0), cost: ((item?.cost ?? 0) / 100).toFixed(2) }); setError('') }
  const save = () => {
    const old = editing && editing !== 'new' ? editing : null
    if (!form.name.trim() || !form.unit.trim()) { setError('请填写存货名称和计量单位'); return }
    if (ledger.inventory.some((item) => item.name === form.name.trim() && item.id !== old?.id)) { setError('存货名称已存在'); return }
    if (!Number.isFinite(Number(form.quantity)) || !Number.isFinite(Number(form.cost)) || Number(form.quantity) < 0 || Number(form.cost) < 0) { setError('数量和成本需要是大于或等于 0 的数字'); return }
    const item: InventoryItem = { id: old?.id ?? uid(), name: form.name.trim(), unit: form.unit.trim(), quantity: Number(form.quantity), cost: Math.round(Number(form.cost) * 100) }
    updateLedger((current) => ({ ...current, inventory: old ? current.inventory.map((row) => row.id === item.id ? item : row) : [...current.inventory, item] }), `${old ? '修改' : '新增'}存货：${item.name}`)
    setEditing(null); notify('存货信息已保存')
  }
  return <div className="workspace-page"><div className="page-heading"><div><h1>存货管理</h1><p>商品与结存成本，都有一本明白账。</p></div><button className="button primary" onClick={() => open()}><Plus size={15} />新增存货</button></div><div className="data-panel"><table className="data-table"><thead><tr><th>存货名称</th><th>计量单位</th><th className="text-right">期初结存数量</th><th className="text-right">单位成本</th><th className="text-right">结存金额</th><th>操作</th></tr></thead><tbody>{ledger.inventory.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.unit}</td><td className="text-right">{item.quantity}</td><td className="text-right mono">{money(item.cost)}</td><td className="text-right mono">{money(item.quantity * item.cost)}</td><td><div className="inline-actions"><button className="text-link" onClick={() => open(item)}><Pencil size={13} />编辑</button><button className="text-link danger-text" onClick={() => confirm('删除存货', `确定删除「${item.name}」吗？`, () => { updateLedger((current) => ({ ...current, inventory: current.inventory.filter((row) => row.id !== item.id) }), `删除存货：${item.name}`); notify('存货已删除') })}><Trash2 size={13} />删除</button></div></td></tr>)}</tbody></table>{!ledger.inventory.length && <EmptyState title="还没有存货" text="添加商品并设置期初数量，结存成本就能清晰可见。" />}</div>{editing && <Modal title={editing === 'new' ? '新增存货' : '编辑存货'} onClose={() => setEditing(null)} footer={<><button className="button" onClick={() => setEditing(null)}>取消</button><button className="button primary" onClick={save}>保存存货</button></>}><div className="modal-form"><label className="form-field"><span>存货名称</span><input value={form.name} maxLength={50} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></label><div className="form-grid"><label className="form-field"><span>计量单位</span><input value={form.unit} maxLength={10} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} /></label><label className="form-field"><span>期初结存数量</span><input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></label></div><label className="form-field"><span>单位成本（元）</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} /></label>{error && <div className="form-error" role="alert">{error}</div>}</div></Modal>}</div>
}

export function ActivityPage() {
  const { ledger } = useFinance()
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10)
  const rows = ledger.activities.filter((item) => `${item.text} ${item.user} ${item.time}`.includes(search))
  const effective = Math.max(1, Math.min(page, Math.ceil(rows.length / pageSize)))
  return <div className="workspace-page"><div className="page-heading"><div><h1>财务动态</h1><p>每一次操作，都有迹可循。</p></div><span className="muted"><CircleHelp size={14} />展示当前账套的操作记录</span></div><div className="data-panel"><div className="simple-filter"><div className="search-input"><Search size={15} /><input aria-label="搜索财务动态" placeholder="搜索操作、人员或时间" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /></div><span className="muted">共 {rows.length} 条记录</span></div><table className="data-table"><thead><tr><th>操作时间</th><th>操作人员</th><th>财务动态</th></tr></thead><tbody>{rows.slice((effective - 1) * pageSize, effective * pageSize).map((item) => <tr key={item.id}><td className="mono">{item.time}</td><td><span className="user-avatar">{item.user.slice(0, 1)}</span>{item.user}</td><td>{item.text}</td></tr>)}</tbody></table>{!rows.length && <EmptyState title="没有找到操作记录" text="试试其他关键词。" />}<Pagination count={rows.length} page={effective} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} /></div></div>
}
