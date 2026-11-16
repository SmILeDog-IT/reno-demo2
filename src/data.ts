export type TransactionKind = 'income' | 'expense' | 'transfer'
export type TransactionStatus = '已记账' | '待收款' | '待付款' | '草稿'

export interface Account {
  id: string
  name: string
  type: '银行账户' | '现金账户' | '网络账户'
  opening: number
  enabled: boolean
}

export interface Transaction {
  id: string
  code: string
  date: string
  kind: TransactionKind
  category: string
  summary: string
  amount: number
  accountId: string
  targetAccountId?: string
  relative: string
  project: string
  status: TransactionStatus
  reviewed: boolean
  voucherNo?: string
}

export interface Activity {
  id: string
  time: string
  text: string
  user: string
}

export interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  cost: number
}

export interface Ledger {
  id: string
  name: string
  version: '智能版' | '会计版'
  accounts: Account[]
  transactions: Transaction[]
  categories: { income: string[]; expense: string[] }
  relatives: string[]
  projects: string[]
  inventory: InventoryItem[]
  activities: Activity[]
}

export const KIND_LABEL: Record<TransactionKind, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
}

export const money = (cents: number, digits = 2) =>
  (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const wan = (cents: number) => (cents / 1_000_000).toFixed(2)

export const localDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return ['year', 'month', 'day'].map((type) => parts.find((p) => p.type === type)?.value).join('-')
}

export const localTime = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date())

export const uid = () => crypto.randomUUID()
export const currentMonth = localDate().slice(0, 7)

