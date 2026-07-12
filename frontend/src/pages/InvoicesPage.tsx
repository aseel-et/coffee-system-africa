import React, { useState, useEffect } from 'react';
import { Search, FileText, ArrowRightLeft, CheckCircle, XCircle, Printer, Eye, RotateCcw, Edit } from 'lucide-react';
import api from '../services/api';
import TopBar from '../components/layout/TopBar';
import { formatCurrency, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import ReceiptPrint from '../components/pos/ReceiptPrint';
import { useAuth } from '../contexts/AuthContext';

const InvoicesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    fetchSales();
  }, [fromDate, toDate]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      
      const res = await api.get('/sales', { params });
      setSales(res.data.data);
    } catch (err) {
      toast.error('أخفق جلب الفواتير');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidSale = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من إلغاء وإرجاع هذه الفاتورة؟ ستعود المنتجات للمخزون وسيتم عكس الديون إن وجدت.')) return;
    try {
      setVoiding(true);
      await api.patch(`/sales/${id}/void`);
      toast.success('تم إلغاء الفاتورة بنجاح');
      setIsModalOpen(false);
      fetchSales();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في الإلغاء');
    } finally {
      setVoiding(false);
    }
  };

  const handleEditSale = async (sale: any) => {
    if (!window.confirm('سيتم إلغاء هذه الفاتورة الأصلية وإرجاع محتوياتها مؤقتاً، ونقلك لنقطة البيع لإنشاء الفاتورة المُعدّلة. هل تريد المتابعة؟')) return;
    try {
      setVoiding(true);
      await api.patch(`/sales/${sale.id}/void`);
      toast.success('تم الإلغاء... جاري نقلك للتعديل');
      
      localStorage.setItem('editCartSession', JSON.stringify({
        items: sale.items,
        discount_percent: sale.discount_percent,
        notes: sale.notes,
        payment_method: sale.payment_method
      }));
      
      setIsModalOpen(false);
      window.location.href = '/pos';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في العملية');
    } finally {
      setVoiding(false);
    }
  };

  const viewSale = async (id: number) => {
    try {
      const res = await api.get(`/sales/${id}`);
      setSelectedSale(res.data.data);
      setIsModalOpen(true);
    } catch (err) {
      toast.error('حدث خطأ أثناء عرض الفاتورة');
    }
  };

  const filteredSales = sales.filter(s => {
    const matchSearch = s.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || s.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <>
      <div className="invoices-ui-container">
      <TopBar title="سجل فواتير المبيعات" subtitle="استعراض ورجوع الفواتير" />

      <div className="page-container">
        <div className="card p-4 flex flex-wrap gap-4 items-center justify-between mb-6">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="ابحث برقم الفاتورة..." 
                className="input pr-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 items-center bg-stone-50 border border-stone-200 rounded-xl px-2 h-[42px] focus-within:border-coffee-400 focus-within:ring-2 focus-within:ring-coffee-100 transition-all">
              <span className="text-sm text-stone-500 font-medium mr-2">من:</span>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm p-0 w-[120px] outline-none"
              />
            </div>
            <div className="flex gap-2 items-center bg-stone-50 border border-stone-200 rounded-xl px-2 h-[42px] focus-within:border-coffee-400 focus-within:ring-2 focus-within:ring-coffee-100 transition-all">
              <span className="text-sm text-stone-500 font-medium mr-2">إلى:</span>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm p-0 w-[120px] outline-none"
              />
            </div>
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input w-auto min-w-[150px]">
            <option value="all">جميع الحالات</option>
            <option value="completed">مكتملة</option>
            <option value="voided">ملغاة (مرجعة)</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 text-sm">
                  <th className="p-4 font-bold">رقم الفاتورة</th>
                  <th className="p-4 font-bold">التاريخ</th>
                  <th className="p-4 font-bold">الموظف / الكاشير</th>
                  <th className="p-4 font-bold">طريقة الدفع</th>
                  <th className="p-4 font-bold">الإجمالي</th>
                  <th className="p-4 font-bold text-center">الحالة</th>
                  <th className="p-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-stone-500">جاري التحميل...</td></tr>
                ) : filteredSales.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-stone-500">لا توجد فواتير مطابقة</td></tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-stone-800">{sale.invoice_number}</td>
                      <td className="p-4 font-mono text-sm">{formatDate(sale.created_at)}</td>
                      <td className="p-4 text-stone-600">{sale.cashier_name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded inline-flex text-xs font-bold ${
                          sale.payment_method === 'cash' ? 'bg-green-100 text-green-700' : 
                          sale.payment_method === 'card' ? 'bg-blue-100 text-blue-700' :
                          sale.payment_method === 'debt' ? 'bg-orange-100 text-orange-700' :
                          'bg-stone-100 text-stone-700'
                        }`}>
                          {sale.payment_method === 'cash' ? 'نقداً' : sale.payment_method === 'card' ? 'بطاقة' : sale.payment_method === 'debt' ? 'دين' : 'مختلط'}
                        </span>
                      </td>
                      <td className="p-4 font-black text-coffee-700">{formatCurrency(sale.total)}</td>
                      <td className="p-4 text-center">
                        {sale.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold"><CheckCircle className="w-3 h-3"/> مكتملة</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold"><XCircle className="w-3 h-3"/> ملغاة</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => viewSale(sale.id)} className="btn-icon text-stone-500 hover:bg-stone-200">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`تفاصيل ${selectedSale?.invoice_number}`} size="lg">
        {selectedSale && (
          <div className="space-y-6">
            <div className="bg-stone-50 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-500">التاريخ: <span className="font-mono text-stone-800 font-bold">{formatDate(selectedSale.created_at)}</span></p>
                <p className="text-sm text-stone-500 mt-1">طريقة الدفع: <span className="font-bold text-stone-800">{selectedSale.payment_method === 'cash'?'نقدي':selectedSale.payment_method==='card'?'بطاقة':'دين'}</span></p>
              </div>
              <div className="text-left">
                <p className="text-3xl font-black text-coffee-800 font-mono-nums">{formatCurrency(selectedSale.total)}</p>
                {selectedSale.status === 'voided' && <p className="text-sm font-bold text-red-600 mt-1">هذه الفاتورة ملغاة</p>}
              </div>
            </div>

            <div className="border border-stone-100 rounded-xl overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    <th className="p-3 font-bold text-stone-600">المنتج</th>
                    <th className="p-3 font-bold text-stone-600">الكمية</th>
                    <th className="p-3 font-bold text-stone-600">السعر</th>
                    <th className="p-3 font-bold text-stone-600">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {selectedSale.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="p-3 font-medium">{item.product_name}</td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 font-bold text-coffee-700">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 pt-4 border-t border-stone-100 hidden-print">
              <button onClick={() => window.print()} className="btn-primary flex-1 justify-center py-3 text-lg font-bold">
                <Printer className="w-5 h-5" />
                طباعة الفاتورة
              </button>
            </div>

            {selectedSale.status === 'completed' && (
              <div className="border-t border-red-100 pt-6 mt-6 grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleEditSale(selectedSale)} 
                  disabled={voiding}
                  className="w-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 group"
                >
                  <Edit className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span>تعديل الفاتورة</span>
                  <span className="text-[10px] font-normal opacity-80 mt-1 text-center">إلغاء الحالية وفتحها في نقطة البيع</span>
                </button>
                <button 
                  onClick={() => handleVoidSale(selectedSale.id)} 
                  disabled={voiding}
                  className="w-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors p-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 group"
                >
                  <RotateCcw className="w-6 h-6 group-hover:-rotate-90 transition-transform" />
                  <span>إلغاء الفاتورة</span>
                  <span className="text-[10px] font-normal opacity-80 mt-1 text-center">استرجاع المنتجات وعكس الديون</span>
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Visible ONLY during print */}
      <div id="printable-receipt" className="pos-receipt-print">
        {selectedSale && <ReceiptPrint sale={selectedSale} cashierName={selectedSale.cashier_name || ''} />}
      </div>

      <style>{`
        .pos-receipt-print {
          display: none;
        }
        @media print {
          .invoices-ui-container {
            display: none !important;
          }
          .pos-receipt-print {
            display: block !important;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            font-weight: 900 !important;
          }
          aside, nav, header, .modal-overlay {
            display: none !important; /* Hide sidebar, modals etc */
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            min-height: 0 !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>
    </>
  );
};

export default InvoicesPage;
