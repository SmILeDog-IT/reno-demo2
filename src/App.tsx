import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ExternalLink,
  HeartHandshake, Info, Plus, Search, Settings2, X,
} from 'lucide-react'
import { createLedger, homeWidgets, initialLedger, localTime, pageById, pages, uid } from './data'
import type { Ledger, Transaction } from './data'
import { FinanceContext } from './finance-context'
import Dashboard from './Dashboard'
import Entry from './Entry'
import Transactions, { Vouchers } from './Transactions'
import Reports, { BalanceReport, InventoryDetail } from './Reports'
import SettingsPage, { ActivityPage, HomeLayoutEditor } from './Settings'
import { AppIcon, Brand, Modal } from './ui'

const STORAGE = 'xiaofan.finance.ledgers.v1'
const read = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback }
  catch { return fallback }
}
const validLedger = (value: unknown): value is Ledger => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Ledger
  return typeof candidate.id === 'string' && typeof candidate.name === 'string' &&
    Array.isArray(candidate.transactions) && Array.isArray(candidate.accounts) &&
    Array.isArray(candidate.activities) && Array.isArray(candidate.inventory) &&
    Array.isArray(candidate.projects) && Array.isArray(candidate.relatives) &&
    Array.isArray(candidate.categories?.income) && Array.isArray(candidate.categories?.expense)
}
const getRoute = () => {
  const id = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return pages.some((page) => page.id === id) ? id : 'home'
}
const DEFAULT_ORDER = homeWidgets.map((widget) => widget.id)

