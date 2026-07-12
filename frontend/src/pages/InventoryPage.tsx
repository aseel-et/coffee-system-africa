import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Warehouse, History, ArrowDownUp, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { formatNumber, formatCurrency, formatDate } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import SearchInput from '../components/ui/SearchInput';
import Modal from '../components/ui/Modal';
import ExcelActions from '../components/ui/ExcelActions';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Adjustment Modal
  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjData, setAdjData] = useState({
    type: 'add',
    quantity: '',
    reason: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'stock') {
        const res = await api.get('/inventory', { params: { status: statusFilter } });
        setInventory(res.data.data);
      } else {
        const res = await api.get('/inventory/movements', { params: { limit: 100 } });
        setMovements(res.data.data);
      }
    } catch (err) {
      toast.error('حدث خطأ في جلب بيانات المخزون');
    } finally {
      setLoading(false);
    }
  };

  const openAdjustment = (product: any) => {
    setSelectedProduct(product);
    setAdjData({ type: 'add', quantity: '', reason: '' });
    setIsAdjOpen(true);
  };

  const handleAdjustment = async () => {
    if (!selectedProduct) return;
    if (!adjData.quantity || parseFloat(adjData.quantity) <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر'); return;
    }
    if (!adjData.reason) {
      toast.error('سبب التعديل مطلوب (تسوية، تلف، جرد...)'); return;
    }

    try {
      setSaving(true);
      await api.post('/inventory/adjust', {
        product_id: selectedProduct.id,
        adjustment_type: adjData.type,
        quantity: parseFloat(adjData.quantity),
        reason: adjData.reason
      });
      toast.success('تم تعديل المخزون بنجاح');
      setIsAdjOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في التعديل');
    } finally {
      setSaving(false);
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'purchase': case 'adjustment_in': case 'return': return 'text-green-600 bg-green-50';
      case 'sale': case 'adjustment_out': return 'text-red-600 bg-red-50';
      default: return 'text-stone-600 bg-stone-50';
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'شراء وارد';
      case 'sale': return 'بيع صادر';
      case 'adjustment_in': return 'تسوية إضافة';
      case 'adjustment_out': return 'تسوية خصم';
      case 'return': return 'مرتجع';
      default: return type;
    }
  };

  const filteredStock = inventory.filter(p => !search || p.name.includes(search));

  return (
    <div>
      <TopBar
        title="إدارة المخزون"
        subtitle="متابعة أرصدة وحركات المنتجات المخزنية"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <ExcelActions
              basePath="/inventory"
              exportName="inventory"
              templateFileName="قالب_جرد_المخزون.xlsx"
              templateLabel="قالب الجرد"
              importLabel="تحديث الجرد"
              onImported={fetchData}
            />
            <div className="flex bg-stone-100 rounded-xl p-1">
              <button onClick={() => setActiveTab('stock')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'stock' ? 'bg-white shadow-sm text-coffee-700' : 'text-stone-500 hover:text-stone-700'}`}>الأرصدة</button>
              <button onClick={() => setActiveTab('movements')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'movements' ? 'bg-white shadow-sm text-coffee-700' : 'text-stone-500 hover:text-stone-700'}`}>حركات المخزون</button>
            </div>
          </div>
        }
      />

      <div className="page-container">
        <div className="card p-4 flex gap-4 items-center justify-between mb-6">
          {activeTab === 'stock' ? (
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم المنتج..." className="w-80" />
              <div className="flex gap-2">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm py-2">
                  <option value="">جميع الحالات</option>
                  <option value="low">نواقص (أقل من الحد)</option>
                  <option value="out">نفد المخزون تماماً</option>
                  <option value="ok">متوفر</option>
                </select>
              </div>
            </>
          ) : (
            <div className="text-sm text-stone-500 flex items-center gap-2">
              <History className="w-4 h-4" />
              أحدث 100 حركة تمت على المخزون
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonTable cols={activeTab === 'stock' ? 6 : 7} />
        ) : activeTab === 'stock' ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>التصنيف</th>
                  <th>متوفر الآن</th>
                  <th>حد التنبيه</th>
                  <th>قيمة المخزون</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold text-stone-900">{item.name}</div>
                    </td>
                    <td>{item.category_name || '-'}</td>
                    <td>
                      <div className={`font-bold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                        item.current_stock <= 0 ? 'bg-red-50 text-red-600' :
                        item.current_stock <= item.min_stock_alert ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {item.current_stock <= 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                        {formatNumber(item.current_stock)} {item.unit}
                      </div>
                    </td>
                    <td className="text-stone-500 font-mono-nums">{formatNumber(item.min_stock_alert)}</td>
                    <td className="font-mono-nums font-semibold text-stone-700">{formatCurrency(item.current_stock * item.cost_price)}</td>
                    <td>
                      <button onClick={() => openAdjustment(item)} className="btn-secondary text-xs py-1.5 px-3">
                        <ArrowDownUp className="w-3.5 h-3.5 mr-1" /> تسوية
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>المنتج</th>
                  <th>نوع الحركة</th>
                  <th>الكمية</th>
                  <th>الرصيد بعد</th>
                  <th>السبب/المرجع</th>
                  <th>المستخدم</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(mov => (
                  <tr key={mov.id}>
                    <td className="text-xs text-stone-500">{formatDate(mov.created_at, 'datetime')}</td>
                    <td className="font-semibold text-stone-900">{mov.product_name}</td>
                    <td>
                      <span className={`badge ${getMovementColor(mov.movement_type)}`}>
                        {getMovementLabel(mov.movement_type)}
                      </span>
                    </td>
                    <td className="font-bold font-mono-nums" dir="ltr">
                      {['sale', 'adjustment_out'].includes(mov.movement_type) ? '-' : '+'}{formatNumber(mov.quantity)} {mov.unit}
                    </td>
                    <td className="font-bold text-stone-700 font-mono-nums">{formatNumber(mov.quantity_after)}</td>
                    <td className="text-xs text-stone-500 max-w-xs truncate" title={mov.reason}>{mov.reason}</td>
                    <td className="text-sm">{mov.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isAdjOpen}
        onClose={() => !saving && setIsAdjOpen(false)}
        title="إجراء تسوية يدوية للمخزون"
        footer={
          <>
            <button onClick={() => setIsAdjOpen(false)} className="btn-secondary">إلغاء</button>
            <button onClick={handleAdjustment} disabled={saving} className="btn-primary">حفظ التسوية</button>
          </>
        }
      >
        {selectedProduct && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
              <div>
                <div className="text-sm text-blue-600 font-medium mb-1">الرصيد الحالي للمنتج</div>
                <div className="text-xl font-bold text-blue-900">{selectedProduct.name}</div>
              </div>
              <div className="text-3xl font-black text-blue-700 font-mono-nums">
                {formatNumber(selectedProduct.current_stock)} <span className="text-base font-normal">{selectedProduct.unit}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">نوع التسوية</label>
                <select value={adjData.type} onChange={e => setAdjData({...adjData, type: e.target.value})} className="input">
                  <option value="add">إضافة (+) - جرد أو فائض</option>
                  <option value="subtract">خصم (-) - تالف أو عجز</option>
                </select>
              </div>
              <div>
                <label className="label">الكمية للتسوية</label>
                <input type="number" min="0" step="0.01" value={adjData.quantity} onChange={e => setAdjData({...adjData, quantity: e.target.value})} className="input font-mono-nums text-lg font-bold" autoFocus />
              </div>
            </div>

            <div>
              <label className="label">سبب التسوية المكتوب (مطلوب)</label>
              <textarea value={adjData.reason} onChange={e => setAdjData({...adjData, reason: e.target.value})} className="input" rows={2} placeholder="مثال: تسوية الجرد الشهري، منتج تالف وقت التحضير..." />
            </div>
            
            <div className="bg-stone-50 p-3 rounded-lg text-sm text-stone-600 border border-stone-200">
              الرصيد الجديد المتوقع: <strong className="font-mono-nums ml-1" dir="ltr">
                {adjData.type === 'add' ? 
                  formatNumber(selectedProduct.current_stock + (parseFloat(adjData.quantity)||0)) : 
                  formatNumber(selectedProduct.current_stock - (parseFloat(adjData.quantity)||0))}
              </strong>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InventoryPage;
