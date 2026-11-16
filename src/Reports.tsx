import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Printer, RefreshCw } from 'lucide-react'
import { accountBalance, currentMonth, exportCsv, money, monthShift, pageById, totals } from './data'
import type { Ledger, Transaction } from './data'
import { useFinance } from './finance-context'
import { AccountBars } from './charts'
import { EmptyState } from './ui'

interface ReportRow { name: string; current: number; cumulative: number; strong?: boolean; indent?: boolean }

function periodRows(ledger: Ledger, month: string) {
  const end = `${month}-31`
  const year = month.slice(0, 4)
  return {
    current: ledger.transactions.filter((tx) => tx.status !== '草稿' && tx.date.startsWith(month)),
    cumulative: ledger.transactions.filter((tx) => tx.status !== '草稿' && tx.date.startsWith(year) && tx.date <= end),
  }
}

function amountOf(rows: Transaction[], kind: string, categories?: string[]) {
  return rows.filter((tx) => tx.kind === kind && (!categories || categories.includes(tx.category))).reduce((sum, tx) => sum + tx.amount, 0)
}

function profitRows(ledger: Ledger, month: string): ReportRow[] {
  const periods = periodRows(ledger, month)
  const values = (rows: Transaction[]) => {
    const income = amountOf(rows, 'income'), expense = amountOf(rows, 'expense')
    const otherIncome = amountOf(rows, 'income', ['其他收入'])
    const purchase = amountOf(rows, 'expense', ['采购支出'])
    const sales = amountOf(rows, 'expense', ['营销费用'])
    const otherExpense = amountOf(rows, 'expense', ['其他支出'])
    return [income - otherIncome, purchase, 0, sales, expense - purchase - sales - otherExpense, 0,
      income - otherIncome - expense + otherExpense, otherIncome, otherExpense, income - expense, 0, income - expense]
  }
  const current = values(periods.current), cumulative = values(periods.cumulative)
  return ['一、营业收入', '减：营业成本', '税金及附加', '销售费用', '管理费用', '财务费用', '二、营业利润', '加：营业外收入', '减：营业外支出', '三、利润总额', '减：所得税费用', '四、净利润'].map((name, i) => ({ name, current: current[i], cumulative: cumulative[i], strong: [0, 6, 9, 11].includes(i), indent: ![0, 6, 9, 11].includes(i) }))
}

function cashRows(ledger: Ledger, month: string): ReportRow[] {
  const periods = periodRows(ledger, month)
  const values = (rows: Transaction[], start: string) => {
    const posted = rows.filter((tx) => tx.status === '已记账')
    const income = amountOf(posted, 'income'), other = amountOf(posted, 'income', ['其他收入'])
    const expense = amountOf(posted, 'expense'), purchase = amountOf(posted, 'expense', ['采购支出'])
    const salary = amountOf(posted, 'expense', ['工资薪酬'])
    const opening = ledger.accounts.reduce((sum, a) => sum + accountBalance(ledger, a.id, start), 0)
    return [income - other, other, income, purchase, salary, expense - purchase - salary, expense, income - expense, 0, 0, income - expense, opening, opening + income - expense]
  }
  const current = values(periods.current, `${monthShift(month, -1)}-31`)
  const cumulative = values(periods.cumulative, `${Number(month.slice(0, 4)) - 1}-12-31`)
  const names = ['销售商品、提供劳务收到的现金', '收到其他与经营活动有关的现金', '经营活动现金流入小计', '购买商品、接受劳务支付的现金', '支付给职工以及为职工支付的现金', '支付其他与经营活动有关的现金', '经营活动现金流出小计', '一、经营活动产生的现金流量净额', '二、投资活动产生的现金流量净额', '三、筹资活动产生的现金流量净额', '四、现金及现金等价物净增加额', '加：期初现金及现金等价物余额', '五、期末现金及现金等价物余额']
  return names.map((name, i) => ({ name, current: current[i], cumulative: cumulative[i], strong: [2, 6, 7, 8, 9, 10, 12].includes(i), indent: [0, 1, 3, 4, 5, 11].includes(i) }))
}