export default function App() {
  const [ledgers, setLedgers] = useState<Ledger[]>(() => {
    const stored = read<unknown>(STORAGE, null)
    const values = Array.isArray(stored) ? stored.filter(validLedger) : []
    return values.length ? values : [initialLedger()]
  })
  const [activeId, setActiveId] = useState(() => read('xiaofan.finance.active', 'demo'))
  const ledger = ledgers.find((item) => item.id === activeId) ?? ledgers[0]
  const [activePage, setActivePage] = useState(getRoute)
  const [tabs, setTabs] = useState(() => getRoute() === 'home' ? ['home'] : ['home', getRoute()])
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [navMenu, setNavMenu] = useState<{ group: string; top: number } | null>(null)
  const [more, setMore] = useState(false)
  const [modal, setModal] = useState<'favorites' | 'layout' | 'new-ledger' | 'help' | 'about' | 'experience' | null>(null)
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; action: () => void } | null>(null)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error'; id: string } | null>(null)
  const [favorites, setFavorites] = useState<string[]>(() => read<string[]>('xiaofan.finance.favorites', ['report-balance', 'report-cashflow']).filter((id) => pages.some((p) => p.id === id)))
  const [draftFavorites, setDraftFavorites] = useState(favorites)
  const [favoriteSearch, setFavoriteSearch] = useState('')
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>(() => read<string[]>('xiaofan.finance.hidden', []))
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    const stored = read<string[]>('xiaofan.finance.order', DEFAULT_ORDER)
    return [...new Set([...stored.filter((id) => DEFAULT_ORDER.includes(id)), ...DEFAULT_ORDER])]
  })
  const moreRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const notify = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => setToast({ text, type, id: uid() }), [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(ledgers)) }
    catch { notify('浏览器存储空间不足，请导出账套备份保存数据', 'error') }
  }, [ledgers, notify])
  useEffect(() => {
    try {
      localStorage.setItem('xiaofan.finance.active', JSON.stringify(activeId))
      localStorage.setItem('xiaofan.finance.favorites', JSON.stringify(favorites))
      localStorage.setItem('xiaofan.finance.hidden', JSON.stringify(hiddenWidgets))
      localStorage.setItem('xiaofan.finance.order', JSON.stringify(widgetOrder))
    } catch { /* Core ledger storage reports its own error above. */ }
  }, [activeId, favorites, hiddenWidgets, widgetOrder])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3800)
    return () => clearTimeout(timer)
  }, [toast?.id])
  useEffect(() => {
    document.title = `${pageById(activePage).title} · 小番财务`
    scrollRef.current?.scrollTo({ top: 0 })
  }, [activePage, ledger.id])
  useEffect(() => {
    const navigate = () => {
      const next = getRoute()
      setTabs((current) => current.includes(next) ? current : [...current, next])
      setActivePage(next)
    }
    const dismiss = (event: MouseEvent) => { if (!moreRef.current?.contains(event.target as Node)) setMore(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setNavMenu(null); setMore(false) } }
    window.addEventListener('hashchange', navigate)
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { window.removeEventListener('hashchange', navigate); document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', escape) }
  }, [])
  const openPage = useCallback((id: string, transaction?: Transaction) => {
    if (!pages.some((page) => page.id === id)) return
    if (id === 'entry') setEditing(transaction ?? null)
    setTabs((current) => current.includes(id) ? current : [...current, id])
    setActivePage(id); setNavMenu(null); setMore(false)
    window.location.hash = `#/${id}`
  }, [])
  const selectLedger = (id: string) => {
    if (!ledgers.some((item) => item.id === id)) return
    setActiveId(id); setEditing(null); setTabs(['home']); setActivePage('home'); window.location.hash = '#/home'
    notify(`已切换至 ${ledgers.find((item) => item.id === id)?.name}`)
  }
  const updateLedger = (update: (value: Ledger) => Ledger, activity?: string) => setLedgers((current) => current.map((item) => {
    if (item.id !== ledger.id) return item
    const updated = update(item)
    return activity ? { ...updated, activities: [{ id: uid(), time: localTime(), text: activity, user: '小番' }, ...updated.activities].slice(0, 300) } : updated
  }))
  const addLedger = (value: Ledger) => {
    setLedgers((current) => [...current, value]); setActiveId(value.id)
    setTabs(['home']); setActivePage('home'); setEditing(null); window.location.hash = '#/home'
    setModal(null); notify(`「${value.name}」创建成功`)
  }
  const removeLedger = (id: string) => {
    if (ledgers.length <= 1) return
    const remaining = ledgers.filter((item) => item.id !== id)
    setLedgers(remaining)
    if (ledger.id === id) { setActiveId(remaining[0].id); setEditing(null); openPage('home') }
  }
  const confirm = (title: string, text: string, action: () => void) => setConfirmation({ title, text, action })
  const closeTab = (id: string) => {
    const remaining = tabs.filter((tab) => tab !== id)
    setTabs(remaining)
    if (activePage === id) { const next = remaining.at(-1) ?? 'home'; setActivePage(next); window.location.hash = `#/${next}` }
    if (id === 'entry') setEditing(null)
  }
  const showFavorites = () => { setDraftFavorites(favorites); setFavoriteSearch(''); setModal('favorites') }
  const showLayout = () => setModal('layout')
  const newLedger = () => setModal('new-ledger')
  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'xiaofan-finance-v1', exportedAt: new Date().toISOString(), ledger }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${ledger.name}-账套备份.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000); notify('账套数据备份已导出'); setMore(false)
  }
  const showNav = (group: string, element: HTMLElement) => {
    const size = pages.filter((page) => page.group === group).length * 39 + 52
    setNavMenu({ group, top: Math.max(62, Math.min(element.getBoundingClientRect().top, window.innerHeight - size - 12)) })
  }
  const content = (id: string) => {
    if (id === 'home') return <Dashboard favorites={favorites} hiddenWidgets={hiddenWidgets} widgetOrder={widgetOrder} onFavorites={showFavorites} onSettings={showLayout} />
    if (id === 'entry') return <Entry />
    if (id === 'transactions' || id === 'drafts') return <Transactions drafts={id === 'drafts'} />
    if (id === 'vouchers') return <Vouchers />
    if (id === 'logs') return <ActivityPage />
    if (id.startsWith('report-')) return <Reports id={id} />
    if (id.startsWith('balance-')) return <BalanceReport id={id} />
    if (id === 'detail-inventory') return <InventoryDetail />
    if (id.startsWith('detail-')) return <Transactions title={pageById(id).title} detail />
    return <SettingsPage id={id} onNewLedger={newLedger} onHomeSettings={showLayout} />
  }
  return <FinanceContext.Provider value={{ ledger, ledgers, activeId: ledger.id, updateLedger, selectLedger, addLedger, removeLedger, openPage, notify, confirm, editTransaction: editing, clearEditing: () => setEditing(null) }}>
    <div className="app-shell">
      <aside className="sidebar" onMouseLeave={() => setNavMenu(null)}>
        <button className="brand-button" title="小番财务" aria-label="小番财务首页" onClick={() => openPage('home')}><Brand /></button>
        <nav className="primary-nav" aria-label="主导航"><button className={`nav-item ${activePage === 'home' ? 'active' : ''}`} onMouseEnter={() => setNavMenu(null)} onClick={() => openPage('home')}><AppIcon name="home" size={22} /><span>首页</span></button>{['录入', '管理', '报表', '余额表', '明细表'].map((group) => <button key={group} className={`nav-item ${pageById(activePage).group === group || navMenu?.group === group ? 'active' : ''}`} aria-haspopup="menu" aria-expanded={navMenu?.group === group} onMouseEnter={(e) => showNav(group, e.currentTarget)} onClick={(e) => showNav(group, e.currentTarget)}><AppIcon name={group} size={22} /><span>{group}</span></button>)}</nav>
        <button className={`nav-item nav-settings ${pageById(activePage).group === '设置' || navMenu?.group === '设置' ? 'active' : ''}`} aria-haspopup="menu" aria-expanded={navMenu?.group === '设置'} onMouseEnter={(e) => showNav('设置', e.currentTarget)} onClick={(e) => showNav('设置', e.currentTarget)}><AppIcon name="设置" size={22} /><span>设置</span></button>
        {navMenu && <div className="nav-flyout" style={{ top: navMenu.top }} role="menu" aria-label={`${navMenu.group}菜单`}><div className="flyout-title">{navMenu.group}<span>{pages.filter((page) => page.group === navMenu.group).length} 项功能</span></div>{pages.filter((page) => page.group === navMenu.group).map((page) => <button role="menuitem" key={page.id} className={activePage === page.id ? 'active' : ''} onClick={() => openPage(page.id)}><AppIcon name={page.icon} size={17} /><span>{page.title}</span>{activePage === page.id && <Check size={14} />}</button>)}</div>}
      </aside>
      <div className="main-shell"><header className="topbar"><div className="ledger-switcher"><button className="experience-badge" onClick={() => setModal('experience')}>体验版</button><div className="ledger-select"><select aria-label="切换账套" value={ledger.id} onChange={(e) => e.target.value === '__new__' ? newLedger() : selectLedger(e.target.value)}>{ledgers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}<option value="__new__">＋ 新建账套</option></select></div></div><div className="topbar-actions"><div className="demo-note"><span className="demo-note-icon"><AppIcon name="ledger" size={27} /></span><div>本账套数据仅供体验使用<span>记账有章法，经营有底气</span></div></div><button className="button top-button" onClick={() => openPage('settings-ledger')}>账套设置</button><button className="button top-button" onClick={() => setModal('help')}><HeartHandshake size={13} /><span>帮助与客服</span></button><div className="more-wrap" ref={moreRef}><button className="button top-button" aria-expanded={more} onClick={() => setMore(!more)}>更多<ChevronDown size={12} /></button>{more && <div className="top-dropdown"><button onClick={showLayout}><Settings2 size={14} />首页设置</button><button onClick={() => openPage('logs')}><AppIcon name="activity" size={14} />财务动态</button><button onClick={exportBackup}><AppIcon name="draft" size={14} />导出账套备份</button><div className="dropdown-divider" /><button onClick={() => { setMore(false); setModal('about') }}><Info size={14} />关于小番</button></div>}</div></div></header>
      <div className="tabbar" role="tablist" aria-label="已打开的页面">{tabs.map((id) => <div className={`page-tab ${activePage === id ? 'active' : ''}`} key={id}><button role="tab" aria-selected={activePage === id} onClick={() => { setActivePage(id); setNavMenu(null); window.location.hash = `#/${id}` }}>{id === 'home' && <AppIcon name="home" size={13} />}{pageById(id).title}</button>{id !== 'home' && <button className="tab-close" aria-label={`关闭${pageById(id).title}页签`} onClick={() => closeTab(id)}><X size={12} /></button>}</div>)}<span className="tabbar-end"><span className="connection-dot" />账目随时同步</span></div>
      <main ref={scrollRef} className="page-scroll">{tabs.map((id) => <div className="page-panel" key={`${ledger.id}-${id}`} hidden={activePage !== id} role="tabpanel" aria-label={pageById(id).title}>{content(id)}</div>)}</main>
      </div>
    </div>
    {modal === 'favorites' && <Modal title="管理常用功能" wide onClose={() => setModal(null)} footer={<><span className="modal-footer-note">已选择 {draftFavorites.length} / 8 个</span><button className="button" onClick={() => setModal(null)}>取消</button><button className="button primary" onClick={() => { setFavorites(draftFavorites); setModal(null); notify('常用功能已更新') }}>保存设置</button></>}><p className="modal-description">把最常用的功能放在首页，少找一步，多省一点时间。</p><div className="search-input favorite-search"><Search size={16} /><input aria-label="搜索常用功能" placeholder="搜索功能名称" value={favoriteSearch} onChange={(e) => setFavoriteSearch(e.target.value)} /></div>{['录入', '管理', '报表', '余额表', '明细表', '设置'].map((group) => { const options = pages.filter((page) => page.group === group && page.title.includes(favoriteSearch)); return options.length ? <div className="favorite-group" key={group}><h3>{group}</h3><div>{options.map((page) => <label className={draftFavorites.includes(page.id) ? 'checked' : ''} key={page.id}><input type="checkbox" checked={draftFavorites.includes(page.id)} onChange={(e) => { if (e.target.checked && draftFavorites.length >= 8) { notify('最多选择 8 个常用功能', 'info'); return } setDraftFavorites(e.target.checked ? [...draftFavorites, page.id] : draftFavorites.filter((id) => id !== page.id)) }} /><AppIcon name={page.icon} size={16} /><span>{page.title}</span></label>)}</div></div> : null })}</Modal>}
    {modal === 'layout' && <Modal title="首页设置" wide onClose={() => setModal(null)} footer={<button className="button primary" onClick={() => { setModal(null); notify('首页布局已保存') }}>完成设置</button>}><HomeLayoutEditor hidden={hiddenWidgets} order={widgetOrder} setHidden={setHiddenWidgets} setOrder={setWidgetOrder} /></Modal>}
    {modal === 'new-ledger' && <NewLedgerModal onClose={() => setModal(null)} onCreate={addLedger} names={ledgers.map((item) => item.name)} notify={notify} />}
    {modal === 'experience' && <ExperienceModal onClose={() => setModal(null)} onEnter={(version, template) => {
      const existing = ledgers.find((item) => item.version === version && (template === 'demo' ? item.id === 'demo' : item.name === '空白体验账套'))
      if (existing) { selectLedger(existing.id); setModal(null) }
      else { const value = createLedger(template === 'demo' ? `${version}演示账套` : '空白体验账套', version, template === 'demo'); value.id = uid(); addLedger(value) }
    }} />}
    {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
    {modal === 'about' && <Modal title="关于小番财务" onClose={() => setModal(null)}><div className="about-content"><Brand /><h2>小番财务</h2><p>让每一笔经营，都清晰可见。</p><span>体验工作台 · v1.0.0</span><div className="about-rule" /><p className="muted">记账、查账、看经营，一处就够。</p></div></Modal>}
    {confirmation && <Modal title={confirmation.title} onClose={() => setConfirmation(null)} footer={<><button className="button" onClick={() => setConfirmation(null)}>取消</button><button className="button danger" onClick={() => { confirmation.action(); setConfirmation(null) }}>确认删除</button></>}><div className="confirmation-message"><CircleHelp size={27} /><p>{confirmation.text}</p></div></Modal>}
    {toast && <div className={`toast ${toast.type}`} role="status">{toast.type === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}<span>{toast.text}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><X size={14} /></button></div>}
  </FinanceContext.Provider>
}

