import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, PackageOpen, Box, Coffee, ImagePlus, X, Download, Upload, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatNumber } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import SearchInput from '../components/ui/SearchInput';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    category_id: '',
    selling_price: '',
    cost_price: '',
    product_type: 'non_stock',
    is_active: true,
    show_in_pos: true,
    current_stock: '',
    min_stock_alert: '',
    unit: 'قطعة',
    image_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize the chosen image client-side and convert to a compact JPEG data URL
  // so the database stays small even with many product photos.
  const resizeImage = (file: File, maxSize = 400, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('canvas'));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('الرجاء اختيار ملف صورة صالح');
      return;
    }
    try {
      setUploadingImage(true);
      const dataUrl = await resizeImage(file);
      setFormData(prev => ({ ...prev, image_url: dataUrl }));
    } catch {
      toast.error('تعذر تحميل الصورة');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories')
      ]);
      setProducts(prodRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // ── Excel import / export ──
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const downloadBlob = (data: Blob, filename: string) => {
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get('/products/export', { responseType: 'blob' });
      downloadBlob(res.data, `products_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('تم تصدير المنتجات إلى Excel');
    } catch {
      toast.error('خطأ في تصدير المنتجات');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/products/template', { responseType: 'blob' });
      downloadBlob(res.data, 'قالب_المنتجات.xlsx');
      toast.success('تم تحميل القالب');
    } catch {
      toast.error('خطأ في تحميل القالب');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/products/import', { fileBase64 });
      const r = res.data.data;
      toast.success(res.data.message, { duration: 5000 });
      if (r?.errors?.length) {
        toast.error(`${r.errors.length} صف به مشكلة: ${r.errors.slice(0, 3).map((x: any) => x.message).join(' • ')}`, { duration: 9000 });
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في استيراد الملف');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setFormData({
        name: product.name,
        name_ar: product.name_ar || '',
        category_id: product.category_id?.toString() || '',
        selling_price: product.selling_price?.toString() || '',
        cost_price: product.cost_price?.toString() || '',
        product_type: product.product_type,
        is_active: product.is_active === 1,
        show_in_pos: product.show_in_pos === 1,
        current_stock: product.current_stock?.toString() || '',
        min_stock_alert: product.min_stock_alert?.toString() || '',
        unit: product.unit || 'قطعة',
        image_url: product.image_url || ''
      });
      setSelectedProduct(product);
    } else {
      setFormData({
        name: '', name_ar: '', category_id: categories.length > 0 ? categories[0].id.toString() : '',
        selling_price: '', cost_price: '', product_type: 'non_stock',
        is_active: true, show_in_pos: true, current_stock: '', min_stock_alert: '', unit: 'قطعة',
        image_url: ''
      });
      setSelectedProduct(null);
    }
    setIsModalOpen(true);
  };

  const validateForm = () => {
    if (!formData.name) { toast.error('الاسم مطلوب'); return false; }
    if (!formData.selling_price) { toast.error('سعر البيع مطلوب'); return false; }
    if (parseFloat(formData.selling_price) < 0) { toast.error('سعر البيع غير صحيح'); return false; }
    if (parseFloat(formData.cost_price || '0') < 0) { toast.error('سعر التكلفة غير صحيح'); return false; }
    if (formData.product_type === 'stock_tracked') {
      if (parseFloat(formData.min_stock_alert || '0') < 0) { toast.error('حد التنبيه غير صحيح'); return false; }
      if (!selectedProduct && parseFloat(formData.current_stock || '0') < 0) {
        toast.error('الكمية الافتتاحية غير صحيحة'); return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = {
        ...formData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        selling_price: parseFloat(formData.selling_price),
        cost_price: parseFloat(formData.cost_price || '0'),
        current_stock: formData.current_stock ? parseFloat(formData.current_stock) : 0,
        min_stock_alert: formData.min_stock_alert ? parseFloat(formData.min_stock_alert) : 0,
      };

      if (selectedProduct) {
        await api.put(`/products/${selectedProduct.id}`, payload);
        toast.success('تم تحديث المنتج بنجاح');
      } else {
        await api.post('/products', payload);
        toast.success('تمت إضافة المنتج بنجاح');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    try {
      setSaving(true);
      await api.delete(`/products/${selectedProduct.id}`);
      toast.success('تم حذف المنتج بنجاح');
      setIsConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'لا يمكن حذف المنتج لاارتباطه بعمليات أخرى');
    } finally {
      setSaving(false);
      setSelectedProduct(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.name_ar?.includes(search);
    const matchType = !filterType || p.product_type === filterType;
    const matchCategory = !filterCategory || p.category_id?.toString() === filterCategory;
    return matchSearch && matchType && matchCategory;
  });

  return (
    <div>
      <TopBar
        title="المنتجات"
        subtitle="إدارة أصناف المخزون ومنتجات نقطة البيع"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportFile}
              className="hidden"
            />
            <button onClick={handleDownloadTemplate} className="btn-secondary text-sm" title="تحميل قالب Excel فارغ جاهز للتعبئة">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">قالب</span>
            </button>
            <button onClick={() => importInputRef.current?.click()} disabled={importing} className="btn-secondary text-sm" title="استيراد منتجات من ملف Excel">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{importing ? 'جاري الاستيراد...' : 'استيراد'}</span>
            </button>
            <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm" title="تصدير كل المنتجات إلى Excel">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{exporting ? 'جاري التصدير...' : 'تصدير'}</span>
            </button>
            <button onClick={() => handleOpenModal()} className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
              منتج جديد
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-4 items-center justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم المنتج..." className="w-full md:w-80" />
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 h-11">
              <Filter className="w-4 h-4 text-stone-400" />
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                className="bg-transparent text-sm focus:outline-none text-stone-700 min-w-32"
              >
                <option value="">جميع الأنواع</option>
                <option value="non_stock">مشروبات/وجبات (بدون مخزون)</option>
                <option value="stock_tracked">منتج مخزني (تتبع كمية)</option>
              </select>
            </div>
            
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)}
              className="input text-sm py-2 px-3 w-auto"
            >
              <option value="">جميع التصنيفات</option>
              {categories.map(c => (
                <option key={c.id} value={c.id.toString()}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable cols={6} />
        ) : filteredProducts.length === 0 ? (
          <div className="card">
            <EmptyState title="لا توجد منتجات مطابقة" />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>التصنيف</th>
                  <th>النوع</th>
                  <th>سعر البيع</th>
                  <th>التكلفة</th>
                  <th>المخزون المتوفر</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id} className={!product.is_active ? 'opacity-50 bg-stone-50' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name}
                               className="w-10 h-10 rounded-lg object-cover border border-stone-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                               style={{ backgroundColor: `${product.category_color || '#d4872a'}20`, color: product.category_color || '#d4872a' }}>
                            {product.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-stone-900">{product.name}</p>
                          <div className="flex gap-2 text-xs mt-0.5">
                            {!product.is_active && <span className="text-red-500">معطل</span>}
                            {!product.show_in_pos && <span className="text-yellow-600">مخفي من الـ POS</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-gray">{product.category_name || '-'}</span></td>
                    <td>
                      {product.product_type === 'stock_tracked' ? (
                        <span className="badge badge-blue"><Box className="w-3 h-3 ml-1" />منتج مخزني</span>
                      ) : (
                        <span className="badge bg-coffee-100 text-coffee-700"><Coffee className="w-3 h-3 ml-1" />مشروب/وجبة</span>
                      )}
                    </td>
                    <td className="font-bold text-coffee-700">{formatCurrency(product.selling_price)}</td>
                    <td className="text-stone-500">{formatCurrency(product.cost_price)}</td>
                    <td>
                      {product.product_type === 'stock_tracked' ? (
                        <div className="flex flex-col">
                          <span className={`font-semibold ${
                            product.current_stock <= 0 ? 'text-red-600' :
                            product.current_stock <= product.min_stock_alert ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {formatNumber(product.current_stock)} {product.unit}
                          </span>
                          {product.current_stock <= product.min_stock_alert && (
                            <span className="text-xs text-stone-400">الحد: {formatNumber(product.min_stock_alert)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400 text-xs">غير مطبق</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenModal(product)} className="btn-icon text-blue-600 hover:bg-blue-50">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelectedProduct(product); setIsConfirmOpen(true); }} className="btn-icon text-red-600 hover:bg-red-50">
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

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={selectedProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
        size="2xl"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} disabled={saving} className="btn-secondary">إلغاء</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary">
              {saving ? 'جاري الحفظ...' : 'حفظ المنتج'}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Product image */}
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {formData.image_url ? (
                <>
                  <img src={formData.image_url} alt="معاينة" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, image_url: '' })}
                    className="absolute top-1 left-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow"
                    title="إزالة الصورة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <ImagePlus className="w-8 h-8 text-stone-300" />
              )}
            </div>
            <div>
              <label className="label">صورة المنتج</label>
              <p className="text-xs text-stone-500 mb-2">تظهر في شاشة البيع (POS). يُفضّل صورة مربعة.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="product-image-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="btn-secondary text-sm"
              >
                <ImagePlus className="w-4 h-4" />
                {uploadingImage ? 'جاري التحميل...' : formData.image_url ? 'تغيير الصورة' : 'اختيار صورة'}
              </button>
            </div>
          </div>

          {/* Main info row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">اسم المنتج *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" placeholder="مثال: لاتيه حار / ماء معدني" />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="input">
                <option value="">أخرى (بدون تصنيف)</option>
                {categories.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">سعر البيع (LYD) *</label>
              <input type="number" step="0.5" min="0" value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: e.target.value})} className="input font-mono-nums" />
            </div>
            <div>
              <label className="label">التكلفة (LYD)</label>
              <input type="number" step="0.5" min="0" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} className="input font-mono-nums" />
            </div>
          </div>

          {/* Type Selection */}
          <div className="bg-stone-50 border border-stone-200 p-4 rounded-xl">
            <label className="label font-bold mb-3">نوع المنتج *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`flex gap-3 p-3 rounded-xl border border-stone-200 cursor-pointer transition-all ${formData.product_type === 'non_stock' ? 'bg-coffee-50 border-coffee-400 ring-1 ring-coffee-400' : 'bg-white hover:border-coffee-300'}`}>
                <input type="radio" className="mt-1 flex-shrink-0" name="ptype" checked={formData.product_type === 'non_stock'} onChange={() => setFormData({...formData, product_type: 'non_stock'})} />
                <div>
                  <div className="font-semibold text-stone-900 pb-1">مشروب أو وجبة تحضيرية</div>
                  <div className="text-xs text-stone-500">لا يتم تتبع المخزون لها مباشرة عند البيع. مناسبة للقهوة والشاي والمعجنات.</div>
                </div>
              </label>

              <label className={`flex gap-3 p-3 rounded-xl border border-stone-200 cursor-pointer transition-all ${formData.product_type === 'stock_tracked' ? 'bg-coffee-50 border-coffee-400 ring-1 ring-coffee-400' : 'bg-white hover:border-coffee-300'}`}>
                <input type="radio" className="mt-1 flex-shrink-0" name="ptype" checked={formData.product_type === 'stock_tracked'} onChange={() => setFormData({...formData, product_type: 'stock_tracked'})} />
                <div>
                  <div className="font-semibold text-stone-900 pb-1">منتج مخزني (تجزئة)</div>
                  <div className="text-xs text-stone-500">مياه، عصائر مقفلة، سناكس مغلفة. سيتم خصم الكمية من المخزون عند البيع.</div>
                </div>
              </label>
            </div>
          </div>

          {/* Stock tracking fields conditionally rendered */}
          {formData.product_type === 'stock_tracked' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-blue-100 bg-blue-50/30 rounded-xl">
              {!selectedProduct && (
                <div>
                  <label className="label">رصيد افتتاحي</label>
                  <input type="number" min="0" value={formData.current_stock} onChange={e => setFormData({...formData, current_stock: e.target.value})} className="input font-mono-nums" placeholder="أدخل الكمية المتوفرة حالياً" />
                </div>
              )}
              <div>
                <label className="label">تنبيه النواقص عند وصول لـ</label>
                <input type="number" min="0" value={formData.min_stock_alert} onChange={e => setFormData({...formData, min_stock_alert: e.target.value})} className="input font-mono-nums" />
              </div>
              <div>
                <label className="label">الوحدة</label>
                <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="input">
                  <option value="قطعة">قطعة</option>
                  <option value="زجاجة">زجاجة</option>
                  <option value="علبة">علبة</option>
                  <option value="كيس">كيس</option>
                  <option value="كرتونة">كرتونة</option>
                </select>
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 border border-stone-100 rounded-xl cursor-pointer">
              <input type="checkbox" checked={formData.show_in_pos} onChange={e => setFormData({...formData, show_in_pos: e.target.checked})} className="w-5 h-5 rounded text-coffee-600 focus:ring-coffee-500 border-stone-300" />
              <div className="flex flex-col">
                <span className="font-medium text-stone-800">إظهار في شاشة البيع (POS)</span>
                <span className="text-xs text-stone-500">حتى يتمكن الكاشير من بيع هذا الصنف</span>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-stone-100 rounded-xl cursor-pointer">
              <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 rounded text-coffee-600 focus:ring-coffee-500 border-stone-300" />
              <div className="flex flex-col">
                <span className="font-medium text-stone-800">منتج مفعل</span>
                <span className="text-xs text-stone-500">إيقاف التفعيل يعطل المنتج بالكامل دون حذفه</span>
              </div>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => !saving && setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        isLoading={saving}
        title="تأكيد حذف المنتج"
        message={`هل أنت متأكد من رغبتك في حذف المنتج "${selectedProduct?.name}"؟ سيؤدي هذا الإجراء إلى مسح بيانات المنتج بشكل نهائي، علماً بأنه لا يمكن حذف المنتجات التي أجريت عليها عمليات بيع سابقة.`}
        isDestructive
        confirmText="حذف المنتج"
      />
    </div>
  );
};

export default ProductsPage;
