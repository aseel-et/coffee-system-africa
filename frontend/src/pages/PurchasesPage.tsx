import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, ShoppingBag, Search as SearchIcon, FileText, PackageOpen, Trash2, Pencil } from 'lucide-react';
import api from '../services/api';
import { formatNumber, formatCurrency, formatDate } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import SearchInput from '../components/ui/SearchInput';
import Modal from '../components/ui/Modal';
import { SkeletonTable } from '../components/ui/Skeleton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const PurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Purchase form state
  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_name: '',
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  
  const [items, setItems] = useState<any[]>([{ product_id: '', quantity: '', unit_cost: '' }]);

  useEffect(() => {
    fetchData();
    fetchProducts();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/purchases');
      setPurchases(res.data.data);
    } catch (err) {
      toast.error('حدث خطأ في جلب بيانات المشتريات');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { is_active: 'true' } });
      setProducts(res.data.data.filter((p: any) => p.product_type === 'stock_tracked'));
    } catch (err) {
      toast.error('خطأ في جلب المنتجات المخزنية');
    }
  };

  const handleOpenModal = () => {
    setEditingId(null);
    setFormData({ supplier_id: '', supplier_name: '', invoice_number: '', purchase_date: new Date().toISOString().split('T')[0], notes: '' });
    setItems([{ product_id: '', quantity: '', unit_cost: '' }]);
    setIsModalOpen(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      const data = res.data.data;
      setEditingId(id);
      setFormData({
        supplier_id: data.supplier_id?.toString() || '',
        supplier_name: data.supplier_name || '',
        invoice_number: data.invoice_number || '',
        purchase_date: data.purchase_date,
        notes: data.notes || ''
      });
      setItems(data.items.map((i: any) => ({
        product_id: i.product_id.toString(),
        quantity: i.quantity.toString(),
        unit_cost: i.unit_cost.toString()
      })));
      setIsModalOpen(true);
    } catch (err) {
      toast.error('خطأ في جلب تفاصيل الفاتورة');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      await api.delete(`/purchases/${deleteId}`);
      toast.success('تم حذف فاتورة المشتريات وتعديل المخزون');
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حذف الفاتورة');
    } finally {
      setIsDeleting(false);
    }
  };

  const addItemRow = () => setItems([...items, { product_id: '', quantity: '', unit_cost: '' }]);
  
  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto fill unit cost if product selected and cost is empty
    if (field === 'product_id') {
      const product = products.find(p => p.id.toString() === value);
      if (product) {
        newItems[index].unit_cost = product.cost_price.toString();
      }
    }
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)), 0);
  };

  const handleSubmit = async () => {
    if (!formData.supplier_name) { toast.error('اسم المورد مطلوب'); return; }
    
    // Validate items
    const validItems = items.filter(i => i.product_id && parseFloat(i.quantity) > 0 && parseFloat(i.unit_cost) >= 0);
    if (validItems.length === 0) { toast.error('يجب إضافة منتج واحد على الأقل بكمية صحيحة'); return; }

    try {
      setSaving(true);
      const payload = {
        supplier_id: null,
        supplier_name: formData.supplier_name,
        invoice_number: formData.invoice_number || null,
        purchase_date: formData.purchase_date,
        notes: formData.notes || null,
        items: validItems.map(i => ({
          product_id: parseInt(i.product_id),
          quantity: parseFloat(i.quantity),
          unit_cost: parseFloat(i.unit_cost)
        }))
      };

      if (editingId) {
        await api.put(`/purchases/${editingId}`, payload);
        toast.success('تم تعديل الفاتورة وتحديث رصيد المخزون بنجاح');
      } else {
        await api.post('/purchases', payload);
        toast.success('تم تسجيل المشتريات بنجاح وإضافة الكميات للمخزون');
      }
      
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ المشتريات');
    } finally {
      setSaving(false);
    }
  };

  const filteredPurchases = purchases.filter(p => !search || p.invoice_number?.includes(search) || p.supplier_name?.includes(search));

  return (
    <div>
      <TopBar
        title="المشتريات وإيصالات الاستلام"
        subtitle="تسجيل البضائع الواردة وزيادة أرصدة المخازن"
        actions={
          <button onClick={handleOpenModal} className="btn-primary text-sm bg-coffee-600">
            <Plus className="w-4 h-4" />
            فاتورة مشتريات جديدة
          </button>
        }
      />

      <div className="page-container">
        <div className="card p-4 flex flex-wrap gap-4 items-center justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم المورد أو رقم الفاتورة..." className="w-80" />
        </div>

        {loading ? (
          <SkeletonTable cols={6} />
        ) : filteredPurchases.length === 0 ? (
          <div className="card">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingBag className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="text-stone-700 font-semibold mb-1">لا توجد فواتير مشتريات</h3>
              <p className="text-stone-400 text-sm">أضف مشتريات جديدة لزيادة رصيد المنتجات المخزنية</p>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>رقم الفاتورة/المرجع</th>
                  <th>المورد</th>
                  <th>عدد الأصناف</th>
                  <th>الإجمالي</th>
                  <th>المستخدم</th>
                  <th className="text-center w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(purchase => (
                  <tr key={purchase.id}>
                    <td className="text-stone-500 font-medium">{formatDate(purchase.purchase_date, 'datetime')}</td>
                    <td className="font-semibold font-mono-nums">{purchase.invoice_number || '-'}</td>
                    <td>{purchase.supplier_name}</td>
                    <td>
                      <span className="badge badge-gray">{purchase.total_items} صنف</span>
                    </td>
                    <td className="font-bold text-coffee-700 font-mono-nums">{formatCurrency(purchase.total_amount)}</td>
                    <td className="text-sm text-stone-500">{purchase.user_name}</td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(purchase.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-coffee-600 hover:bg-coffee-50 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(purchase.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingId ? "تعديل فاتورة مشتريات" : "تسجيل فاتورة مشتريات واردة"}
        size="2xl"
        footer={
          <>
            <div className="text-lg font-bold text-coffee-700 ml-auto flex-1 font-mono-nums">
              الإجمالي: {formatCurrency(calculateTotal())}
            </div>
            <button onClick={() => setIsModalOpen(false)} disabled={saving} className="btn-secondary">إلغاء</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary">
              {saving ? 'جاري الحفظ...' : 'اعتماد وحفظ بالمخزون'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">اسم المورد / الشركة *</label>
              <input type="text" value={formData.supplier_name} onChange={e => setFormData({...formData, supplier_name: e.target.value})} className="input" placeholder="اسم المندوب أو الشركة..." autoFocus />
            </div>
            <div>
              <label className="label">تاريخ الشراء *</label>
              <input type="date" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} className="input font-mono-nums" required />
            </div>
            <div>
              <label className="label">رقم فاتورة المورد (اختياري)</label>
              <input type="text" value={formData.invoice_number} onChange={e => setFormData({...formData, invoice_number: e.target.value})} className="input font-mono-nums" placeholder="INV-..." />
            </div>
          </div>

          <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <label className="label mb-0 font-bold text-stone-900">الأصناف المستلمة *</label>
              <span className="text-xs text-stone-500 bg-white px-2 py-1 rounded border border-stone-200">الأصناف المخزنية فقط</span>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-stone-500 mb-1">
                <div className="col-span-5">المنتج</div>
                <div className="col-span-3 text-center">الكمية المستلمة</div>
                <div className="col-span-3 text-center">سعر شراء الوحدة</div>
                <div className="col-span-1"></div>
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 relative">
                    <select value={item.product_id} onChange={e => updateItem(index, 'product_id', e.target.value)} className="input text-sm py-2 bg-white pr-8 w-full border-stone-300">
                      <option value="">-- اختر المنتج --</option>
                      {products.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
                    </select>
                    <PackageOpen className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" min="0" step="0.5" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="input text-sm py-2 text-center font-mono-nums border-stone-300 bg-white" placeholder="الكمية" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" min="0" step="0.5" value={item.unit_cost} onChange={e => updateItem(index, 'unit_cost', e.target.value)} className="input text-sm py-2 text-center font-mono-nums border-stone-300 bg-white" placeholder="سعر الوحدة" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeItemRow(index)} disabled={items.length === 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addItemRow} className="mt-3 text-sm text-coffee-600 hover:text-coffee-700 font-medium flex items-center gap-1.5 focus:outline-none bg-coffee-50 px-3 py-1.5 rounded-lg border border-coffee-100 hover:bg-coffee-100 transition-colors">
              <Plus className="w-4 h-4" /> صنف إضافي
            </button>
          </div>

          <div>
            <label className="label">ملاحظات إضافية (اختياري)</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="input text-sm" rows={2} placeholder="سجل أي ملاحظات خاصة بالاستلام..." />
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="حذف فاتورة المشتريات"
        message="هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ سيتم أيضاً خصم الكميات من المخزون التابع لهذه الفاتورة. هذا الإجراء لا يمكن التراجع عنه."
        confirmText={isDeleting ? 'جاري الحذف...' : 'حذف الفاتورة'}
        isDestructive={true}
      />
    </div>
  );
};

export default PurchasesPage;
