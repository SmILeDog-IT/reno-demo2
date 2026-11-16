import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleHelp, FileClock, Paperclip, Plus, Save, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { currentMonth, KIND_LABEL, localDate, money, nextCode, uid } from './data'
import type { Transaction, TransactionKind, TransactionStatus } from './data'
import { useFinance } from './finance-context'
import { AppIcon } from './ui'

interface EntryForm {
  date: string; kind: TransactionKind; category: string; summary: string; amount: string;
  accountId: string; targetAccountId: string; relative: string; project: string; status: TransactionStatus;
}

export default function Entry() {
  const { ledger, updateLedger, openPage, notify, editTransaction, clearEditing } = useFinance()
  const blank = (): EntryForm => ({
    date: localDate(), kind: 'income', category: ledger.categories.income[0] ?? '销售收入',
    summary: '', amount: '', accountId: ledger.accounts.find((a) => a.enabled)?.id ?? '',
    targetAccountId: '', relative: '', project: ledger.projects[0] ?? '', status: '已记账',
  })
  const [form, setForm] = useState<EntryForm>(blank)
  const [error, setError] = useState('')
  const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([])
  const [mode, setMode] = useState<'save' | 'new'>('save')
  const [help, setHelp] = useState(false)
  useEffect(() => {
    if (editTransaction) setForm({ ...editTransaction, amount: (editTransaction.amount / 100).toFixed(2), targetAccountId: editTransaction.targetAccountId ?? '' })
    else setForm(blank())
    setError('')
    setAttachments([])
    // An opened entry tab follows the currently selected ledger and editing row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTransaction?.id, ledger.id])
  const field = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => setForm((current) => ({ ...current, [key]: value }))
  const changeKind = (kind: TransactionKind) => setForm((current) => ({ ...current, kind, category: kind === 'transfer' ? '账户转账' : ledger.categories[kind][0] ?? '', status: '已记账' }))
  const validate = () => {
    if (!form.date) return '请选择业务日期'
    if (!form.summary.trim()) return '请填写摘要，让这笔流水有据可查'
    if (!form.category) return '请选择流水类别'
    if (!form.accountId) return '请先在账户设置中添加一个可用账户'
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999.99) return '请输入大于 0、且不超过 999,999,999.99 的金额'
    if (!/^\d+(\.\d{1,2})?$/.test(form.amount)) return '金额最多保留两位小数'
    if (form.kind === 'transfer' && !form.targetAccountId) return '请选择转入账户'
    if (form.kind === 'transfer' && form.targetAccountId === form.accountId) return '转出账户和转入账户需要不同'
    return ''
  }
  const save = (draft = false, keepAdding = false) => {
    const problem = validate()
    if (problem) { setError(problem); return }
    const transaction: Transaction = {
      id: editTransaction?.id ?? uid(), code: editTransaction?.code ?? nextCode(ledger.transactions, form.date),
      date: form.date, kind: form.kind, category: form.category, summary: form.summary.trim(),
      amount: Math.round(Number(form.amount) * 100), accountId: form.accountId,
      ...(form.kind === 'transfer' ? { targetAccountId: form.targetAccountId } : {}),
      relative: form.relative.trim(), project: form.project,
      status: draft ? '草稿' : form.status, reviewed: false,
    }
    updateLedger((current) => ({
      ...current,
      relatives: form.relative.trim() && !current.relatives.includes(form.relative.trim()) ? [...current.relatives, form.relative.trim()] : current.relatives,
      transactions: editTransaction ? current.transactions.map((tx) => tx.id === transaction.id ? transaction : tx) : [transaction, ...current.transactions],
    }), `${editTransaction ? '修改' : draft ? '保存草稿' : '录入'}${KIND_LABEL[form.kind]}流水：${form.summary.trim()}`)
    notify(draft ? '草稿已保存，可以稍后继续编辑' : editTransaction ? '流水已更新，相关统计已同步' : '流水保存成功，账本又清楚了一笔')
    clearEditing()
    setForm(blank()); setError(''); setAttachments([])
    if (!keepAdding) openPage(draft ? 'drafts' : 'transactions')
  }
  const submit = (event: FormEvent) => { event.preventDefault(); save(false, mode === 'new') }
  const pending = form.kind === 'income' ? '待收款' : '待付款'
  return <div className="entry-page workspace-page">
    <div className="page-heading"><div><h1>{editTransaction ? '编辑流水' : '录入流水'}</h1><p>记录业务发生，让财务自动归位。</p></div><button className="button" onClick={() => openPage('drafts')}><FileClock size={15} />流水草稿<span className="count-bubble">{ledger.transactions.filter((tx) => tx.status === '草稿').length}</span></button></div>
    <form className="entry-card" onSubmit={submit}>
      <div className="entry-topbar"><div className="kind-tabs">{(['income', 'expense', 'transfer'] as const).map((kind) => <button className={`${form.kind === kind ? 'active' : ''} ${kind}`} type="button" key={kind} onClick={() => changeKind(kind)}>{KIND_LABEL[kind]}</button>)}</div><span className="entry-number">{editTransaction?.code ?? nextCode(ledger.transactions, `${currentMonth}-01`)}</span></div>
      <div className="entry-form">
        <div className="form-section-label"><span>基本信息</span><button type="button" className="icon-button" onClick={() => setHelp(!help)} aria-label="录入帮助"><CircleHelp size={16} /></button></div>
        {help && <div className="inline-info">先选择收入、支出或转账，再填写业务日期、类别和金额。待收款 / 待付款会计入经营统计，完成收付后才更新账户余额。</div>}
        <div className="form-grid">
          <label className="form-field"><span>业务日期 <b>*</b></span><input required type="date" value={form.date} onChange={(e) => field('date', e.target.value)} /></label>
          <label className="form-field"><span>流水类别 <b>*</b></span><select required value={form.category} onChange={(e) => field('category', e.target.value)}>{form.kind === 'transfer' ? <option>账户转账</option> : ledger.categories[form.kind].map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="form-field full"><span>摘要 <b>*</b></span><input required maxLength={120} placeholder={form.kind === 'income' ? '例如：收到产品销售回款' : form.kind === 'expense' ? '例如：支付本月办公场地租金' : '例如：基本户转入一般户'} value={form.summary} onChange={(e) => field('summary', e.target.value)} /><small className="field-counter">{form.summary.length}/120</small></label>
          <label className="form-field"><span>{form.kind === 'transfer' ? '转出账户' : form.kind === 'income' ? '收款账户' : '付款账户'} <b>*</b></span><select value={form.accountId} onChange={(e) => field('accountId', e.target.value)}>{!ledger.accounts.some((a) => a.enabled) && <option value="">请先添加账户</option>}{ledger.accounts.filter((a) => a.enabled).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
          {form.kind === 'transfer' ? <label className="form-field"><span>转入账户 <b>*</b></span><select value={form.targetAccountId} onChange={(e) => field('targetAccountId', e.target.value)}><option value="">选择转入账户</option>{ledger.accounts.filter((a) => a.enabled && a.id !== form.accountId).map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label> : <label className="form-field"><span>往来单位</span><input list="relative-options" value={form.relative} placeholder="选择或输入往来单位" onChange={(e) => field('relative', e.target.value)} /><datalist id="relative-options">{ledger.relatives.map((relative) => <option value={relative} key={relative} />)}</datalist></label>}
          <label className="form-field"><span>所属项目</span><select value={form.project} onChange={(e) => field('project', e.target.value)}><option value="">不指定项目</option>{ledger.projects.map((project) => <option key={project}>{project}</option>)}</select></label>
          <label className="form-field"><span>收付状态</span><select value={form.status === '草稿' ? '已记账' : form.status} onChange={(e) => field('status', e.target.value as TransactionStatus)}><option value="已记账">{form.kind === 'income' ? '已收款' : form.kind === 'expense' ? '已付款' : '已完成转账'}</option>{form.kind !== 'transfer' && <option value={pending}>{pending}</option>}</select></label>
        </div>
        <div className="amount-section"><label htmlFor="entry-amount">{form.kind === 'income' ? '收入金额' : form.kind === 'expense' ? '支出金额' : '转账金额'} <b>*</b></label><div className={`amount-input ${form.kind}`}><span>¥</span><input id="entry-amount" aria-label="金额" inputMode="decimal" type="number" min="0.01" max="999999999.99" step="0.01" required placeholder="0.00" value={form.amount} onChange={(e) => field('amount', e.target.value)} /><span className="amount-currency">人民币 CNY</span></div><p>{form.amount && Number(form.amount) > 0 ? `合计：人民币 ${money(Math.round(Number(form.amount) * 100))} 元` : '请输入本次业务的实际发生金额'}</p></div>
        <div className="attachment-section"><label className="attachment-button"><Paperclip size={16} />添加附件<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { setAttachments((current) => [...current, ...Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size }))]); e.target.value = '' }} /></label><span>支持图片、PDF 和办公文档 · 本次预览</span></div>
        {attachments.length > 0 && <div className="attachment-list">{attachments.map((attachment, i) => <div key={`${attachment.name}-${i}`}><Paperclip size={13} /><span>{attachment.name}</span><small>{Math.ceil(attachment.size / 1024)} KB</small><button type="button" onClick={() => setAttachments((current) => current.filter((_, index) => index !== i))} aria-label={`移除附件 ${attachment.name}`}><X size={13} /></button></div>)}</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
      <div className="entry-footer"><button type="button" className="button" onClick={() => save(true)}><FileClock size={15} />存为草稿</button><div><button type="button" className="button" onClick={() => { setForm(blank()); clearEditing(); setError(''); setAttachments([]) }}>重置</button><button type="submit" className="button primary-outline" onClick={() => setMode('new')}><Plus size={15} />保存并新增</button><button type="submit" className="button primary" onClick={() => setMode('save')}><Save size={15} />保存</button></div></div>
    </form>
    <div className="entry-how"><span><AppIcon name="entry" size={16} />录入业务</span><ArrowRight size={14} /><span><Check size={16} />自动更新账本</span><ArrowRight size={14} /><span><AppIcon name="pie" size={16} />看懂经营</span></div>
  </div>
}