export function monthShift(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function nextCode(transactions: Transaction[], date: string) {
  const prefix = `LS-${date.slice(0, 7).replace('-', '')}-`
  const highest = transactions.reduce((max, tx) =>
    tx.code.startsWith(prefix) ? Math.max(max, Number(tx.code.slice(prefix.length)) || 0) : max, 0)
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

export function accountBalance(ledger: Ledger, accountId: string, through?: string) {
  const opening = ledger.accounts.find((account) => account.id === accountId)?.opening ?? 0
  return ledger.transactions.reduce((sum, tx) => {
    if (tx.status !== '已记账' || (through && tx.date > through)) return sum
    if (tx.kind === 'transfer') {
      return sum + (tx.targetAccountId === accountId ? tx.amount : 0) - (tx.accountId === accountId ? tx.amount : 0)
    }
    return sum + (tx.accountId === accountId ? tx.amount * (tx.kind === 'income' ? 1 : -1) : 0)
  }, opening)
}

export function totals(transactions: Transaction[], month?: string) {
  const rows = transactions.filter((tx) => tx.status !== '草稿' && (!month || tx.date.startsWith(month)))
  const income = rows.filter((tx) => tx.kind === 'income').reduce((sum, tx) => sum + tx.amount, 0)
  const expense = rows.filter((tx) => tx.kind === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
  return { income, expense, profit: income - expense }
}

export function monthData(ledger: Ledger, lastMonth: string, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const month = monthShift(lastMonth, i - count + 1)
    return { month, label: `${Number(month.slice(5))}月`, ...totals(ledger.transactions, month) }
  })
}

function makeAccounts(blank = false): Account[] {
  return [
    { id: 'bank-ccb', name: '建设银行 · 基本户', type: '银行账户', opening: blank ? 0 : 16850000, enabled: true },
    { id: 'bank-icbc', name: '工商银行 · 一般户', type: '银行账户', opening: blank ? 0 : 8560000, enabled: true },
    { id: 'cash', name: '库存现金', type: '现金账户', opening: blank ? 0 : 6200000, enabled: true },
    { id: 'alipay', name: '支付宝', type: '网络账户', opening: blank ? 0 : 862050, enabled: true },
    { id: 'wechat', name: '微信支付', type: '网络账户', opening: blank ? 0 : 526080, enabled: true },
  ]
}

const incomeCategories = ['销售收入', '服务收入', '其他收入']
const expenseCategories = ['采购支出', '工资薪酬', '办公费用', '差旅交通', '营销费用', '租金物业', '其他支出']

export function createLedger(name: string, version: Ledger['version'] = '智能版', demo = false): Ledger {
  const date = localDate()
  const month = date.slice(0, 7)
  const transactions: Transaction[] = []
  if (demo) {
    const monthlyIncome = [186_500, 218_600, 239_800, 226_300, 268_700, 276_300]
    const monthlyExpense = [91_200, 105_400, 109_600, 103_800, 119_400, 124_000]
    for (let i = 0; i < 6; i++) {
      const period = monthShift(month, i - 5)
      const income = monthlyIncome[i]
      const expense = monthlyExpense[i]
      const values: [TransactionKind, number, string, string, string, string, string][] = [
        ['income', Math.round(income * .38), '销售收入', '春禾商贸', '产品销售回款', 'bank-ccb', '商贸业务'],
        ['income', Math.round(income * .29), '服务收入', '云帆科技', '品牌设计项目服务费', 'bank-icbc', '品牌设计'],
        ['income', Math.round(income * .21), '销售收入', '青山生活馆', '线上商城销售收入', 'alipay', '线上零售'],
        ['income', income - Math.round(income * .38) - Math.round(income * .29) - Math.round(income * .21), '其他收入', '星河工作室', '运营咨询服务收入', 'wechat', '咨询服务'],
        ['expense', Math.round(expense * .43), '采购支出', '杭州优品供应链', '采购办公及零售商品', 'bank-ccb', '商贸业务'],
        ['expense', Math.round(expense * .31), '工资薪酬', '', '发放本月员工薪酬', 'bank-icbc', '公共项目'],
        ['expense', Math.round(expense * .12), '租金物业', '创意园物业', '办公场地租金及物业费', 'bank-ccb', '公共项目'],
        ['expense', Math.round(expense * .08), '营销费用', '云帆科技', '线上广告投放费用', 'alipay', '线上零售'],
        ['expense', expense - Math.round(expense * .43) - Math.round(expense * .31) - Math.round(expense * .12) - Math.round(expense * .08), '办公费用', '青山生活馆', '日常办公及差旅支出', 'cash', '公共项目'],
      ]
      values.forEach(([kind, amount, category, relative, summary, accountId, project], index) => {
        const day = i === 5 ? [16, 15, 14, 12, 11, 10, 8, 6, 3][index] : [27, 25, 22, 20, 18, 15, 12, 8, 5][index]
        const rowDate = `${period}-${String(Math.min(day, i === 5 ? Number(date.slice(8)) : 28)).padStart(2, '0')}`
        transactions.push({
          id: `demo-${i}-${index}`, code: nextCode(transactions, rowDate), date: rowDate,
          kind, amount: amount * 100, category, relative, summary, accountId, project,
          status: i === 5 && index === 1 ? '待收款' : i === 5 && index === 4 ? '待付款' : '已记账',
          reviewed: i < 5 || index > 2,
          voucherNo: i < 5 ? `记-${period.replace('-', '')}-${String(index + 1).padStart(3, '0')}` : undefined,
        })
      })
    }
  }
  return {
    id: demo ? 'demo' : uid(), name, version,
    accounts: makeAccounts(!demo), transactions,
    categories: { income: [...incomeCategories], expense: [...expenseCategories] },
    relatives: demo ? ['春禾商贸', '云帆科技', '青山生活馆', '星河工作室', '杭州优品供应链', '创意园物业'] : [],
    projects: demo ? ['商贸业务', '品牌设计', '线上零售', '咨询服务', '公共项目'] : ['公共项目'],
    inventory: demo ? [
      { id: 'product-1', name: '简约办公笔记本', unit: '本', quantity: 320, cost: 1800 },
      { id: 'product-2', name: '便携保温杯', unit: '个', quantity: 185, cost: 6500 },
      { id: 'product-3', name: '桌面收纳套装', unit: '套', quantity: 96, cost: 8800 },
    ] : [],
    activities: demo ? [
      { id: 'log-1', time: `${date} 09:42:18`, text: '录入销售收入流水', user: '小番' },
      { id: 'log-2', time: `${date} 09:35:06`, text: '查看资产负债表', user: '小番' },
      { id: 'log-3', time: `${date} 09:30:12`, text: '登录财务工作台', user: '小番' },
      { id: 'log-4', time: `${date} 09:28:45`, text: '审核 3 笔业务流水', user: '管理员' },
      { id: 'log-5', time: `${date} 09:16:20`, text: '生成记账凭证', user: '管理员' },
      { id: 'log-6', time: `${date} 09:08:36`, text: '更新项目基础信息', user: '小番' },
      { id: 'log-7', time: `${date} 08:56:07`, text: '录入办公费用流水', user: '小番' },
      { id: 'log-8', time: `${date} 08:45:51`, text: '查看账户余额表', user: '管理员' },
      { id: 'log-9', time: `${date} 08:30:00`, text: '登录财务工作台', user: '管理员' },
    ] : [{ id: uid(), time: localTime(), text: '创建新账套', user: '管理员' }],
  }
}

export const initialLedger = () => createLedger('智能版演示账套（含演示数据）', '智能版', true)

export interface PageDefinition {
  id: string
  title: string
  group: string
  icon: string
  accent?: 'orange' | 'green'
}

export const pages: PageDefinition[] = [
  { id: 'home', title: '首页', group: '首页', icon: 'home' },
  { id: 'entry', title: '录入流水', group: '录入', icon: 'entry' },
  { id: 'drafts', title: '流水草稿', group: '录入', icon: 'draft' },
  { id: 'transactions', title: '流水管理', group: '管理', icon: 'search' },
  { id: 'vouchers', title: '凭证管理', group: '管理', icon: 'voucher', accent: 'orange' },
  { id: 'logs', title: '财务动态', group: '管理', icon: 'activity' },
  { id: 'report-profit', title: '利润表', group: '报表', icon: 'pie' },
  { id: 'report-balance', title: '资产负债表', group: '报表', icon: 'scale' },
  { id: 'report-cashflow', title: '现金流量表', group: '报表', icon: 'cashflow' },
  { id: 'report-tax', title: '应交税费表', group: '报表', icon: 'tax' },
  { id: 'report-amoeba', title: '阿米巴损益表', group: '报表', icon: 'network' },
  ...(['账户', '往来', '项目', '存货', '收支', '类型', '科目'] as const).map((name, i) => ({
    id: `balance-${['account', 'relative', 'project', 'inventory', 'income', 'type', 'subject'][i]}`,
    title: `${name}余额表`, group: '余额表', icon: `balance-${i}`,
    ...(i === 6 ? { accent: 'orange' as const } : {}),
  })),
  ...(['账户', '往来', '项目', '存货', '收支', '类型', '科目'] as const).map((name, i) => ({
    id: `detail-${['account', 'relative', 'project', 'inventory', 'income', 'type', 'subject'][i]}`,
    title: `${name}明细表`, group: '明细表', icon: `detail-${i}`,
    ...(i === 6 ? { accent: 'orange' as const } : {}),
  })),
  { id: 'settings-ledger', title: '账套设置', group: '设置', icon: 'ledger' },
  { id: 'settings-accounts', title: '账户设置', group: '设置', icon: 'wallet' },
  { id: 'settings-categories', title: '流水类别', group: '设置', icon: 'folder' },
  { id: 'settings-relatives', title: '往来单位', group: '设置', icon: 'users' },
  { id: 'settings-projects', title: '项目管理', group: '设置', icon: 'project' },
  { id: 'settings-inventory', title: '存货管理', group: '设置', icon: 'inventory' },
  { id: 'settings-home', title: '首页设置', group: '设置', icon: 'settings' },
]

export const pageById = (id: string) => pages.find((page) => page.id === id) ?? pages[0]

export const homeWidgets = [
  { id: 'favorites', title: '我常用的', column: 'left' },
  { id: 'reports', title: '报表', column: 'left' },
  { id: 'balances', title: '余额表 / 明细表', column: 'left' },
  { id: 'cockpit', title: '老板驾驶舱', column: 'left' },
  { id: 'bookkeeping', title: '智能记账', column: 'right' },
  { id: 'activity', title: '财务动态', column: 'right' },
  { id: 'accounts', title: '财务仪表盘', column: 'right' },
  { id: 'home-settings', title: '首页设置', column: 'right' },
]

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    let text = String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