export default function Reports({ id }: { id: string }) {
  const { ledger, notify } = useFinance()
  const [month, setMonth] = useState(currentMonth)
  const [taxRate, setTaxRate] = useState(3)
  const [surchargeRate, setSurchargeRate] = useState(12)
  const definition = pageById(id)
  const periods = periodRows(ledger, month)
  const statistics = totals(periods.current)
  let rows: ReportRow[] = []
  if (id === 'report-profit') rows = profitRows(ledger, month)
  if (id === 'report-cashflow') rows = cashRows(ledger, month)
  if (id === 'report-tax') {
    const revenue = (txs: Transaction[]) => amountOf(txs, 'income') - amountOf(txs, 'income', ['其他收入'])
    const currentVat = Math.round(revenue(periods.current) / (1 + taxRate / 100) * taxRate / 100)
    const annualVat = Math.round(revenue(periods.cumulative) / (1 + taxRate / 100) * taxRate / 100)
    rows = [
      { name: '含税营业收入', current: revenue(periods.current), cumulative: revenue(periods.cumulative), strong: true },
      { name: '不含税营业收入', current: Math.round(revenue(periods.current) / (1 + taxRate / 100)), cumulative: Math.round(revenue(periods.cumulative) / (1 + taxRate / 100)) },
      { name: `增值税（测算税率 ${taxRate}%）`, current: currentVat, cumulative: annualVat },
      { name: `城市维护建设税及教育费附加（${surchargeRate}%）`, current: Math.round(currentVat * surchargeRate / 100), cumulative: Math.round(annualVat * surchargeRate / 100) },
      { name: '预计应交税费合计', current: currentVat + Math.round(currentVat * surchargeRate / 100), cumulative: annualVat + Math.round(annualVat * surchargeRate / 100), strong: true },
    ]
  }
  const equityRows = (() => {
    const end = `${month}-31`
    const accepted = ledger.transactions.filter((tx) => tx.status !== '草稿' && tx.date <= end)
    const cash = ledger.accounts.reduce((sum, a) => sum + accountBalance(ledger, a.id, end), 0)
    const cashOpening = ledger.accounts.reduce((sum, a) => sum + a.opening, 0)
    const receivable = accepted.filter((tx) => tx.kind === 'income' && tx.status === '待收款').reduce((sum, tx) => sum + tx.amount, 0)
    const payable = accepted.filter((tx) => tx.kind === 'expense' && tx.status === '待付款').reduce((sum, tx) => sum + tx.amount, 0)
    const inventory = ledger.inventory.reduce((sum, item) => sum + item.quantity * item.cost, 0)
    const profit = totals(accepted).profit
    return [
      { asset: '流动资产', assetValue: null, assetOpening: null, liability: '流动负债', liabilityValue: null, liabilityOpening: null, strong: true },
      { asset: '货币资金', assetValue: cash, assetOpening: cashOpening, liability: '短期借款', liabilityValue: 0, liabilityOpening: 0 },
      { asset: '应收账款', assetValue: receivable, assetOpening: 0, liability: '应付账款', liabilityValue: payable, liabilityOpening: 0 },
      { asset: '存货', assetValue: inventory, assetOpening: inventory, liability: '应付职工薪酬', liabilityValue: 0, liabilityOpening: 0 },
      { asset: '其他流动资产', assetValue: 0, assetOpening: 0, liability: '其他应付款', liabilityValue: 0, liabilityOpening: 0 },
      { asset: '流动资产合计', assetValue: cash + receivable + inventory, assetOpening: cashOpening + inventory, liability: '流动负债合计', liabilityValue: payable, liabilityOpening: 0, strong: true },
      { asset: '非流动资产', assetValue: null, assetOpening: null, liability: '非流动负债', liabilityValue: null, liabilityOpening: null, strong: true },
      { asset: '固定资产', assetValue: 0, assetOpening: 0, liability: '长期借款', liabilityValue: 0, liabilityOpening: 0 },
      { asset: '无形资产', assetValue: 0, assetOpening: 0, liability: '所有者权益', liabilityValue: null, liabilityOpening: null, strong: true },
      { asset: '其他非流动资产', assetValue: 0, assetOpening: 0, liability: '实收资本', liabilityValue: cashOpening + inventory, liabilityOpening: cashOpening + inventory },
      { asset: '非流动资产合计', assetValue: 0, assetOpening: 0, liability: '未分配利润', liabilityValue: profit, liabilityOpening: 0, strong: true },
      { asset: '资产总计', assetValue: cash + receivable + inventory, assetOpening: cashOpening + inventory, liability: '负债和所有者权益总计', liabilityValue: payable + cashOpening + inventory + profit, liabilityOpening: cashOpening + inventory, strong: true },
    ]
  })()
  const projectNames = [...ledger.projects, ...(ledger.transactions.some((tx) => !tx.project) ? ['未分配项目'] : [])]
  const projectRows = projectNames.map((project) => {
    const matches = (tx: Transaction) => project === '未分配项目' ? !tx.project : tx.project === project
    const txs = periods.current.filter(matches)
    const annual = periods.cumulative.filter(matches)
    return { project, ...totals(txs), annual: totals(annual).profit }
  })
  const exportReport = () => {
    if (id === 'report-balance') exportCsv(`${definition.title}-${month}.csv`, ['资产', '期末余额', '期初余额', '负债和所有者权益', '期末余额', '期初余额'], equityRows.map((row) => [row.asset, row.assetValue === null ? '' : (row.assetValue / 100).toFixed(2), row.assetOpening === null ? '' : (row.assetOpening / 100).toFixed(2), row.liability, row.liabilityValue === null ? '' : (row.liabilityValue / 100).toFixed(2), row.liabilityOpening === null ? '' : (row.liabilityOpening / 100).toFixed(2)]))
    else if (id === 'report-amoeba') exportCsv(`${definition.title}-${month}.csv`, ['项目', '本月收入', '本月支出', '本月利润', '本年累计利润'], projectRows.map((row) => [row.project, (row.income / 100).toFixed(2), (row.expense / 100).toFixed(2), (row.profit / 100).toFixed(2), (row.annual / 100).toFixed(2)]))
    else exportCsv(`${definition.title}-${month}.csv`, ['项目', '本月金额（元）', '本年累计（元）'], rows.map((row) => [row.name, (row.current / 100).toFixed(2), (row.cumulative / 100).toFixed(2)]))
    notify(`${definition.title}已导出`)
  }
  return <div className="workspace-page report-page"><div className="page-heading"><div><h1>{definition.title}</h1><p>{id === 'report-balance' ? '资产、负债与权益，经营家底清清楚楚。' : id === 'report-cashflow' ? '跟着现金的流向，掌握经营的脉搏。' : id === 'report-amoeba' ? '按项目看收支，让每一份投入都有答案。' : '从数字读懂经营，下一步更有方向。'}</p></div><div className="heading-actions"><button className="button" onClick={() => window.print()}><Printer size={15} />打印</button><button className="button" onClick={exportReport}><Download size={15} />导出报表</button></div></div><div className="report-toolbar"><div className="month-switch"><button className="icon-button" aria-label="报表上个月" onClick={() => setMonth(monthShift(month, -1))}><ChevronLeft size={16} /></button><input type="month" aria-label="报表期间" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value) }} /><button className="icon-button" aria-label="报表下个月" onClick={() => setMonth(monthShift(month, 1))}><ChevronRight size={16} /></button></div><span className="muted">单位：人民币元</span><button className="button small" onClick={() => notify('报表已根据当前流水重新计算')}><RefreshCw size={13} />刷新</button></div>
    {id === 'report-tax' && <div className="tax-options"><span>税费测算参数</span><label>增值税率<select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))}><option value={1}>1%</option><option value={3}>3%</option><option value={6}>6%</option><option value={13}>13%</option></select></label><label>附加税率<select value={surchargeRate} onChange={(e) => setSurchargeRate(Number(e.target.value))}><option value={6}>6%</option><option value={10}>10%</option><option value={12}>12%</option></select></label><small>依据含税收入估算，实际申报以核定口径为准。</small></div>}
    {(id === 'report-profit' || id === 'report-amoeba') && <div className="report-stat-grid"><div><span>本月收入</span><strong className="income-text">¥{money(statistics.income)}</strong></div><div><span>本月支出</span><strong className="expense-text">¥{money(statistics.expense)}</strong></div><div><span>本月利润</span><strong>¥{money(statistics.profit)}</strong></div><div><span>利润率</span><strong>{statistics.income ? `${(statistics.profit / statistics.income * 100).toFixed(1)}%` : '—'}</strong></div></div>}
    <div className="report-paper print-area"><h2>{definition.title}</h2><div className="report-meta"><span>编制单位：{ledger.name}</span><span>{month.replace('-', ' 年 ')} 月</span><span>单位：元</span></div><div className="table-scroll">
      {id === 'report-balance' ? <table className="report-table balance-sheet"><thead><tr><th>资产</th><th>期末余额</th><th>期初余额</th><th>负债和所有者权益</th><th>期末余额</th><th>期初余额</th></tr></thead><tbody>{equityRows.map((row) => <tr key={row.asset} className={row.strong ? 'report-strong' : ''}><td>{row.asset}</td><td>{row.assetValue === null ? '' : money(row.assetValue)}</td><td>{row.assetOpening === null ? '' : money(row.assetOpening)}</td><td>{row.liability}</td><td>{row.liabilityValue === null ? '' : money(row.liabilityValue)}</td><td>{row.liabilityOpening === null ? '' : money(row.liabilityOpening)}</td></tr>)}</tbody></table> : id === 'report-amoeba' ? <table className="report-table"><thead><tr><th>项目 / 经营单元</th><th>本月收入</th><th>本月支出</th><th>本月利润</th><th>利润率</th><th>本年累计利润</th></tr></thead><tbody>{projectRows.map((row) => <tr key={row.project}><td>{row.project}</td><td>{money(row.income)}</td><td>{money(row.expense)}</td><td className={row.profit >= 0 ? 'income-text' : 'expense-text'}>{money(row.profit)}</td><td>{row.income ? `${(row.profit / row.income * 100).toFixed(1)}%` : '—'}</td><td>{money(row.annual)}</td></tr>)}<tr className="report-strong"><td>合计</td><td>{money(statistics.income)}</td><td>{money(statistics.expense)}</td><td>{money(statistics.profit)}</td><td>{statistics.income ? `${(statistics.profit / statistics.income * 100).toFixed(1)}%` : '—'}</td><td>{money(totals(periods.cumulative).profit)}</td></tr></tbody></table> : <table className="report-table"><thead><tr><th>项目</th><th className="line-column">行次</th><th>本月金额</th><th>本年累计金额</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.name} className={row.strong ? 'report-strong' : ''}><td className={row.indent ? 'indented' : ''}>{row.name}</td><td className="line-column">{i + 1}</td><td>{money(row.current)}</td><td>{money(row.cumulative)}</td></tr>)}</tbody></table>}
    </div><div className="report-signatures"><span>单位负责人：管理员</span><span>制表人：小番</span><span>数据来源：当前账套业务流水</span></div></div>
  </div>
}

