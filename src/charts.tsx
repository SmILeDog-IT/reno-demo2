import { useId, useState } from 'react'
import { money, wan } from './data'
import type { Account, Ledger } from './data'
import { accountBalance, monthData } from './data'

export function TrendChart({ ledger, month }: { ledger: Ledger; month: string }) {
  const [range, setRange] = useState(6)
  const [series, setSeries] = useState({ income: true, expense: true })
  const [hover, setHover] = useState<number | null>(null)
  const id = useId().replaceAll(':', '')
  const data = monthData(ledger, month, range)
  const width = 318, height = 206, left = 38, right = 12, top = 18, bottom = 34
  const chartWidth = width - left - right, chartHeight = height - top - bottom
  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1)
  const max = Math.ceil(maxValue / 5_000_000) * 5_000_000
  const position = (i: number, value: number) => ({ x: left + i / (data.length - 1) * chartWidth, y: top + (1 - value / max) * chartHeight })
  const line = (key: 'income' | 'expense') => data.map((d, i) => {
    const p = position(i, d[key])
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
  const active = hover === null ? null : data[hover]
  return <div className="trend-chart">
    <div className="chart-toolbar"><span>收支趋势 <span className="muted">（万元）</span></span><select aria-label="趋势时间范围" value={range} onChange={(e) => setRange(Number(e.target.value))}><option value={6}>近 6 个月</option><option value={12}>近 12 个月</option></select></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近几个月收入和支出趋势图" onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id={`chart-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#526bff" stopOpacity=".16" /><stop offset="100%" stopColor="#526bff" stopOpacity="0" /></linearGradient></defs>
      {Array.from({ length: 4 }, (_, i) => {
        const y = top + chartHeight * i / 3
        return <g key={i}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#edf0f6" strokeDasharray="3 4" /><text x={left - 9} y={y + 4} textAnchor="end" className="chart-label">{Math.round(max / 1_000_000 * (1 - i / 3))}</text></g>
      })}
      {series.income && <><path d={`${line('income')} L ${width - right} ${height - bottom} L ${left} ${height - bottom} Z`} fill={`url(#chart-${id})`} /><path d={line('income')} fill="none" stroke="#526bff" strokeWidth="2.3" strokeLinejoin="round" /></>}
      {series.expense && <path d={line('expense')} fill="none" stroke="#ff8654" strokeWidth="2.3" strokeLinejoin="round" />}
      {data.map((d, i) => <g key={d.month}>
        {(range === 6 || i % 2 === 0 || i === range - 1) && <text x={position(i, 0).x} y={height - 11} textAnchor="middle" className="chart-label">{d.label}</text>}
        <rect x={position(i, 0).x - chartWidth / (data.length - 1) / 2} y={top} width={chartWidth / (data.length - 1)} height={chartHeight} fill="transparent" onMouseEnter={() => setHover(i)} />
      </g>)}
      {hover !== null && <g><line x1={position(hover, 0).x} x2={position(hover, 0).x} y1={top} y2={height - bottom} stroke="#c9d0e6" strokeDasharray="3 3" />{(['income', 'expense'] as const).map((key) => series[key] && <circle key={key} cx={position(hover, data[hover][key]).x} cy={position(hover, data[hover][key]).y} r="4" stroke="white" strokeWidth="2" fill={key === 'income' ? '#526bff' : '#ff8654'} />)}</g>}
    </svg>
    {active && <div className="chart-tooltip"><strong>{active.month}</strong><span>收入 ¥{money(active.income)}</span><span>支出 ¥{money(active.expense)}</span></div>}
    <div className="chart-legend"><button className={!series.income ? 'inactive' : ''} onClick={() => setSeries((s) => ({ ...s, income: !s.income }))}><i />收入</button><button className={!series.expense ? 'inactive' : ''} onClick={() => setSeries((s) => ({ ...s, expense: !s.expense }))}><i className="orange" />支出</button></div>
  </div>
}

export const accountColors = ['#526bff', '#8d7bf1', '#ffad73', '#4dc5ae', '#74bafa', '#d38ee3']

export function AccountDonut({ ledger }: { ledger: Ledger }) {
  const accounts = ledger.accounts.filter((a) => a.enabled)
  const balances = accounts.map((a) => Math.max(accountBalance(ledger, a.id), 0))
  const total = balances.reduce((sum, b) => sum + b, 0)
  const circumference = 2 * Math.PI * 62
  let previous = 0
  return <div className="account-donut">
    <svg viewBox="0 0 164 164" role="img" aria-label="各账户资金分布">
      <circle cx="82" cy="82" r="62" fill="none" stroke="#f0f2f8" strokeWidth="15" />
      {total > 0 && balances.map((balance, i) => {
        const portion = balance / total * circumference, offset = -previous
        previous += portion
        return <circle key={accounts[i].id} cx="82" cy="82" r="62" fill="none" stroke={accountColors[i % accountColors.length]} strokeWidth="15" strokeDasharray={`${Math.max(portion - 3, 0)} ${circumference}`} strokeDashoffset={offset} transform="rotate(-90 82 82)" />
      })}
      <text x="82" y="77" textAnchor="middle" className="donut-label">账户总余额</text><text x="82" y="101" textAnchor="middle" className="donut-value">{wan(accounts.reduce((sum, a) => sum + accountBalance(ledger, a.id), 0))}<tspan className="donut-unit"> 万</tspan></text>
    </svg>
  </div>
}

export function AccountBars({ ledger, accounts }: { ledger: Ledger; accounts?: Account[] }) {
  const rows = accounts ?? ledger.accounts.filter((a) => a.enabled)
  const max = Math.max(...rows.map((a) => accountBalance(ledger, a.id)), 1)
  return <div className="account-bars">{rows.map((a, i) => <div className="account-bar-row" key={a.id}>
    <div><span><i style={{ background: accountColors[i % accountColors.length] }} />{a.name}</span><strong>¥{money(accountBalance(ledger, a.id))}</strong></div>
    <div className="account-bar-track"><i style={{ width: `${Math.max(accountBalance(ledger, a.id), 0) / max * 100}%`, background: accountColors[i % accountColors.length] }} /></div>
  </div>)}</div>
}
