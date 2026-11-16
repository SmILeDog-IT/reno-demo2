import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { currentMonth, homeWidgets, money, monthShift, pageById, pages, totals, wan } from './data'
import { useFinance } from './finance-context'
import { AccountBars, AccountDonut, TrendChart } from './charts'
import { AppIcon, EmptyState, Tile } from './ui'

export interface DashboardProps {
  favorites: string[]
  hiddenWidgets: string[]
  widgetOrder: string[]
  onFavorites: () => void
  onSettings: () => void
}

export default function Dashboard({ favorites, hiddenWidgets, widgetOrder, onFavorites, onSettings }: DashboardProps) {
  const { ledger, openPage, notify } = useFinance()
  const [month, setMonth] = useState(currentMonth)
  const [summaryRange, setSummaryRange] = useState<'all' | 'month'>('all')
  const statistics = totals(ledger.transactions, summaryRange === 'month' ? month : undefined)
  const previous = totals(ledger.transactions, summaryRange === 'month' ? monthShift(month, -1) : undefined)
  const refresh = () => notify('当前账套数据已更新')
  const manage = (action: () => void) => <button className="card-manage" onClick={action}><Settings2 size={12} />管理</button>
  const heading = (title: string, actions?: React.ReactNode) => <div className="card-heading"><h2>{title}</h2><div className="card-actions">{actions}</div></div>
  const tiles = (ids: string[]) => <div className="tile-grid">{ids.map((id) => <Tile key={id} page={pageById(id)} onClick={() => openPage(id)} />)}</div>
  const widgets: Record<string, React.ReactNode> = {
    favorites: <section className="home-card favorites-card">
      {heading('我常用的', manage(onFavorites))}
      <div className="tile-grid">{favorites.map((id) => <Tile key={id} page={pageById(id)} onClick={() => openPage(id)} />)}
        <button className="app-tile add-tile" onClick={onFavorites}><span className="tile-icon"><Plus size={25} strokeWidth={1.3} /></span><span className="tile-label">添加</span></button>
      </div>
      <p className="card-hint">常用的功能，一点就到。</p>
    </section>,
    reports: <section className="home-card reports-card">{heading('报表')}{tiles(pages.filter((p) => p.group === '报表').map((p) => p.id))}</section>,
    balances: <section className="home-card balance-card">
      {heading('余额表')}{tiles(pages.filter((p) => p.group === '余额表').map((p) => p.id))}
      <div className="card-subheading"><h2>明细表</h2></div>{tiles(pages.filter((p) => p.group === '明细表').map((p) => p.id))}
    </section>,
    cockpit: <section className="home-card cockpit-card">
      {heading('老板驾驶舱', <><button className="card-refresh" title="刷新驾驶舱" onClick={refresh}><RefreshCw size={13} /></button>{manage(onSettings)}</>)}
      <div className="summary-period"><span className="live-dot" />经营状况一目了然<select aria-label="驾驶舱统计周期" value={summaryRange} onChange={(e) => setSummaryRange(e.target.value as 'all' | 'month')}><option value="all">累计</option><option value="month">本月</option></select></div>
      <div className="cockpit-stats">{[
        { label: '总收入', value: statistics.income, previous: previous.income, class: 'income' },
        { label: '总支出', value: statistics.expense, previous: previous.expense, class: 'expense' },
        { label: '总利润', value: statistics.profit, previous: previous.profit, class: 'profit' },
      ].map((stat) => <div key={stat.label}><span>{stat.label}</span><strong className={stat.class}>{wan(stat.value)}<small>万</small></strong><span className="stat-caption">{summaryRange === 'month' && stat.previous > 0 ? <>{stat.value >= stat.previous ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs((stat.value / stat.previous - 1) * 100).toFixed(1)}% 环比</> : '当前账套累计'}</span></div>)}</div>
      <div className="chart-month"><input type="month" aria-label="驾驶舱月份" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value) }} /></div>
      <TrendChart ledger={ledger} month={month} />
      <button className="text-link cockpit-link" onClick={() => openPage('report-profit')}>查看完整经营报表<ChevronRight size={13} /></button>
    </section>,
    bookkeeping: <section className="home-card bookkeeping-card">{heading('智能记账')}{tiles(['entry', 'transactions', 'vouchers'])}
      <div className="bookkeeping-tip"><span className="tip-dot" />记好每一笔，经营更有底。</div>
    </section>,
    activity: <section className="home-card activity-card">
      {heading('财务动态', <button className="card-refresh" onClick={refresh} title="刷新财务动态"><RefreshCw size={13} /></button>)}
      {ledger.activities.length ? <div className="activity-list">{ledger.activities.slice(0, 9).map((activity, index) => <div className="activity-row" key={activity.id}>
        <span className={`activity-dot ${index === 0 ? 'recent' : ''}`} /><div><time>{activity.time}</time><p>{activity.text}</p></div><span className="activity-user">{activity.user}</span>
      </div>)}</div> : <EmptyState title="还没有财务动态" text="每一次操作，都会留下清晰的记录。" />}
      <button className="text-link card-bottom-link" onClick={() => openPage('logs')}>查看更多<ChevronRight size={13} /></button>
    </section>,
    accounts: <section className="home-card accounts-card">
      {heading('财务仪表盘', <><button className="card-refresh" onClick={refresh} title="刷新账户余额"><RefreshCw size={13} /></button>{manage(() => openPage('settings-accounts'))}</>)}
      {ledger.accounts.length ? <><AccountDonut ledger={ledger} /><AccountBars ledger={ledger} /></> : <EmptyState title="还没有资金账户" text="添加账户，随时掌握资金去向。" action={<button className="button primary" onClick={() => openPage('settings-accounts')}>添加账户</button>} />}
      <button className="text-link" onClick={() => openPage('balance-account')}>查看账户余额表<ChevronRight size={13} /></button>
    </section>,
    'home-settings': <button className="home-card home-settings-card" onClick={onSettings}><span className="settings-illustration"><AppIcon name="dashboard" size={28} /></span><div><strong>首页设置</strong><p>编辑组件，定制你的财务工作台</p></div><ChevronRight size={18} /></button>,
  }
  const ordered = widgetOrder.filter((id) => !hiddenWidgets.includes(id) && widgets[id])
  const empty = ordered.length === 0
  return <div className="dashboard-page" key={ledger.id}>
    {empty ? <EmptyState title="给工作台添点内容" text="在首页设置中，选择你关心的财务组件。" action={<button className="button primary" onClick={onSettings}>设置首页</button>} /> :
      <div className="home-grid">{['left', 'right'].map((column) => <div className="home-column" key={column}>{ordered.filter((id) => homeWidgets.find((w) => w.id === id)?.column === column).map((id) => <div className="widget-wrap" key={id}>{widgets[id]}</div>)}</div>)}</div>}
    <footer className="dashboard-footer"><span>小番财务</span><i />让每一笔经营，都清晰可见<span className="version">v1.0.0</span></footer>
    <span className="sr-only">总收入 {money(statistics.income)} 元，总支出 {money(statistics.expense)} 元</span>
  </div>
}
