import React, { useState, useEffect } from 'react';
import {
  Network, RefreshCw, Plus, Edit2, Trash2, Scale, TrendingUp, BookOpen,
  Landmark, X, ChevronDown, ChevronLeft, BookText, CheckCircle2, AlertTriangle
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

type Tab = 'tree' | 'trial' | 'pl' | 'bs' | 'gl';

const ROOT_LABELS: Record<string, string> = {
  asset: 'الأصول', liability: 'الخصوم', equity: 'حقوق الملكية', income: 'الإيرادات', expense: 'المصروفات',
};

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'tree', label: 'شجرة الحسابات', icon: Network },
  { key: 'trial', label: 'ميزان المراجعة', icon: Scale },
  { key: 'pl', label: 'قائمة الدخل', icon: TrendingUp },
  { key: 'bs', label: 'الميزانية العمومية', icon: Landmark },
  { key: 'gl', label: 'دفتر الأستاذ', icon: BookOpen },
];

const todayStr = new Date().toISOString().split('T')[0];

const ChartOfAccountsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('tree');
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  // shared filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [asOf, setAsOf] = useState(todayStr);

  // data per tab
  const [tree, setTree] = useState<any[]>([]);
  const [trial, setTrial] = useState<any>(null);
  const [pl, setPl] = useState<any>(null);
  const [bs, setBs] = useState<any>(null);
  const [gl, setGl] = useState<any>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  // ledger accounts (for GL + journal entry selects)
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [glAccountId, setGlAccountId] = useState<string>('');

  // account add/edit modal
  const [acctModal, setAcctModal] = useState<{ mode: 'add' | 'edit'; parent?: any; account?: any } | null>(null);
  const [acctForm, setAcctForm] = useState({ name: '', name_ar: '', code: '', is_group: false });
  const [savingAcct, setSavingAcct] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // journal entry modal
  const [jeOpen, setJeOpen] = useState(false);
  const [jeDate, setJeDate] = useState(todayStr);
  const [jeRemarks, setJeRemarks] = useState('');
  const [jeLines, setJeLines] = useState<any[]>([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]);
  const [savingJe, setSavingJe] = useState(false);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { loadTab(); }, [tab, from, to, asOf, glAccountId]);

  const loadAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts', { params: { ledger_only: true } });
      setLedgerAccounts(res.data.data);
      if (!glAccountId && res.data.data.length) setGlAccountId(String(res.data.data[0].id));
    } catch { /* ignore */ }
  };

  const loadTab = async () => {
    setLoading(true);
    try {
      if (tab === 'tree') {
        const res = await api.get('/accounting/chart');
        setTree(res.data.data);
      } else if (tab === 'trial') {
        const res = await api.get('/accounting/trial-balance', { params: { from: from || undefined, to: to || undefined } });
        setTrial(res.data.data);
      } else if (tab === 'pl') {
        const res = await api.get('/accounting/profit-loss', { params: { from: from || undefined, to: to || undefined } });
        setPl(res.data.data);
      } else if (tab === 'bs') {
        const res = await api.get('/accounting/balance-sheet', { params: { as_of: asOf || undefined } });
        setBs(res.data.data);
      } else if (tab === 'gl' && glAccountId) {
        const res = await api.get('/accounting/general-ledger', { params: { account_id: glAccountId, from: from || undefined, to: to || undefined } });
        setGl(res.data.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      const res = await api.post('/accounting/rebuild');
      const r = res.data.data;
      toast.success(`تم الترحيل: ${r.sales} مبيعات، ${r.purchases} مشتريات، ${r.expenses} مصروفات`);
      loadTab();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في الترحيل');
    } finally {
      setRebuilding(false);
    }
  };

  const toggleCollapse = (id: number) => {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
  };

  // ── Account CRUD ──
  const openAddAccount = (parent: any) => {
    setAcctForm({ name: '', name_ar: '', code: '', is_group: false });
    setAcctModal({ mode: 'add', parent });
  };
  const openEditAccount = (account: any) => {
    setAcctForm({ name: account.name, name_ar: account.name_ar || '', code: account.code || '', is_group: account.is_group });
    setAcctModal({ mode: 'edit', account });
  };
  const saveAccount = async () => {
    if (!acctForm.name_ar && !acctForm.name) { toast.error('اسم الحساب مطلوب'); return; }
    try {
      setSavingAcct(true);
      if (acctModal?.mode === 'add') {
        await api.post('/accounting/accounts', {
          name: acctForm.name || acctForm.name_ar, name_ar: acctForm.name_ar || acctForm.name,
          code: acctForm.code || null, parent_id: acctModal.parent.id, is_group: acctForm.is_group,
        });
        toast.success('تمت إضافة الحساب');
      } else if (acctModal?.mode === 'edit') {
        await api.put(`/accounting/accounts/${acctModal.account.id}`, {
          name: acctForm.name || acctForm.name_ar, name_ar: acctForm.name_ar || acctForm.name, code: acctForm.code || null,
        });
        toast.success('تم تحديث الحساب');
      }
      setAcctModal(null);
      loadTab(); loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ الحساب');
    } finally {
      setSavingAcct(false);
    }
  };
  const doDeleteAccount = async () => {
    try {
      await api.delete(`/accounting/accounts/${deleteTarget.id}`);
      toast.success('تم حذف الحساب');
      setDeleteTarget(null);
      loadTab(); loadAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذّر حذف الحساب');
    }
  };

  // ── Journal Entry ──
  const jeTotals = jeLines.reduce((acc, l) => {
    acc.debit += parseFloat(l.debit) || 0;
    acc.credit += parseFloat(l.credit) || 0;
    return acc;
  }, { debit: 0, credit: 0 });
  const jeBalanced = Math.abs(jeTotals.debit - jeTotals.credit) < 0.01 && jeTotals.debit > 0;

  const submitJournal = async () => {
    if (!jeBalanced) { toast.error('القيد غير متوازن'); return; }
    try {
      setSavingJe(true);
      const lines = jeLines.filter(l => l.account_id && ((parseFloat(l.debit) || 0) || (parseFloat(l.credit) || 0)));
      const res = await api.post('/accounting/journal-entry', { posting_date: jeDate, remarks: jeRemarks, lines });
      toast.success(res.data.message);
      setJeOpen(false);
      setJeLines([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]);
      setJeRemarks('');
      loadTab();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في تسجيل القيد');
    } finally {
      setSavingJe(false);
    }
  };

  // ── Renderers ──
  const renderAmount = (v: number) => (
    <span className={v < 0 ? 'text-red-600' : 'text-stone-800'} dir="ltr">{formatCurrency(v)}</span>
  );

  // recursive row renderer for tree / P&L / BS
  const renderNodes = (nodes: any[], depth = 0, editable = false): any =>
    nodes.map((n) => {
      const hasChildren = n.children && n.children.length > 0;
      const isCollapsed = collapsed.has(n.id);
      return (
        <React.Fragment key={n.id}>
          <tr className={n.is_group ? 'bg-stone-50/60 font-bold' : 'hover:bg-stone-50'}>
            <td>
              <div className="flex items-center gap-1.5" style={{ paddingRight: `${depth * 22}px` }}>
                {hasChildren ? (
                  <button onClick={() => toggleCollapse(n.id)} className="text-stone-400 hover:text-stone-700">
                    {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                ) : <span className="w-4 inline-block" />}
                {n.code && <span className="text-xs text-stone-400 font-mono">{n.code}</span>}
                <span className={n.is_group ? 'text-stone-900' : 'text-stone-700'}>{n.name_ar || n.name}</span>
                {n.is_group && <span className="badge badge-gray text-[10px]">مجموعة</span>}
              </div>
            </td>
            <td className="text-left font-mono-nums font-bold">{renderAmount(n.amount ?? n.balance ?? 0)}</td>
            {editable && (
              <td>
                <div className="flex gap-1 justify-end opacity-70 hover:opacity-100">
                  {n.is_group && (
                    <button onClick={() => openAddAccount(n)} className="btn-icon text-green-600 hover:bg-green-50" title="إضافة حساب فرعي"><Plus className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => openEditAccount(n)} className="btn-icon text-blue-600 hover:bg-blue-50" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteTarget(n)} className="btn-icon text-red-600 hover:bg-red-50" title="حذف"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            )}
          </tr>
          {hasChildren && !isCollapsed && renderNodes(n.children, depth + 1, editable)}
        </React.Fragment>
      );
    });

  const sectionTotal = (label: string, value: number, strong = false) => (
    <tr className={strong ? 'bg-coffee-50 font-extrabold text-coffee-800' : 'bg-stone-100 font-bold'}>
      <td>{label}</td>
      <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(value)}</td>
    </tr>
  );

  return (
    <div>
      <TopBar
        title="الحسابات والتقارير المالية"
        subtitle="شجرة الحسابات ودفتر الأستاذ والتقارير المحاسبية (نمط ERPNext)"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setJeOpen(true)} className="btn-secondary text-sm"><BookText className="w-4 h-4" /> قيد يومية</button>
            <button onClick={handleRebuild} disabled={rebuilding} className="btn-primary text-sm">
              <RefreshCw className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`} /> {rebuilding ? 'جاري الترحيل...' : 'ترحيل القيود'}
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${tab === t.key ? 'bg-coffee-600 text-white shadow-md' : 'bg-white text-stone-600 hover:bg-coffee-50 border border-stone-100'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {(tab === 'trial' || tab === 'pl' || tab === 'gl') && (
          <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
            {tab === 'gl' && (
              <select value={glAccountId} onChange={e => setGlAccountId(e.target.value)} className="input w-64 text-sm">
                {ledgerAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name_ar || a.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-2 text-sm">
              <label className="text-stone-500">من</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input py-2 text-sm w-40" />
              <label className="text-stone-500">إلى</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input py-2 text-sm w-40" />
              {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="text-xs text-coffee-600 hover:underline">مسح</button>}
            </div>
          </div>
        )}
        {tab === 'bs' && (
          <div className="card p-4 mb-5 flex items-center gap-3 text-sm">
            <label className="text-stone-500">كما في تاريخ</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="input py-2 text-sm w-44" />
          </div>
        )}

        {loading ? (
          <div className="card p-12 flex justify-center"><div className="w-8 h-8 border-4 border-coffee-200 border-t-coffee-600 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* TREE */}
            {tab === 'tree' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>الحساب</th><th className="text-left">الرصيد</th><th className="text-left w-32">إجراءات</th></tr></thead>
                  <tbody>{renderNodes(tree, 0, true)}</tbody>
                </table>
              </div>
            )}

            {/* TRIAL BALANCE */}
            {tab === 'trial' && trial && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>الرمز</th><th>الحساب</th><th className="text-left">رصيد افتتاحي</th><th className="text-left">مدين</th><th className="text-left">دائن</th><th className="text-left">الرصيد الختامي</th></tr></thead>
                  <tbody>
                    {trial.rows.map((r: any) => (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="font-mono text-xs text-stone-400">{r.code}</td>
                        <td className="font-semibold">{r.name_ar || r.name} <span className="text-[10px] text-stone-400">({ROOT_LABELS[r.root_type]})</span></td>
                        <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(r.opening)}</td>
                        <td className="text-left font-mono-nums text-green-700" dir="ltr">{r.debit ? formatCurrency(r.debit) : '—'}</td>
                        <td className="text-left font-mono-nums text-red-700" dir="ltr">{r.credit ? formatCurrency(r.credit) : '—'}</td>
                        <td className="text-left font-mono-nums font-bold" dir="ltr">{formatCurrency(r.closing)}</td>
                      </tr>
                    ))}
                    <tr className="bg-coffee-50 font-extrabold text-coffee-800">
                      <td colSpan={3}>الإجمالي</td>
                      <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(trial.total_debit)}</td>
                      <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(trial.total_credit)}</td>
                      <td className="text-left">{Math.abs(trial.total_debit - trial.total_credit) < 0.5
                        ? <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-4 h-4" /> متوازن</span>
                        : <span className="inline-flex items-center gap-1 text-red-600 text-xs"><AlertTriangle className="w-4 h-4" /> غير متوازن</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* PROFIT & LOSS */}
            {tab === 'pl' && pl && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>البند</th><th className="text-left">المبلغ</th></tr></thead>
                  <tbody>
                    <tr className="bg-green-50 font-bold text-green-800"><td colSpan={2}>الإيرادات</td></tr>
                    {renderNodes(pl.income)}
                    {sectionTotal('إجمالي الإيرادات', pl.total_income)}
                    <tr className="bg-red-50 font-bold text-red-800"><td colSpan={2}>المصروفات</td></tr>
                    {renderNodes(pl.expense)}
                    {sectionTotal('إجمالي المصروفات', pl.total_expense)}
                    {sectionTotal(pl.net_profit >= 0 ? 'صافي الربح' : 'صافي الخسارة', pl.net_profit, true)}
                  </tbody>
                </table>
              </div>
            )}

            {/* BALANCE SHEET */}
            {tab === 'bs' && bs && (
              <div className="space-y-5">
                <div className={`card p-4 flex items-center gap-3 ${bs.balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  {bs.balanced ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                  <span className={`font-bold ${bs.balanced ? 'text-green-700' : 'text-red-700'}`}>
                    {bs.balanced ? 'الميزانية متوازنة' : 'الميزانية غير متوازنة'} — الأصول {formatCurrency(bs.total_assets)} = الخصوم + حقوق الملكية {formatCurrency(bs.total_liabilities_equity)}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead><tr><th>الأصول</th><th className="text-left">المبلغ</th></tr></thead>
                      <tbody>{renderNodes(bs.assets)}{sectionTotal('إجمالي الأصول', bs.total_assets, true)}</tbody>
                    </table>
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead><tr><th>الخصوم وحقوق الملكية</th><th className="text-left">المبلغ</th></tr></thead>
                      <tbody>
                        <tr className="bg-stone-50 font-bold"><td colSpan={2}>الخصوم</td></tr>
                        {renderNodes(bs.liabilities)}
                        {sectionTotal('إجمالي الخصوم', bs.total_liabilities)}
                        <tr className="bg-stone-50 font-bold"><td colSpan={2}>حقوق الملكية</td></tr>
                        {renderNodes(bs.equity)}
                        <tr><td className="pr-6 text-stone-600">أرباح الفترة الحالية</td><td className="text-left font-mono-nums" dir="ltr">{formatCurrency(bs.current_earnings)}</td></tr>
                        {sectionTotal('إجمالي حقوق الملكية', bs.total_equity)}
                        {sectionTotal('إجمالي الخصوم وحقوق الملكية', bs.total_liabilities_equity, true)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GENERAL LEDGER */}
            {tab === 'gl' && gl && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>التاريخ</th><th>المستند</th><th>الطرف</th><th>البيان</th><th className="text-left">مدين</th><th className="text-left">دائن</th><th className="text-left">الرصيد</th></tr></thead>
                  <tbody>
                    <tr className="bg-stone-50 font-bold"><td colSpan={6}>رصيد افتتاحي</td><td className="text-left font-mono-nums" dir="ltr">{formatCurrency(gl.opening)}</td></tr>
                    {gl.rows.map((e: any, i: number) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="text-xs" dir="ltr">{e.posting_date}</td>
                        <td className="text-xs"><span className="badge badge-gray">{e.voucher_type}</span> {e.voucher_no}</td>
                        <td className="text-xs text-stone-500">{e.party || '—'}</td>
                        <td className="text-xs text-stone-500">{e.remarks || e.against || '—'}</td>
                        <td className="text-left font-mono-nums text-green-700" dir="ltr">{e.debit ? formatCurrency(e.debit) : '—'}</td>
                        <td className="text-left font-mono-nums text-red-700" dir="ltr">{e.credit ? formatCurrency(e.credit) : '—'}</td>
                        <td className="text-left font-mono-nums font-bold" dir="ltr">{formatCurrency(e.balance)}</td>
                      </tr>
                    ))}
                    <tr className="bg-coffee-50 font-extrabold text-coffee-800">
                      <td colSpan={4}>الإجمالي / الرصيد الختامي</td>
                      <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(gl.total_debit)}</td>
                      <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(gl.total_credit)}</td>
                      <td className="text-left font-mono-nums" dir="ltr">{formatCurrency(gl.closing)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Account add/edit modal */}
      <Modal isOpen={!!acctModal} onClose={() => !savingAcct && setAcctModal(null)}
        title={acctModal?.mode === 'add' ? `إضافة حساب تحت: ${acctModal?.parent?.name_ar || ''}` : 'تعديل الحساب'}
        footer={<>
          <button onClick={() => setAcctModal(null)} disabled={savingAcct} className="btn-secondary">إلغاء</button>
          <button onClick={saveAccount} disabled={savingAcct} className="btn-primary">{savingAcct ? 'جاري الحفظ...' : 'حفظ'}</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label">اسم الحساب (عربي) *</label>
            <input className="input" value={acctForm.name_ar} onChange={e => setAcctForm({ ...acctForm, name_ar: e.target.value })} placeholder="مثال: مصروفات تسويق" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">الاسم (إنجليزي)</label>
              <input className="input" value={acctForm.name} onChange={e => setAcctForm({ ...acctForm, name: e.target.value })} /></div>
            <div><label className="label">رمز الحساب</label>
              <input className="input font-mono" value={acctForm.code} onChange={e => setAcctForm({ ...acctForm, code: e.target.value })} placeholder="5270" /></div>
          </div>
          {acctModal?.mode === 'add' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={acctForm.is_group} onChange={e => setAcctForm({ ...acctForm, is_group: e.target.checked })} className="w-4 h-4 rounded" />
              حساب تجميعي (مجموعة تحتوي حسابات فرعية)
            </label>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={doDeleteAccount}
        title="حذف الحساب" message={`هل تريد حذف الحساب «${deleteTarget?.name_ar || ''}»؟ لا يمكن حذف حساب له حركات أو حسابات فرعية.`}
        isDestructive confirmText="حذف" />

      {/* Journal Entry modal */}
      <Modal isOpen={jeOpen} onClose={() => !savingJe && setJeOpen(false)} title="قيد يومية جديد" size="2xl"
        footer={<>
          <div className="flex-1 text-sm font-bold" dir="ltr">
            <span className="text-green-700">مدين {formatCurrency(jeTotals.debit)}</span> · <span className="text-red-700">دائن {formatCurrency(jeTotals.credit)}</span>
            {jeBalanced ? <span className="text-green-600 mr-2">✓ متوازن</span> : <span className="text-stone-400 mr-2">غير متوازن</span>}
          </div>
          <button onClick={() => setJeOpen(false)} disabled={savingJe} className="btn-secondary">إلغاء</button>
          <button onClick={submitJournal} disabled={savingJe || !jeBalanced} className="btn-primary">{savingJe ? 'جاري الحفظ...' : 'تسجيل القيد'}</button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">تاريخ القيد</label><input type="date" className="input" value={jeDate} onChange={e => setJeDate(e.target.value)} /></div>
            <div><label className="label">البيان</label><input className="input" value={jeRemarks} onChange={e => setJeRemarks(e.target.value)} placeholder="وصف القيد" /></div>
          </div>
          <div className="space-y-2">
            {jeLines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input flex-1 text-sm" value={l.account_id} onChange={e => { const n = [...jeLines]; n[i].account_id = e.target.value; setJeLines(n); }}>
                  <option value="">— اختر حساباً —</option>
                  {ledgerAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name_ar || a.name}</option>)}
                </select>
                <input type="number" placeholder="مدين" className="input w-28 text-sm font-mono-nums" value={l.debit}
                  onChange={e => { const n = [...jeLines]; n[i].debit = e.target.value; if (e.target.value) n[i].credit = ''; setJeLines(n); }} />
                <input type="number" placeholder="دائن" className="input w-28 text-sm font-mono-nums" value={l.credit}
                  onChange={e => { const n = [...jeLines]; n[i].credit = e.target.value; if (e.target.value) n[i].debit = ''; setJeLines(n); }} />
                <button onClick={() => setJeLines(jeLines.filter((_, idx) => idx !== i))} disabled={jeLines.length <= 2} className="btn-icon text-red-500 disabled:opacity-30"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <button onClick={() => setJeLines([...jeLines, { account_id: '', debit: '', credit: '' }])} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> إضافة سطر</button>
        </div>
      </Modal>
    </div>
  );
};

export default ChartOfAccountsPage;
