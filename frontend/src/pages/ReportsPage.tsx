import React, { useState, useEffect } from 'react';
import { Download, FileText, Filter, Printer, Calendar } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatNumber, formatDate, getDateRange } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../components/ui/Skeleton';

const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'sales' | 'profit' | 'inventory'>('sales');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Date Filters
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      const range = preset === 'custom' ? { from: startDate, to: endDate } : getDateRange(preset as any);
      
      const res = await api.get(`/reports/${activeReport}`, {
        params: { start_date: range.from, end_date: range.to }
      });
      
      if (activeReport === 'sales') {
        setData(res.data.data.sales);
        setSummary({
          total_revenue: res.data.data.summary.total_revenue,
          total_orders: res.data.data.summary.total_orders
        });
      } else if (activeReport === 'profit') {
        setData(res.data.data.details);
        setSummary(res.data.data.summary);
      } else {
        setData(res.data.data.inventory);
        setSummary(res.data.data.summary);
      }
    } catch (err) {
      toast.error('حدث مطأ في تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport, preset, preset !== 'custom' ? null : startDate, preset !== 'custom' ? null : endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <TopBar
        title="تقارير النظام"
        subtitle="تحليل المبيعات، الأرباح، والمخزون"
        actions={
          <div className="flex bg-stone-100 rounded-xl p-1 shadow-sm">
            <button onClick={() => setActiveReport('sales')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeReport === 'sales' ? 'bg-white text-coffee-700' : 'text-stone-500'}`}>المبيعات</button>
            <button onClick={() => setActiveReport('profit')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeReport === 'profit' ? 'bg-white text-coffee-700' : 'text-stone-500'}`}>الأرباح</button>
            <button onClick={() => setActiveReport('inventory')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeReport === 'inventory' ? 'bg-white text-coffee-700' : 'text-stone-500'}`}>الجرد</button>
          </div>
        }
      />

      <div className="page-container">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-4 items-center justify-between no-print">
          <div className="flex gap-2 w-full md:w-auto items-center">
            <Calendar className="w-4 h-4 text-stone-400" />
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="input text-sm py-2">
              <option value="today">اليوم</option>
              <option value="yesterday">الأمس</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="custom">تخصيص...</option>
            </select>

            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input text-sm py-2" />
                <span className="text-stone-400">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input text-sm py-2" />
                <button onClick={fetchReport} className="btn-secondary text-sm py-2">عرض</button>
              </div>
            )}
          </div>

          <button onClick={handlePrint} className="btn-primary text-sm py-2 hidden md:flex">
            <Printer className="w-4 h-4" />
            طباعة التقرير
          </button>
        </div>

        {/* Report Content */}
        {loading ? (
          <SkeletonTable cols={6} />
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 printable-area">
            {/* Report Header */}
            <div className="text-center mb-6 pb-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-900 mb-1">
                تقرير {activeReport === 'sales' ? 'المبيعات' : activeReport === 'profit' ? 'الأرباح' : 'جرد المخزون'}
              </h2>
              <p className="text-stone-500 text-sm">
                {preset === 'custom' 
                  ? `للفترة من ${formatDate(startDate, 'short')} إلى ${formatDate(endDate, 'short')}`
                  : `الفترة الزمنية: ${preset}`}
              </p>
            </div>

            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {activeReport === 'sales' && (
                  <>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="text-xs text-stone-500 font-medium">إجمالي الإيرادات</p>
                      <p className="text-xl font-bold text-coffee-700 mt-1">{formatCurrency(summary.total_revenue)}</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="text-xs text-stone-500 font-medium">عدد الطلبات</p>
                      <p className="text-xl font-bold text-stone-900 mt-1">{formatNumber(summary.total_orders)}</p>
                    </div>
                  </>
                )}
                
                {activeReport === 'profit' && (
                  <>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="text-xs text-stone-500 font-medium">إجمالي المبيعات</p>
                      <p className="text-xl font-bold text-stone-900 mt-1">{formatCurrency(summary.total_revenue)}</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="text-xs text-stone-500 font-medium">تكلفة البضاعة (COGS)</p>
                      <p className="text-xl font-bold text-red-600 mt-1">- {formatCurrency(summary.total_cogs)}</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="text-xs text-stone-500 font-medium">المصروفات التشغيلية</p>
                      <p className="text-xl font-bold text-red-600 mt-1">- {formatCurrency(summary.total_expenses)}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                      <p className="text-xs text-green-700 font-medium">صافي الربح التقديري</p>
                      <p className="text-xl font-black text-green-800 mt-1">{formatCurrency(summary.net_profit)}</p>
                    </div>
                  </>
                )}

                {activeReport === 'inventory' && (
                  <>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="text-xs text-stone-500 font-medium">إجمالي قيمة المخزون (بالتكلفة)</p>
                      <p className="text-xl font-bold text-coffee-700 mt-1">{formatCurrency(summary.total_inventory_value)}</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs text-stone-500 font-medium">منتجات منخفضة الرصيد</p>
                        <p className="text-xl font-bold text-yellow-600 mt-1">{formatNumber(summary.low_stock_items)} منتج</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tables */}
            <div className="table-wrapper print-table">
              <table className="data-table">
                {activeReport === 'sales' && (
                  <>
                    <thead>
                      <tr>
                        <th>المنتج / التصنيف</th>
                        <th>الكمية المباعة</th>
                        <th>إجمالي الإيرادات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row: any, i) => (
                        <tr key={i}>
                          <td className="font-medium">{row.product_name} <span className="block text-xs text-stone-400">{row.category_name}</span></td>
                          <td className="font-mono-nums">{formatNumber(row.quantity_sold)}</td>
                          <td className="font-bold text-coffee-700 font-mono-nums">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {activeReport === 'profit' && (
                  <>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>مبيعات</th>
                        <th>خصومات</th>
                        <th>تكلفة بيع (COGS)</th>
                        <th>مصروفات</th>
                        <th>الربح الصافي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row: any, i) => (
                        <tr key={i}>
                          <td className="font-medium text-stone-600 font-mono-nums">{formatDate(row.date, 'short')}</td>
                          <td className="text-blue-700 font-bold font-mono-nums">{formatCurrency(row.revenue)}</td>
                          <td className="text-orange-600 font-mono-nums">- {formatCurrency(row.discounts)}</td>
                          <td className="text-red-600 font-mono-nums">- {formatCurrency(row.cogs)}</td>
                          <td className="text-red-600 font-mono-nums">- {formatCurrency(row.expenses)}</td>
                          <td className="text-green-700 font-black bg-green-50 rounded-lg px-2 m-2 font-mono-nums inline-block">
                             {formatCurrency(row.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {activeReport === 'inventory' && (
                  <>
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th>التصنيف</th>
                        <th>الرصيد الحالي</th>
                        <th>سعر التكلفة</th>
                        <th>قيمة المخزون</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row: any, i) => (
                        <tr key={i}>
                          <td className="font-medium">{row.name}</td>
                          <td className="text-sm text-stone-500">{row.category_name}</td>
                          <td>
                            <span className={`font-bold inline-flex px-2 py-0.5 rounded ${row.current_stock <= row.min_stock_alert ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'} font-mono-nums`}>
                               {formatNumber(row.current_stock)} {row.unit}
                            </span>
                          </td>
                          <td className="font-mono-nums">{formatCurrency(row.cost_price)}</td>
                          <td className="font-bold text-coffee-700 font-mono-nums">{formatCurrency(row.inventory_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

             {data.length === 0 && !loading && (
              <div className="text-center py-10 text-stone-500">لا توجد بيانات للفترة المحددة</div>
            )}
            
          </div>
        )}
      </div>

       <style>{`
        @media print {
          .no-print { display: none !important; }
          .printable-area { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .print-table table { border-collapse: collapse; width: 100%; direction: rtl; }
          .print-table th, .print-table td { border: 1px solid #e5e7eb; padding: 8px; text-align: right; }
          body { background: white; }
          .page-container { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
};

export default ReportsPage;
