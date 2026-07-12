import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, ShoppingCart, DollarSign, TrendingDown, AlertTriangle,
  Package, Users, Award, Calendar, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import api from '../services/api';
import { formatCurrency, formatNumber, formatDate, getDateRange, getTodayDate } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import { SkeletonStats, SkeletonTable } from '../components/ui/Skeleton';
import TopBar from '../components/layout/TopBar';
import toast from 'react-hot-toast';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month';

const COLORS = ['#c4701f', '#d4872a', '#e2a44e', '#1D4ED8', '#16A34A', '#9333EA'];

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'اليوم' },
    { key: 'yesterday', label: 'أمس' },
    { key: 'week', label: 'هذا الأسبوع' },
    { key: 'month', label: 'هذا الشهر' },
  ];

  const fetchData = async (start?: string, end?: string) => {
    try {
      setLoading(true);
      const range = start ? { from: start, to: end } : getDateRange(preset);
      const res = await api.get('/dashboard', { params: { from_date: range.from, to_date: range.to } });
      setData(res.data.data);
    } catch (err) {
      toast.error('خطأ في جلب بيانات لوحة القيادة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [preset]);

  const handlePreset = (p: DatePreset) => {
    setPreset(p);
    setCustomStart('');
    setCustomEnd('');
  };

  const handleCustomSearch = () => {
    if (!customStart || !customEnd) return;
    fetchData(customStart, customEnd);
  };

  if (loading) {
    return (
      <div>
        <TopBar title="لوحة القيادة" subtitle="نظرة عامة على الأعمال" />
        <div className="page-container">
          <SkeletonStats count={4} />
          <SkeletonTable rows={5} cols={4} />
        </div>
      </div>
    );
  }

  const { summary, employeePerformance, topProducts, salesByCategory, salesByPayment, dailySales, recentSales, stockAlerts, expensesByCategory } = data || {};

  // Chart data
  const dailyChartData = (dailySales || []).map((d: any) => ({
    date: formatDate(d.date, 'short'),
    مبيعات: parseFloat(d.sales || 0),
    طلبات: parseInt(d.orders || 0),
  }));

  const categoryChartData = (salesByCategory || []).map((c: any) => ({
    name: c.name || 'أخرى',
    value: parseFloat(c.total_revenue || 0),
    color: c.color || '#c4701f',
  }));

  return (
    <div>
      <TopBar
        title="لوحة القيادة"
        subtitle="نظرة عامة على أداء الكافيتيريا"
        actions={
          <button onClick={() => fetchData()} className="btn-ghost text-sm">
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        }
      />

      <div className="page-container">
        {/* Proactive Stock Alert Banner - Critical Level 5 */}
        {(stockAlerts || []).some((item: any) => item.current_stock <= 5) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-red-600 to-red-500 rounded-3xl p-6 text-white flex flex-wrap items-center gap-6 shadow-2xl shadow-red-200/50 mb-4 border border-red-400"
          >
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm animate-pulse">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1 min-w-[250px]">
              <h4 className="text-2xl font-black mb-1">تنبيه: نفاذ مخزون حرج!</h4>
              <p className="text-red-50 opacity-90 text-sm leading-relaxed">
                يوجد <b>{(stockAlerts || []).filter((i:any)=>i.current_stock <= 5).length} منتجات</b> وصلت لـ 5 قطع اقل. 
                <br />يرجى طلب التوريد فوراً لضمان عدم توقف العمل.
              </p>
            </div>
            <a 
              href="/inventory"
              className="bg-white text-red-600 px-8 py-4 rounded-2xl font-black hover:bg-stone-50 transition-all shadow-xl hover:scale-105 active:scale-95"
            >
              عرض النواقص الآن
            </a>
          </motion.div>
        )}

        {/* Date Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-stone-400" />
            <div className="flex gap-2 flex-wrap">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    preset === p.key && !customStart
                      ? 'bg-coffee-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-coffee-50 hover:text-coffee-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mr-auto">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="input text-sm py-1.5 w-36" />
              <span className="text-stone-400">—</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="input text-sm py-1.5 w-36" />
              <button onClick={handleCustomSearch} className="btn-primary text-sm py-1.5">
                بحث
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي المبيعات"
            value={formatCurrency(summary?.total_sales || 0)}
            subtitle={`${formatNumber(summary?.total_orders || 0)} طلب`}
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="التكلفة (COGS)"
            value={formatCurrency(summary?.total_cogs || 0)}
            subtitle="تكلفة البضاعة المباعة"
            icon={ShoppingCart}
            variant="info"
          />
          <StatCard
            title="المصاريف"
            value={formatCurrency(summary?.total_expenses || 0)}
            subtitle="مصاريف الفترة"
            icon={TrendingDown}
            variant="warning"
          />
          <StatCard
            title="الربح التقديري"
            value={formatCurrency(summary?.estimated_profit || 0)}
            subtitle="المبيعات - COGS - المصاريف"
            icon={DollarSign}
            variant={summary?.estimated_profit >= 0 ? 'success' : 'danger'}
          />
        </div>

        {/* Stock Alerts */}
        {(stockAlerts || []).length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-stone-800">تنبيهات المخزون</h3>
              <span className="badge badge-yellow mr-auto">{stockAlerts.length} منتج</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {stockAlerts.map((item: any) => (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  item.current_stock <= 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <Package className={`w-4 h-4 ${item.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
                    <p className={`text-xs ${item.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {item.current_stock <= 0 ? 'نفد المخزون' : `متبقي: ${formatNumber(item.current_stock)} ${item.unit}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily Sales Chart */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-stone-800 mb-4">المبيعات اليومية</h3>
            {dailyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), 'المبيعات']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e7e5e4', fontFamily: 'Cairo' }}
                  />
                  <Bar dataKey="مبيعات" fill="#c4701f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-stone-400 text-sm">
                لا توجد بيانات مبيعات للفترة المحددة
              </div>
            )}
          </div>

          {/* Sales by category */}
          <div className="card p-5">
            <h3 className="font-semibold text-stone-800 mb-4">المبيعات حسب التصنيف</h3>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryChartData} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name">
                    {categoryChartData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), 'المبيعات']}
                    contentStyle={{ borderRadius: '12px', fontFamily: 'Cairo' }}
                  />
                  <Legend formatter={(value) => <span style={{ fontFamily: 'Cairo', fontSize: '12px' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-stone-400 text-sm">
                لا توجد بيانات
              </div>
            )}
          </div>
        </div>

        {/* Employee Performance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-coffee-600" />
            <h3 className="font-semibold text-stone-800">أداء الكاشيرين</h3>
          </div>
          {(employeePerformance || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {employeePerformance.map((emp: any, index: number) => (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl bg-stone-50 border border-stone-100 flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-coffee-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-coffee-700 font-bold">{emp.full_name?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 text-sm truncate">{emp.full_name}</p>
                    <p className="text-xs text-stone-500">{formatNumber(emp.total_orders)} طلب</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-coffee-700 text-sm">{formatCurrency(emp.total_sales)}</p>
                    {index === 0 && emp.total_orders > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <Award className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs text-yellow-600">الأفضل</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm text-center py-4">لا توجد مبيعات للفترة المحددة</p>
          )}
        </div>

        {/* Bottom row: Top Products + Recent Sales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products */}
          <div className="card p-5">
            <h3 className="font-semibold text-stone-800 mb-4">أكثر المنتجات مبيعاً</h3>
            <div className="space-y-2">
              {(topProducts || []).length > 0 ? topProducts.slice(0, 8).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-coffee-100 rounded-lg flex items-center justify-center text-xs font-bold text-coffee-700 flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-stone-700 truncate">{p.name}</span>
                  <span className="text-sm font-semibold text-coffee-700">{formatCurrency(p.total_revenue)}</span>
                </div>
              )) : (
                <p className="text-stone-400 text-sm text-center py-4">لا توجد منتجات</p>
              )}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="card p-5">
            <h3 className="font-semibold text-stone-800 mb-4">آخر المبيعات</h3>
            <div className="space-y-2">
              {(recentSales || []).length > 0 ? recentSales.map((sale: any) => (
                <div key={sale.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                  <div className="w-8 h-8 bg-coffee-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-4 h-4 text-coffee-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800">{sale.invoice_number}</p>
                    <p className="text-xs text-stone-400">{sale.cashier_name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-stone-800">{formatCurrency(sale.total)}</p>
                    <p className="text-xs text-stone-400">{formatDate(sale.created_at, 'time')}</p>
                  </div>
                </div>
              )) : (
                <p className="text-stone-400 text-sm text-center py-4">لا توجد مبيعات</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
