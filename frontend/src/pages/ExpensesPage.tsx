import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Receipt, Filter, Tag } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import SearchInput from '../components/ui/SearchInput';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

const COLORS = ['#6B7280','#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#64748B'];

const ExpensesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [formData, setFormData] = useState({
    category_id: '', amount: '', description: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash'
  });
  const [saving, setSaving] = useState(false);

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isCatConfirmOpen, setIsCatConfirmOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<any>(null);
  const [catForm, setCatForm] = useState({ name: '', color: '#6B7280' });
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, catRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/expenses/categories')
      ]);
      setExpenses(expRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل المصروفات');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (expense: any = null) => {
    if (expense) {
      setFormData({
        category_id: expense.expense_category_id?.toString() || '',
        amount: expense.amount?.toString() || '',
        description: expense.description || '',
        expense_date: expense.expense_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        payment_method: expense.payment_method || 'cash'
      });
      setSelectedExpense(expense);
    } else {
      setFormData({
        category_id: categories.length > 0 ? categories[0].id.toString() : '',
        amount: '', description: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash'
      });
      setSelectedExpense(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) { toast.error('المبلغ المدخل غير صحيح'); return; }
    if (!formData.description) { toast.error('البيان / الوصف مطلوب'); return; }
    try {
      setSaving(true);
      const payload = {
        expense_category_id: formData.category_id ? parseInt(formData.category_id) : null,
        amount: parseFloat(formData.amount),
        description: formData.description,
        expense_date: formData.expense_date,
        payment_method: formData.payment_method
      };
      if (selectedExpense) {
        await api.put(`/expenses/${selectedExpense.id}`, payload);
        toast.success('تم التحديث بنجاح');
      } else {
        await api.post('/expenses', payload);
        toast.success('تم تسجيل الصرف بنجاح');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ المصروف');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    try {
      setSaving(true);
      await api.delete(`/expenses/${selectedExpense.id}`);
      toast.success('تم الحذف بنجاح');
      setIsConfirmOpen(false);
      fetchData();
    } catch {
      toast.error('خطأ في الحذف');
    } finally {
      setSaving(false);
      setSelectedExpense(null);
    }
  };

  const handleOpenCatModal = (cat: any = null) => {
    if (cat) { setCatForm({ name: cat.name, color: cat.color || '#6B7280' }); setSelectedCat(cat); }
    else { setCatForm({ name: '', color: '#6B7280' }); setSelectedCat(null); }
    setIsCatModalOpen(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) { toast.error('اسم البند مطلوب'); return; }
    try {
      setSavingCat(true);
      if (selectedCat) {
        await api.put(`/expenses/categories/${selectedCat.id}`, catForm);
        toast.success('تم تحديث البند');
      } else {
        await api.post('/expenses/categories', catForm);
        toast.success('تم إضافة البند');
      }
      setIsCatModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في الحفظ');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async () => {
    if (!selectedCat) return;
    try {
      setSavingCat(true);
      await api.delete(`/expenses/categories/${selectedCat.id}`);
      toast.success('تم حذف البند');
      setIsCatConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في الحذف');
    } finally {
      setSavingCat(false);
      setSelectedCat(null);
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const matchSearch = !search || e.description?.includes(search);
    const matchCat = !filterCategory || e.expense_category_id?.toString() === filterCategory;
    return matchSearch && matchCat;
  });

  const totalFiltered = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <TopBar
        title="المصروفات اليومية"
        subtitle="سجل المصاريف النثرية والتشغيلية"
        actions={
          <div className="flex gap-2">
            {activeTab === 'categories' ? (
              <button onClick={() => handleOpenCatModal()} className="btn-primary text-sm bg-coffee-600">
                <Plus className="w-4 h-4" /> بند صرف جديد
              </button>
            ) : (
              <button onClick={() => handleOpenModal()} className="btn-primary text-sm bg-coffee-600">
                <Plus className="w-4 h-4" /> صرف جديد
              </button>
            )}
          </div>
        }
      />

      <div className="page-container">
        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'expenses' ? 'bg-white text-coffee-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Receipt className="w-4 h-4" /> سند الصرف
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'categories' ? 'bg-white text-coffee-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Tag className="w-4 h-4" /> بنود الصرف
            {categories.length > 0 && <span className="text-xs bg-coffee-100 text-coffee-700 px-1.5 py-0.5 rounded-full">{categories.length}</span>}
          </button>
        </div>

        {/* === EXPENSES TAB === */}
        {activeTab === 'expenses' && (
          <>
            <div className="card p-4 flex flex-wrap gap-4 items-center justify-between mb-6">
              <SearchInput value={search} onChange={setSearch} placeholder="ابحث في البيان..." className="w-full md:w-80" />
              <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 h-11">
                <Filter className="w-4 h-4 text-stone-400" />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-transparent text-sm focus:outline-none text-stone-700 min-w-32">
                  <option value="">كل البنود</option>
                  {categories.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                </select>
              </div>
              {filteredExpenses.length > 0 && (
                <div className="mr-auto text-sm font-bold text-red-700 bg-red-50 px-3 py-2 rounded-xl">
                  إجمالي: - {formatCurrency(totalFiltered)} ({filteredExpenses.length} عملية)
                </div>
              )}
            </div>

            {loading ? <SkeletonTable cols={7} /> : filteredExpenses.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="w-12 h-12 text-stone-300 mb-3" />
                <h3 className="text-stone-700 font-semibold mb-1">لا توجد مصاريف مسجلة</h3>
                <p className="text-stone-400 text-sm">سجل أي مصاريف تشغيلية لتظهر هنا</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th><th>البيان</th><th>بند الصرف</th><th>طريقة الدفع</th><th>المبلغ</th><th>المستخدم</th><th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(expense => (
                      <tr key={expense.id}>
                        <td className="text-stone-500 font-medium">{formatDate(expense.expense_date, 'short')}</td>
                        <td className="font-semibold text-stone-900">{expense.description}</td>
                        <td>
                          <span className="badge badge-gray flex items-center gap-1 w-fit">
                            {expense.category_color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: expense.category_color }} />}
                            {expense.category_name || '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(expense.payment_method || 'cash') === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {(expense.payment_method || 'cash') === 'cash' ? 'كاش' : 'بطاقة'}
                          </span>
                        </td>
                        <td className="font-bold text-red-600 font-mono-nums">- {formatCurrency(expense.amount)}</td>
                        <td className="text-sm text-stone-500">{expense.created_by_name}</td>
                        <td>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleOpenModal(expense)} className="btn-icon text-blue-600 hover:bg-blue-50 py-1.5 px-2"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setSelectedExpense(expense); setIsConfirmOpen(true); }} className="btn-icon text-red-600 hover:bg-red-50 py-1.5 px-2"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* === CATEGORIES TAB === */}
        {activeTab === 'categories' && (
          <>
            {categories.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Tag className="w-12 h-12 text-stone-300 mb-3" />
                <h3 className="text-stone-700 font-semibold mb-1">لا توجد بنود صرف</h3>
                <p className="text-stone-400 text-sm mb-4">أضف بنود الصرف لتنظيم المصاريف (مثل: كهرباء، رواتب، صيانة...)</p>
                <button onClick={() => handleOpenCatModal()} className="btn-primary"><Plus className="w-4 h-4" /> إضافة بند</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(cat => {
                  const catExpenses = expenses.filter(e => e.expense_category_id === cat.id);
                  const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0);
                  return (
                    <div key={cat.id} className="card p-5 flex items-center justify-between group hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg" style={{ backgroundColor: cat.color }}>
                          {cat.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900 text-base">{cat.name}</p>
                          <p className="text-xs text-stone-500">{catExpenses.length} عملية صرف</p>
                          <p className="text-sm font-black text-red-600 font-mono-nums mt-0.5">- {formatCurrency(catTotal)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenCatModal(cat)} className="btn-icon text-blue-600 hover:bg-blue-50 py-1.5 px-2"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setSelectedCat(cat); setIsCatConfirmOpen(true); }} className="btn-icon text-red-600 hover:bg-red-50 py-1.5 px-2"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Expense Modal */}
      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title={selectedExpense ? 'تعديل المصروف' : 'سند صرف جديد'}
        footer={<><button onClick={() => setIsModalOpen(false)} disabled={saving} className="btn-secondary">إلغاء</button><button onClick={handleSubmit} disabled={saving} className="btn-primary"><Receipt className="w-4 h-4" />{saving ? 'جاري الحفظ...' : 'حفظ'}</button></>}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">المبلغ (LYD) *</label>
              <input type="number" step="0.5" min="0" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="input font-mono-nums text-lg font-bold text-red-600" autoFocus placeholder="0.00" />
            </div>
            <div>
              <label className="label">تاريخ الصرف</label>
              <input type="date" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} className="input" />
            </div>
          </div>

          <div>
            <label className="label">بند / تصنيف المصروف</label>
            <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="input py-2.5">
              <option value="">-- غير مصنف --</option>
              {categories.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                لا توجد بنود صرف. <button type="button" onClick={() => { setIsModalOpen(false); setActiveTab('categories'); }} className="underline font-bold">أضف بنود الصرف أولاً</button>
              </p>
            )}
          </div>

          <div>
            <label className="label">طريقة الدفع</label>
            <div className="grid grid-cols-2 gap-2">
              {['cash', 'card'].map(method => (
                <button key={method} type="button" onClick={() => setFormData({...formData, payment_method: method})}
                  className={`p-2.5 rounded-xl border-2 text-sm font-bold transition-all ${formData.payment_method === method ? 'border-coffee-600 bg-coffee-50 text-coffee-800' : 'border-stone-100 text-stone-500'}`}>
                  {method === 'cash' ? '💵 كاش' : '💳 بطاقة'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">البيان (وصف المصروف) *</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input" rows={3} placeholder="مثال: شراء منظفات، دفع فاتورة كهرباء، صيانة ماكينة..." />
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal isOpen={isCatModalOpen} onClose={() => !savingCat && setIsCatModalOpen(false)} title={selectedCat ? 'تعديل بند الصرف' : 'إضافة بند صرف جديد'}
        footer={<><button onClick={() => setIsCatModalOpen(false)} disabled={savingCat} className="btn-secondary">إلغاء</button><button onClick={handleSaveCat} disabled={savingCat} className="btn-primary"><Tag className="w-4 h-4" />{savingCat ? 'جاري الحفظ...' : 'حفظ'}</button></>}
      >
        <div className="space-y-5">
          <div>
            <label className="label">اسم البند *</label>
            <input type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="input" autoFocus placeholder="مثال: كهرباء، رواتب، صيانة..." />
          </div>
          <div>
            <label className="label">اللون التعريفي</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {COLORS.map(color => (
                <button key={color} type="button" onClick={() => setCatForm({...catForm, color})}
                  className={`w-9 h-9 rounded-xl transition-all ${catForm.color === color ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <div className="w-10 h-10 rounded-xl text-white font-bold flex items-center justify-center text-lg" style={{ backgroundColor: catForm.color }}>
                {catForm.name.charAt(0) || '•'}
              </div>
              <p className="text-sm text-stone-500">معاينة البند</p>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={isConfirmOpen} onClose={() => !saving && setIsConfirmOpen(false)} onConfirm={handleDelete} isLoading={saving}
        title="تأكيد حذف المصروف" message={`هل أنت متأكد من حذف "${selectedExpense?.description}"؟`} isDestructive confirmText="حذف" />

      <ConfirmDialog isOpen={isCatConfirmOpen} onClose={() => !savingCat && setIsCatConfirmOpen(false)} onConfirm={handleDeleteCat} isLoading={savingCat}
        title="تأكيد حذف بند الصرف" message={`هل أنت متأكد من حذف بند "${selectedCat?.name}"؟ سيتم إلغاء ربط المصاريف المرتبطة به.`} isDestructive confirmText="حذف" />
    </div>
  );
};

export default ExpensesPage;