function NewLedgerModal({ onClose, onCreate, names, notify }: { onClose: () => void; onCreate: (ledger: Ledger) => void; names: string[]; notify: (text: string, type?: 'success' | 'info' | 'error') => void }) {
  const [name, setName] = useState(''), [version, setVersion] = useState<Ledger['version']>('智能版'), [template, setTemplate] = useState('blank')
  return <Modal title="新增账套" onClose={onClose} footer={<><button className="button" onClick={onClose}>取消</button><button className="button primary" onClick={() => { if (!name.trim()) { notify('请填写账套名称', 'error'); return } if (names.includes(name.trim())) { notify('已有同名账套，请换一个名称', 'error'); return } const value = createLedger(name.trim(), version, template === 'demo'); value.id = uid(); onCreate(value) }}><Plus size={14} />创建账套</button></>}><div className="modal-form"><p className="modal-description">为一个新的公司或业务，建立独立的财务账本。</p><label className="form-field"><span>账套名称 <b>*</b></span><input placeholder="例如：小番商贸有限公司" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="form-field"><span>版本选择</span><select value={version} onChange={(e) => setVersion(e.target.value as Ledger['version'])}><option>智能版</option><option>会计版</option></select></label><label className="form-field"><span>初始数据</span><select value={template} onChange={(e) => setTemplate(e.target.value)}><option value="blank">创建空白账套</option><option value="demo">预置演示业务数据</option></select></label></div></Modal>
}

