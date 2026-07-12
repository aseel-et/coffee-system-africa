import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import api from '../services/api';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    color: '#c4701f',
    icon: 'tag',
    sort_order: '0',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      setCategories(res.data.data);
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل التصنيفات');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category: any = null) => {
    if (category) {
      setFormData({
        name: category.name,
        name_ar: category.name_ar || '',
        color: category.color || '#c4701f',
        icon: category.icon || 'tag',
        sort_order: category.sort_order?.toString() || '0',
        is_active: category.is_active === 1
      });
      setSelectedCategory(category);
    } else {
      setFormData({
        name: '', name_ar: '', color: '#c4701f', icon: 'tag', sort_order: '0', is_active: true
      });
      setSelectedCategory(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('اسم التصنيف مطلوب');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        sort_order: parseInt(formData.sort_order) || 0
      };

      if (selectedCategory) {
        await api.put(`/categories/${selectedCategory.id}`, payload);
        toast.success('تم تحديث التصنيف بنجاح');
      } else {
        await api.post('/categories', payload);
        toast.success('تمت إضافة التصنيف بنجاح');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ التصنيف');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      setSaving(true);
      await api.delete(`/categories/${selectedCategory.id}`);
      toast.success('تم حذف التصنيف بنجاح');
      setIsConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حذف التصنيف');
    } finally {
      setSaving(false);
      setSelectedCategory(null);
    }
  };

  const colors = ['#c4701f', '#d4872a', '#e2a44e', '#1D4ED8', '#16A34A', '#9333EA', '#DC2626', '#475569'];

  return (
    <div>
      <TopBar
        title="التصنيفات"
        subtitle="إدارة وتبويب مجموعات المنتجات"
        actions={
          <button onClick={() => handleOpenModal()} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            تصنيف جديد
          </button>
        }
      />

      <div className="page-container">
        {loading ? (
          <SkeletonTable cols={4} />
        ) : categories.length === 0 ? (
          <div className="card">
            <EmptyState title="لا توجد تصنيفات" description="قم بإضافة التصنيف الأول لبدء تصنيف المنتجات" icon={Tag} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(category => (
              <div key={category.id} className={`card p-5 ${!category.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                      <Tag className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-stone-900">{category.name}</h3>
                      <div className="flex gap-2 text-xs mt-0.5">
                        <span className="text-stone-500">{category.product_count} منتج</span>
                        {!category.is_active && <span className="text-red-500">• معطل</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => handleOpenModal(category)} className="btn-icon">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => { setSelectedCategory(category); setIsConfirmOpen(true); }} className="btn-icon">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ backgroundColor: category.color, width: '40%' }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={selectedCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} disabled={saving} className="btn-secondary">إلغاء</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label">اسم التصنيف *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" placeholder="مثال: مشروبات ساخنة" autoFocus />
          </div>

          <div>
            <label className="label">اللون المميز للتصنيف</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setFormData({...formData, color})}
                  className={`w-10 h-10 rounded-xl transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ترتيب العرض</label>
              <input type="number" value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: e.target.value})} className="input font-mono-nums" min="0" />
              <p className="text-xs text-stone-500 mt-1">الرقم الأقل يظهر أولاً</p>
            </div>
            
            <div className="flex items-center pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 rounded text-coffee-600 focus:ring-coffee-500" />
                <span className="font-medium">تصنيف مفعل</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => !saving && setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        isLoading={saving}
        title="حذف التصنيف"
        message={`هل أنت متأكد أنك تريد حذف التصنيف "${selectedCategory?.name}"؟ لا يمكن التراجع عن هذا الإجراء، ولن يتم الحذف إذا كان يحتوي على منتجات.`}
        isDestructive
      />
    </div>
  );
};

export default CategoriesPage;
