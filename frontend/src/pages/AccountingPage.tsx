import React, { useState, useEffect } from 'react';
import {
  Banknote, CreditCard, Users, TrendingDown, TrendingUp,
  RefreshCw, ArrowUpRight, ArrowDownLeft, AlertCircle, Package, Receipt, Search
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const AccountingPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseFilter, setExpenseFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const res = await api.get('/accounts/summary', { params });
      setData(res.data.data);
    } catch (err) {
      toast.error('خطأ في تحميل شجرة الحسابات');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title="شجرة الحسابات" subtitle="لوحة تتبع الأرصدة المالية" />
        <div className="page-container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-1/2 mb-4" />
                <div className="h-8 bg-stone-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cashBalance = data?.cash_balance || 0;
  const cardBalance = data?.card_balance || 0;
  const customerDebts = data?.customer_debts || 0;
  const supplierDebt = data?.supplier_debt || 0;
  const totalAssets = cashBalance + cardBalance;

  return (
    <div>
      <TopBar
        title="شجرة الحسابات"
        subtitle="تتبع الأرصدة والديون بشكل مباشر"
        actions={
          <button onClick={fetchData} className="btn-secondary text-sm gap-2">
            <RefreshCw className="w-4 h-4" /> تحديث
          </button>
        }
      />

      <div className="page-container space-y-6">

        {/* === DATE FILTER === */}
        <div className="card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="label text-xs">من تاريخ</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input text-sm" />
          </div>
          <div>
            <label className="label text-xs">إلى تاريخ</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input text-sm" />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="btn-secondary text-sm py-2 text-red-600 hover:bg-red-50"
            >تصفير الفلتر</button>
          )}
          {(fromDate || toDate) && (
            <div className="mr-auto text-xs text-stone-500 font-medium bg-coffee-50 border border-coffee-200 px-3 py-2 rounded-xl">
              عرض بيانات الفترة: <strong>{fromDate || 'البداية'}</strong> → <strong>{toDate || 'اليوم'}</strong>
            </div>
          )}
        </div>

        {/* === PERIOD SUMMARY CARDS === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5 border-t-4 border-coffee-600">
            <p className="text-[11px] text-stone-500 font-medium mb-1">إيرادات الفترة</p>
            <p className="text-2xl font-black text-coffee-800 font-mono-nums">{formatCurrency(data?.total_sales_period || 0)}</p>
            <p className="text-[10px] text-stone-400 mt-1">{data?.total_orders_period || 0} فاتورة بيع</p>
          </div>
          <div className="card p-5 border-t-4 border-red-500">
            <p className="text-[11px] text-stone-500 font-medium mb-1">إجمالي المصاريف</p>
            <p className="text-2xl font-black text-red-700 font-mono-nums">- {formatCurrency(data?.total_expenses_period || 0)}</p>
            <p className="text-[10px] text-stone-400 mt-1">{data?.total_expenses_count || 0} عملية صرف</p>
          </div>
          <div className="card p-5 border-t-4 border-orange-500">
            <p className="text-[11px] text-stone-500 font-medium mb-1">إجمالي المشتريات</p>
            <p className="text-2xl font-black text-orange-700 font-mono-nums">- {formatCurrency(data?.total_purchases_period || 0)}</p>
            <p className="text-[10px] text-stone-400 mt-1">{data?.total_purchases_count || 0} فاتورة شراء</p>
          </div>
          <div className={`card p-5 border-t-4 ${(data?.net_profit_period || 0) >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <p className="text-[11px] text-stone-500 font-medium mb-1">صافي الفترة التقديري</p>
            <p className={`text-2xl font-black font-mono-nums ${(data?.net_profit_period || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(data?.net_profit_period || 0)}
            </p>
            <p className="text-[10px] text-stone-400 mt-1">مبيعات - مصاريف - مشتريات</p>
          </div>
        </div>

        {/* === TODAY SUMMARY === */}
        <div className="card p-4 bg-gradient-to-l from-coffee-50 to-stone-50 border border-coffee-100">
          <h2 className="font-bold text-stone-700 text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            حركة اليوم
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-stone-500 font-medium">إجمالي المبيعات</p>
              <p className="text-lg font-black text-coffee-800">{formatCurrency(data?.today?.total_today || 0)}</p>
              <p className="text-[9px] text-stone-400">{data?.today?.orders_today || 0} عملية بيع</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-stone-500 font-medium">مقبوض كاش</p>
              <p className="text-lg font-black text-green-700">{formatCurrency(data?.today?.cash_today || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-stone-500 font-medium">مقبوض بطاقة</p>
              <p className="text-lg font-black text-blue-700">{formatCurrency(data?.today?.card_today || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-stone-500 font-medium">مباع بالدين</p>
              <p className="text-lg font-black text-orange-600">{formatCurrency(data?.today?.debt_today || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-stone-500 font-medium">إجمالي النقد + الرصيد</p>
              <p className="text-lg font-black text-stone-800">{formatCurrency(totalAssets)}</p>
            </div>
          </div>
        </div>

        {/* === 4 MAIN ACCOUNTS === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* CASH */}
          <div className="card overflow-hidden">
            <div className="p-5 pb-3 bg-gradient-to-br from-green-50 to-emerald-50 border-b border-green-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">حساب الخزينة</p>
                    <p className="text-[10px] text-stone-400">نقدي</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cashBalance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {cashBalance >= 0 ? 'دائن' : 'منقوص'}
                </span>
              </div>
            </div>
            <div className="p-5">
              <div className={`text-2xl font-black font-mono-nums mb-3 ${cashBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(cashBalance))}
              </div>
              <div className="space-y-1.5 text-xs text-stone-500">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3 text-green-500" /> وارد من المبيعات</span>
                  <span className="font-bold text-green-700">{formatCurrency(data?.cash_from_sales || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-red-500" /> مصروفات نثرية</span>
                  <span className="font-bold text-red-600">- {formatCurrency(data?.cash_paid_expenses || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-red-500" /> مشتريات</span>
                  <span className="font-bold text-red-600">- {formatCurrency(data?.cash_paid_purchases || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD / BANK */}
          <div className="card overflow-hidden">
            <div className="p-5 pb-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">حساب البطاقة / البنك</p>
                    <p className="text-[10px] text-stone-400">إلكتروني</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cardBalance >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                  {cardBalance >= 0 ? 'دائن' : 'منقوص'}
                </span>
              </div>
            </div>
            <div className="p-5">
              <div className={`text-2xl font-black font-mono-nums mb-3 ${cardBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(cardBalance))}
              </div>
              <div className="space-y-1.5 text-xs text-stone-500">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3 text-green-500" /> وارد من المبيعات</span>
                  <span className="font-bold text-green-700">{formatCurrency(data?.card_from_sales || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-red-500" /> مصروفات ببطاقة</span>
                  <span className="font-bold text-red-600">- {formatCurrency(data?.card_paid_expenses || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CUSTOMER DEBTS */}
          <div className="card overflow-hidden">
            <div className="p-5 pb-3 bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-orange-700" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">ذمم العملاء</p>
                    <p className="text-[10px] text-stone-400">ما يدينون به للكافيتيريا</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {data?.debtor_count || 0} مدين
                </span>
              </div>
            </div>
            <div className="p-5">
              <div className="text-2xl font-black font-mono-nums text-orange-700 mb-3">
                {formatCurrency(customerDebts)}
              </div>
              <div className="space-y-1.5 text-xs text-stone-500">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-orange-500" /> إجمالي الديون</span>
                  <span className="font-bold text-orange-700">{formatCurrency(customerDebts)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-500" /> أرصدة دائنة</span>
                  <span className="font-bold text-green-700">{formatCurrency(data?.customer_credits || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-stone-400">عملاء دائنون</span>
                  <span className="font-bold">{data?.creditor_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SUPPLIER DEBTS */}
          <div className="card overflow-hidden">
            <div className="p-5 pb-3 bg-gradient-to-br from-red-50 to-rose-50 border-b border-red-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-red-700" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium">ذمم الموردين</p>
                    <p className="text-[10px] text-stone-400">ما تدينه الكافيتيريا</p>
                  </div>
                </div>
                {supplierDebt > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <AlertCircle className="w-3 h-3 inline" /> مستحق
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <div className={`text-2xl font-black font-mono-nums mb-3 ${supplierDebt > 0 ? 'text-red-700' : 'text-green-600'}`}>
                {formatCurrency(supplierDebt)}
              </div>
              <div className="space-y-1.5 text-xs text-stone-500">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-400" /> مشتريات غير مسددة</span>
                  <span className="font-bold text-red-600">{formatCurrency(supplierDebt)}</span>
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  {supplierDebt === 0 ? '✅ لا توجد ذمم مستحقة للموردين' : 'يرجى تسديد المستحقات'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* === NET POSITION === */}
        <div className="card p-5 bg-gradient-to-l from-coffee-900 to-espresso-900 text-white">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-coffee-300 text-sm font-medium mb-1">المركز المالي الصافي</p>
              <p className="text-[11px] text-coffee-400">إجمالي النقد والبطاقة + ذمم العملاء - ذمم الموردين</p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-black font-mono-nums ${(totalAssets + customerDebts - supplierDebt) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalAssets + customerDebts - supplierDebt)}
              </div>
              <div className="flex gap-4 text-xs text-coffee-400 mt-1">
                <span>نقد: <strong className="text-white">{formatCurrency(cashBalance)}</strong></span>
                <span>بطاقة: <strong className="text-white">{formatCurrency(cardBalance)}</strong></span>
                <span>ذمم: <strong className="text-orange-300">{formatCurrency(customerDebts)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* === BOTTOM SECTION: Top Debtors + Recent Sales === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* TOP DEBTORS */}
          <div className="card">
            <div className="p-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600" /> أكبر المدينين
              </h3>
            </div>
            <div className="divide-y divide-stone-50">
              {(data?.top_debtors || []).length === 0 ? (
                <div className="p-6 text-center text-stone-400 text-sm">لا يوجد عملاء مدينون حالياً ✅</div>
              ) : (
                (data?.top_debtors || []).map((c: any, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                    <div>
                      <p className="font-bold text-stone-800 text-sm">{c.name}</p>
                      <p className="text-xs text-stone-400">{c.phone || 'بدون هاتف'}</p>
                    </div>
                    <span className="text-sm font-black text-red-600 font-mono-nums">
                      {formatCurrency(Math.abs(c.balance))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RECENT SALES MOVEMENTS */}
          <div className="card">
            <div className="p-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-green-600" /> آخر الحركات المالية
              </h3>
            </div>
            <div className="divide-y divide-stone-50 max-h-[340px] overflow-y-auto">
              {(data?.recent_sales || []).map((s: any, i: number) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-stone-50 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-stone-700">{s.invoice_number}</p>
                    <p className="text-[10px] text-stone-400">{formatDate(s.created_at)} · {s.cashier_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-coffee-700">{formatCurrency(s.total)}</p>
                    <div className="flex gap-1 justify-end">
                      {s.cash_amount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">
                          كاش: {formatCurrency(s.cash_amount)}
                        </span>
                      )}
                      {s.card_amount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                          بطاقة: {formatCurrency(s.card_amount)}
                        </span>
                      )}
                      {s.debt_amount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">
                          دين: {formatCurrency(s.debt_amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* === EXPENSES SECTION === */}
        <div className="space-y-4">
          <h2 className="font-black text-stone-800 text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-600" />
            المصاريف بالتفصيل
          </h2>

          {/* Expenses by Category Summary */}
          {(data?.expenses_by_category || []).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(data.expenses_by_category).map((cat: any, i: number) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <p className="text-xs font-bold text-stone-700 truncate">{cat.category_name}</p>
                  </div>
                  <p className="text-xl font-black text-red-700 font-mono-nums">{formatCurrency(cat.total)}</p>
                  <p className="text-[10px] text-stone-400 mt-1">{cat.count} عملية</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter + Search bar */}
          <div className="card p-3 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ابحث في المصاريف..."
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
                className="input pr-9 text-sm py-2"
              />
            </div>
            <select
              value={expenseFilter}
              onChange={e => setExpenseFilter(e.target.value)}
              className="input w-auto text-sm py-2"
            >
              <option value="all">جميع التصنيفات</option>
              {(data?.expenses_by_category || []).map((cat: any, i: number) => (
                <option key={i} value={cat.category_name}>{cat.category_name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              {(data?.expenses_by_method || []).map((m: any, i: number) => (
                <span key={i} className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  m.payment_method === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {m.payment_method === 'cash' ? 'كاش' : 'بطاقة'}: {formatCurrency(m.total)}
                </span>
              ))}
            </div>
          </div>

          {/* Full Expenses Ledger */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-right">
                <thead className="sticky top-0 bg-stone-50 border-b border-stone-100">
                  <tr className="text-stone-500 text-xs">
                    <th className="p-3 font-bold">التاريخ</th>
                    <th className="p-3 font-bold">الوصف</th>
                    <th className="p-3 font-bold">التصنيف</th>
                    <th className="p-3 font-bold">طريقة الدفع</th>
                    <th className="p-3 font-bold text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {(data?.recent_expenses || [])
                    .filter((e: any) => {
                      const matchSearch = !expenseSearch || e.description?.includes(expenseSearch) || (e.category_name || '').includes(expenseSearch);
                      const matchFilter = expenseFilter === 'all' || (e.category_name || 'غير مصنف') === expenseFilter;
                      return matchSearch && matchFilter;
                    })
                    .map((e: any, i: number) => (
                      <tr key={i} className="hover:bg-stone-50 transition-colors">
                        <td className="p-3 text-xs text-stone-500 font-mono">{e.expense_date}</td>
                        <td className="p-3">
                          <p className="text-sm font-bold text-stone-800">{e.description}</p>
                          {e.notes && <p className="text-[10px] text-stone-400">{e.notes}</p>}
                        </td>
                        <td className="p-3">
                          {e.category_name ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{e.category_name}</span>
                          ) : (
                            <span className="text-[10px] text-stone-300">غير مصنف</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            (e.payment_method || 'cash') === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {(e.payment_method || 'cash') === 'cash' ? 'كاش' : 'بطاقة'}
                          </span>
                        </td>
                        <td className="p-3 text-left">
                          <span className="font-black text-red-600 font-mono-nums text-sm">- {formatCurrency(e.amount)}</span>
                        </td>
                      </tr>
                    ))}
                  {(data?.recent_expenses || []).length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-stone-400 text-sm">لا توجد مصاريف مسجلة حتى الآن</td></tr>
                  )}
                </tbody>
                {(data?.recent_expenses || []).length > 0 && (
                  <tfoot className="sticky bottom-0 bg-red-50 border-t-2 border-red-100">
                    <tr>
                      <td colSpan={4} className="p-3 font-black text-red-700 text-sm">إجمالي المصاريف</td>
                      <td className="p-3 text-left font-black text-red-700 font-mono-nums text-base">
                        - {formatCurrency(data?.total_expenses || 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AccountingPage;