function ExperienceModal({ onClose, onEnter }: { onClose: () => void; onEnter: (version: Ledger['version'], template: string) => void }) {
  const [version, setVersion] = useState<Ledger['version']>('智能版'), [template, setTemplate] = useState('demo')
  return <Modal title="进入体验模式" onClose={onClose} footer={<button className="button red-primary" onClick={() => onEnter(version, template)}>点击进入<ChevronRight size={15} /></button>}><div className="experience-intro"><Brand /><div><strong>欢迎体验小番财务</strong><p>从一笔业务开始，把经营看得更清楚。</p></div></div><p className="experience-copy">演示账套已预置模拟业务。你可以自由录入、查询和查看报表，也可以创建空白账套，从头试一遍。</p><div className="modal-form"><label className="form-field horizontal"><span>版本选择：</span><select value={version} onChange={(e) => setVersion(e.target.value as Ledger['version'])}><option>智能版</option><option>会计版</option></select></label><label className="form-field horizontal"><span>模板选择：</span><select value={template} onChange={(e) => setTemplate(e.target.value)}><option value="demo">智能版演示账套（含演示数据）</option><option value="blank">创建空白账套</option></select></label></div></Modal>
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('')
  const questions = [
    ['如何开始记账？', '在左侧选择「录入 → 录入流水」，选择收入、支出或转账，填写日期、类别和金额后保存。相关账本和报表会自动更新。'],
    ['待收款与已收款有什么区别？', '待收款表示业务已发生，钱还没有到账，会计入收入和应收账款。完成收付后，资金账户的余额才会增加。待付款同理。'],
    ['如何生成记账凭证？', '进入流水管理，勾选已录入的业务，点击「生成凭证」。然后在凭证管理中查看、导出或打印。'],
    ['如何切换或新建账套？', '使用顶部的账套下拉框切换，或在「账套设置」中新增。不同账套的业务、账户和基础资料互相独立。'],
    ['刷新后，数据还在吗？', '数据会保存在当前浏览器，刷新后可以继续使用。清除浏览器数据会同时清除账套，重要记录可以先通过「更多 → 导出账套备份」下载。'],
    ['首页的功能可以调整吗？', '点击常用功能卡片的「管理」来选择常用入口。在首页设置中，可以隐藏组件、调整排列顺序或恢复默认布局。'],
  ]
  return <Modal title="帮助与客服" wide onClose={onClose}><div className="help-welcome"><span><HeartHandshake size={28} /></span><div><h3>需要帮忙？小番在这里。</h3><p>几个常见问题，让上手更轻松。</p></div></div><div className="search-input"><Search size={16} /><input aria-label="搜索帮助" placeholder="搜索记账、凭证、账套……" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="faq-list">{questions.filter((question) => question.join(' ').includes(search)).map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={15} /></summary><p>{answer}</p></details>)}</div><a className="help-official" href="https://www.xfannix.com/" target="_blank" rel="noreferrer">访问小番财务官网<ExternalLink size={14} /></a></Modal>
}