export function BalanceReport({ id }: { id: string }) {
  const { ledger, openPage, notify } = useFinance()
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const kind = id.split('-')[1]
  const definition = pageById(id)
  const period = periodRows(ledger, month)
  const end = `${month}-31`
  const start = `${monthShift(month, -1)}-31`
  const inventory = kind === 'inventory'
  const rows = useMemo(() => {
    if (kind === 'account') return ledger.accounts.map((a) => {
      const accepted = period.current.filter((tx) => tx.status === '已记账')
      const incoming = accepted.filter((tx) => tx.kind === 'income' && tx.accountId === a.id || tx.kind === 'transfer' && tx.targetAccountId === a.id).reduce((sum, tx) => sum + tx.amount, 0)
      const outgoing = accepted.filter((tx) => (tx.kind === 'expense' || tx.kind === 'transfer') && tx.accountId === a.id).reduce((sum, tx) => sum + tx.amount, 0)
      return { name: a.name, code: a.type, opening: accountBalance(ledger, a.id, start), income: incoming, expense: outgoing, closing: accountBalance(ledger, a.id, end) }
    })
    if (kind === 'relative') return [...ledger.relatives, ...(ledger.transactions.some((tx) => !tx.relative && (tx.status === '待收款' || tx.status === '待付款')) ? ['未指定往来单位'] : [])].map((name) => {
      const matches = (tx: Transaction) => name === '未指定往来单位' ? !tx.relative : tx.relative === name
      const accepted = ledger.transactions.filter((tx) => tx.status !== '草稿' && tx.date <= end && matches(tx))
      const receivable = accepted.filter((tx) => tx.status === '待收款').reduce((sum, tx) => sum + tx.amount, 0)
      const payable = accepted.filter((tx) => tx.status === '待付款').reduce((sum, tx) => sum + tx.amount, 0)
      const amounts = totals(period.current.filter(matches))
      return { name, code: '往来单位', opening: receivable, income: amounts.income, expense: amounts.expense, closing: receivable - payable }
    })
    const groups = kind === 'project' ? [...ledger.projects, ...(ledger.transactions.some((tx) => !tx.project) ? ['未分配项目'] : [])] : kind === 'income' ? ['收入', '支出'] : [...ledger.categories.income, ...ledger.categories.expense]
    return groups.map((name, index) => {
      const matches = (tx: Transaction) => kind === 'project' ? name === '未分配项目' ? !tx.project : tx.project === name : kind === 'income' ? tx.kind === (name === '收入' ? 'income' : 'expense') : tx.category === name
      const opening = totals(ledger.transactions.filter((tx) => tx.date <= start && matches(tx))).profit
      const values = totals(period.current.filter(matches))
      return { name, code: kind === 'subject' ? `${ledger.categories.income.includes(name) ? '6001' : '6602'}.${String(index + 1).padStart(2, '0')}` : kind === 'project' ? '项目' : ledger.categories.income.includes(name) ? '收入类' : '支出类', opening, income: values.income, expense: values.expense, closing: opening + values.profit }
    })
  }, [ledger, month, kind])
  const filtered = rows.filter((row) => row.name.includes(search))
  const inventoryRows = ledger.inventory.filter((item) => item.name.includes(search))
  const totalsRow = filtered.reduce((sum, row) => ({ opening: sum.opening + row.opening, income: sum.income + row.income, expense: sum.expense + row.expense, closing: sum.closing + row.closing }), { opening: 0, income: 0, expense: 0, closing: 0 })
  const headers = inventory ? ['存货名称', '单位', '结存数量', '单位成本（元）', '结存金额（元）'] : ['名称', kind === 'relative' ? '应收余额' : '期初余额', '本期收入', '本期支出', kind === 'relative' ? '净往来余额' : '期末余额']
  const exportReport = () => {
    exportCsv(`${definition.title}-${month}.csv`, headers, inventory ? inventoryRows.map((item) => [item.name, item.unit, item.quantity, (item.cost / 100).toFixed(2), (item.quantity * item.cost / 100).toFixed(2)]) : filtered.map((row) => [row.name, (row.opening / 100).toFixed(2), (row.income / 100).toFixed(2), (row.expense / 100).toFixed(2), (row.closing / 100).toFixed(2)]))
    notify(`${definition.title}已导出`)
  }
  return <div className="workspace-page"><div className="page-heading"><div><h1>{definition.title}</h1><p>余额有全貌，明细有来路。</p></div><div className="heading-actions"><button className="button" onClick={() => window.print()}><Printer size={15} />打印</button><button className="button" onClick={exportReport}><Download size={15} />导出</button></div></div>{kind === 'account' && <div className="balance-overview"><div><span>账户期末总余额</span><strong>¥{money(totalsRow.closing)}</strong><p>{ledger.accounts.length} 个资金账户 · {month.replace('-', '.')}</p></div><AccountBars ledger={ledger} /></div>}<div className="data-panel"><div className="simple-filter"><label>期间<input type="month" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value) }} /></label><div className="search-input"><input aria-label="搜索余额表" placeholder={`搜索${inventory ? '存货' : '名称'}`} value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="muted">金额单位：元</span></div><div className="table-scroll"><table className="data-table balance-report-table"><thead><tr>{headers.map((header, i) => <th key={header} className={i > 0 ? 'text-right' : ''}>{header}</th>)}{!inventory && <th>操作</th>}</tr></thead><tbody>{inventory ? inventoryRows.map((item) => <tr key={item.id}><td>{item.name}</td><td className="text-right">{item.unit}</td><td className="text-right mono">{item.quantity}</td><td className="text-right mono">{money(item.cost)}</td><td className="text-right mono">{money(item.quantity * item.cost)}</td></tr>) : filtered.map((row) => <tr key={row.name}><td><span className="table-primary">{row.name}</span><span className="table-secondary">{row.code}</span></td><td className="text-right mono">{money(row.opening)}</td><td className="text-right mono income-text">{money(row.income)}</td><td className="text-right mono expense-text">{money(row.expense)}</td><td className="text-right mono">{money(row.closing)}</td><td><button className="text-link" onClick={() => openPage(`detail-${kind}`)}>查看明细</button></td></tr>)}{(inventory ? inventoryRows.length : filtered.length) > 0 && <tr className="total-row"><td>合计</td>{inventory ? <><td /><td className="text-right">{inventoryRows.reduce((sum, i) => sum + i.quantity, 0)}</td><td /><td className="text-right mono">{money(inventoryRows.reduce((sum, i) => sum + i.quantity * i.cost, 0))}</td></> : <><td className="text-right mono">{money(totalsRow.opening)}</td><td className="text-right mono">{money(totalsRow.income)}</td><td className="text-right mono">{money(totalsRow.expense)}</td><td className="text-right mono">{money(totalsRow.closing)}</td><td /></>}</tr>}</tbody></table></div>{!(inventory ? inventoryRows.length : filtered.length) && <EmptyState title="还没有对应的数据" text="添加基础资料或录入业务后，余额会显示在这里。" action={<button className="button primary-outline" onClick={() => openPage(inventory ? 'settings-inventory' : 'entry')}>{inventory ? '添加存货' : '录入流水'}</button>} />}</div></div>
}

export function InventoryDetail() {
  const { ledger, openPage } = useFinance()
  return <div className="workspace-page"><div className="page-heading"><div><h1>存货明细表</h1><p>查看每一种存货的结存数量和成本。</p></div><button className="button primary" onClick={() => openPage('settings-inventory')}>管理存货</button></div><div className="data-panel"><table className="data-table"><thead><tr><th>存货名称</th><th>业务说明</th><th>单位</th><th className="text-right">结存数量</th><th className="text-right">单位成本</th><th className="text-right">结存金额</th></tr></thead><tbody>{ledger.inventory.map((item) => <tr key={item.id}><td>{item.name}</td><td>期初结存</td><td>{item.unit}</td><td className="text-right">{item.quantity}</td><td className="text-right mono">{money(item.cost)}</td><td className="text-right mono">{money(item.quantity * item.cost)}</td></tr>)}</tbody></table>{!ledger.inventory.length && <EmptyState title="还没有存货明细" text="在存货管理中添加商品与期初结存。" />}</div></div>
}
