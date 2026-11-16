import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const cdpURL = process.env.PLAYWRIGHT_CDP_URL
const browser = cdpURL
  ? await chromium.connectOverCDP(cdpURL)
  : await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--disable-extensions', '--no-first-run', '--disable-sync'],
  })
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Shanghai',
  reducedMotion: 'reduce', acceptDownloads: true,
})
const page = await context.newPage()
page.setDefaultTimeout(10_000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const output = path.resolve('test-results')
await fs.mkdir(output, { recursive: true })
const reports = []
const panel = () => page.locator('.page-panel:not([hidden])')

const names = { account: '账户', relative: '往来', project: '项目', inventory: '存货', income: '收支', type: '类型', subject: '科目' }
const titles = {
  home: '首页', entry: '录入流水', transactions: '流水管理', drafts: '流水草稿',
  vouchers: '凭证管理', logs: '财务动态', 'report-profit': '利润表',
  'report-balance': '资产负债表', 'report-cashflow': '现金流量表',
  'report-tax': '应交税费表', 'report-amoeba': '阿米巴损益表',
  'settings-ledger': '账套设置', 'settings-accounts': '账户设置',
  'settings-categories': '流水类别', 'settings-relatives': '往来单位',
  'settings-projects': '项目管理', 'settings-inventory': '存货管理', 'settings-home': '首页设置',
}
const titleOf = (id) => titles[id] ?? `${names[id.split('-')[1]]}${id.startsWith('balance-') ? '余额表' : '明细表'}`
const route = async (id) => {
  await page.evaluate((value) => { window.location.hash = `#/${value}` }, id)
  await page.waitForFunction((value) => document.querySelector(`[role="tabpanel"]:not([hidden])`)?.getAttribute('aria-label') === value, titleOf(id))
}
const stored = () => page.evaluate(() => {
  const values = JSON.parse(localStorage.getItem('xiaofan.finance.ledgers.v1'))
  const active = JSON.parse(localStorage.getItem('xiaofan.finance.active'))
  return values.find((ledger) => ledger.id === active) ?? values[0]
})
const cents = (text) => Math.round(Number(text.replace(/[¥,\s]/g, '')) * 100)
const check = (description) => { reports.push(description); console.log(`PASS ${description}`) }
const balance = async (name) => {
  await route('balance-account')
  const row = panel().locator('.balance-report-table tbody tr').filter({ hasText: name })
  return cents(await row.locator('td').nth(4).innerText())
}
const beginEntry = async (kind = 'income') => {
  await page.getByRole('button', { name: '录入', exact: true }).click()
  await page.getByRole('menuitem', { name: '录入流水', exact: true }).click()
  if (kind !== 'income') await page.locator('.kind-tabs').getByRole('button', { name: kind === 'expense' ? '支出' : '转账', exact: true }).click()
}
const fill = async (summary, amount) => {
  await page.getByLabel(/摘要/).fill(summary)
  await page.getByRole('spinbutton', { name: '金额', exact: true }).fill(amount)
}
const save = async () => {
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('heading', { name: '流水管理', exact: true }).waitFor()
}
const filter = async (keyword) => {
  await route('transactions')
  await panel().getByLabel('搜索流水', { exact: true }).fill(keyword)
  await page.getByRole('button', { name: '查询', exact: true }).click()
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.bringToFront()
  await page.setViewportSize({ width: 1600, height: 1000 })
  assert.equal(await page.locator('.home-card').count(), 8)
  assert.equal(await page.locator('.cockpit-stats strong.income').innerText(), '141.62万')
  await page.screenshot({ path: path.join(output, 'home-desktop.png') })
  check('首页、演示数据和双列组件正常渲染')

  const initial = await stored()
  const originalBank = await balance('建设银行')
  const originalOtherBank = await balance('工商银行')
  await beginEntry()
  await fill('验收收入 · 产品销售', '1234.56')
  await page.getByLabel(/往来单位/).fill('验收客户')
  await save()
  const income = (await stored()).transactions.find((tx) => tx.summary === '验收收入 · 产品销售')
  assert.equal(income.amount, 123456)
  assert.equal(await balance('建设银行'), originalBank + 123456)
  assert.ok((await stored()).relatives.includes('验收客户'))
  await route('home')
  assert.equal(await page.locator('.cockpit-stats strong.income').innerText(), '141.74万')
  check('录入收入精确到分，账户余额与首页统计同步更新')

  await beginEntry('expense')
  await fill('验收费用 · 待支付', '88.88')
  await page.locator('.entry-form').getByLabel(/收付状态/).selectOption('待付款')
  await save()
  const pending = (await stored()).transactions.find((tx) => tx.summary === '验收费用 · 待支付')
  assert.equal(pending.status, '待付款')
  assert.equal(await balance('建设银行'), originalBank + 123456)
  await route('report-balance')
  const lastBalance = page.locator('.balance-sheet tbody tr').last()
  assert.equal(cents(await lastBalance.locator('td').nth(1).innerText()), cents(await lastBalance.locator('td').nth(4).innerText()))
  check('待付款计入负债、账户余额不提前扣款，资产负债保持平衡')

  await beginEntry('transfer')
  await fill('验收账户转账', '37.25')
  await page.getByLabel(/转入账户/).selectOption('bank-icbc')
  await save()
  assert.equal(await balance('建设银行'), originalBank + 123456 - 3725)
  assert.equal(await balance('工商银行'), originalOtherBank + 3725)
  await route('home')
  assert.equal(await page.locator('.cockpit-stats strong.income').innerText(), '141.74万')
  check('账户转账两端同步记账，并且不重复计入营业收入')

  await beginEntry()
  await fill('验收草稿', '12.34')
  await page.getByRole('button', { name: '存为草稿', exact: true }).click()
  await page.getByRole('heading', { name: '流水草稿', exact: true }).waitFor()
  assert.equal((await stored()).transactions.find((tx) => tx.summary === '验收草稿').status, '草稿')
  assert.equal(await balance('建设银行'), originalBank + 123456 - 3725)
  check('草稿可保存，且不影响实际账户余额')

  await filter('验收费用')
  const pendingRow = panel().locator('.transaction-table tbody tr').filter({ hasText: '验收费用' })
  await pendingRow.getByLabel(`更多操作 ${pending.code}`, { exact: true }).click()
  await page.getByRole('button', { name: '完成收付', exact: true }).click()
  assert.equal((await stored()).transactions.find((tx) => tx.id === pending.id).status, '已记账')
  assert.equal(await balance('建设银行'), originalBank + 123456 - 3725 - 8888)
  check('完成待付款后，账户余额准确扣减')

  await filter('验收收入')
  await panel().getByLabel(`选择流水 ${income.code}`, { exact: true }).check()
  await page.getByRole('button', { name: '生成凭证', exact: true }).click()
  const voucher = (await stored()).transactions.find((tx) => tx.id === income.id)
  assert.ok(voucher.voucherNo)
  await route('vouchers')
  await page.getByRole('button', { name: voucher.voucherNo, exact: true }).click()
  const voucherTable = page.locator('.voucher-table tbody tr').last()
  assert.equal(await voucherTable.locator('td').nth(1).innerText(), '1,234.56')
  assert.equal(await voucherTable.locator('td').nth(2).innerText(), '1,234.56')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  check('从业务生成凭证，凭证借贷金额相等')

  await filter('验收收入')
  await panel().locator('.transaction-table tbody tr').first().getByTitle('编辑流水', { exact: true }).click()
  await page.getByRole('spinbutton', { name: '金额', exact: true }).fill('987.65')
  await save()
  assert.equal((await stored()).transactions.find((tx) => tx.id === income.id).amount, 98765)
  assert.equal(await balance('建设银行'), originalBank + 98765 - 3725 - 8888)
  await filter('验收收入')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出', exact: true }).click(),
  ])
  await download.saveAs(path.join(output, download.suggestedFilename()))
  const csv = await fs.readFile(path.join(output, download.suggestedFilename()), 'utf8')
  assert.ok(csv.includes('验收收入 · 产品销售'))
  assert.ok(csv.includes('987.65'))
  check('编辑既有流水同步余额，筛选结果可导出为 CSV')

  await page.getByLabel('切换账套', { exact: true }).selectOption('__new__')
  await page.getByLabel(/账套名称/).fill('验收空白账套')
  await page.getByRole('button', { name: '创建账套', exact: true }).click()
  assert.equal((await stored()).transactions.length, 0)
  const newId = (await stored()).id
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.getByLabel('切换账套', { exact: true }).inputValue(), newId)
  await page.getByLabel('切换账套', { exact: true }).selectOption(initial.id)
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal((await stored()).transactions.find((tx) => tx.id === income.id).amount, 98765)
  check('账套数据互相独立，当前账套和业务数据刷新后持久保留')

  const ids = [
    'report-profit', 'report-balance', 'report-cashflow', 'report-tax', 'report-amoeba',
    ...['account', 'relative', 'project', 'inventory', 'income', 'type', 'subject'].map((name) => `balance-${name}`),
    ...['account', 'relative', 'project', 'inventory', 'income', 'type', 'subject'].map((name) => `detail-${name}`),
    'settings-ledger', 'settings-accounts', 'settings-categories', 'settings-relatives',
    'settings-projects', 'settings-inventory', 'settings-home', 'logs',
  ]
  for (const id of ids) {
    await route(id)
    await page.getByRole('heading', { name: titleOf(id), exact: true, level: 1 }).waitFor()
  }
  assert.deepEqual(errors, [])
  check(`${ids.length} 个报表、明细和设置页面均正常打开，无运行时异常`)

  await route('home')
  await page.getByRole('button', { name: '管理', exact: true }).nth(1).click()
  await page.getByLabel('录入流水', { exact: false }).check()
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.locator('.favorites-card .app-tile').count(), 4)
  check('常用功能定制后，刷新保持选择')

  await page.setViewportSize({ width: 390, height: 844 })
  const homeWidth = await page.locator('.page-scroll').evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }))
  assert.ok(homeWidth.scroll <= homeWidth.width + 1, '移动首页不应横向溢出')
  await page.screenshot({ path: path.join(output, 'home-mobile.png') })
  await beginEntry()
  const entryWidth = await page.locator('.page-scroll').evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }))
  assert.ok(entryWidth.scroll <= entryWidth.width + 1, '移动录入表单不应横向溢出')
  await page.screenshot({ path: path.join(output, 'entry-mobile.png') })
  check('390px 移动首页和录入表单适配，无页面横向溢出')

  await route('transactions')
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.screenshot({ path: path.join(output, 'transactions-desktop.png') })
  await route('report-profit')
  await page.screenshot({ path: path.join(output, 'profit-desktop.png') })
  assert.deepEqual(errors, [])
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ passed: reports.length, reports, runtimeErrors: errors }, null, 2))
  console.log(`\n${reports.length} groups passed. Screenshots and results: ${output}`)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  await context.close()
  await browser.close()
}
