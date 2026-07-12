import React, { useState, useEffect } from 'react';
import { Settings, Save, Store, ReceiptText, ShieldAlert, RotateCcw, AlertTriangle, Lock } from 'lucide-react';
import api from '../services/api';
import TopBar from '../components/layout/TopBar';
import toast from 'react-hot-toast';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    store_name: '',
    store_phone: '',
    tax_rate: '0',
    receipt_footer: '',
    auto_print_receipt: 'true'
  });

  // Factory Reset state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1); // step1=warning, step2=pin
  const [resetPin, setResetPin] = useState('');
  const [resetting, setResetting] = useState(false);
  const [pinError, setPinError] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      const settingsObj = res.data.data;
      setSettings(settingsObj);
      setFormData({
        store_name: settingsObj['store_name'] || 'كافيتيريا جامعة أفريقيا',
        store_phone: settingsObj['store_phone'] || '',
        tax_rate: settingsObj['tax_rate'] || '0',
        receipt_footer: settingsObj['receipt_footer'] || 'شكراً لزيارتكم',
        auto_print_receipt: settingsObj['auto_print_receipt'] || 'true',
      });
    } catch (err) {
      toast.error('حدث خطأ في جلب بيانات الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put('/settings', formData);
      toast.success('تم حفظ الإعدادات بنجاح');
      fetchSettings();
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const openResetDialog = () => {
    setResetStep(1);
    setResetPin('');
    setPinError(false);
    setShowResetDialog(true);
  };

  const handleFactoryReset = async () => {
    if (resetPin !== '1234') {
      setPinError(true);
      setResetPin('');
      return;
    }
    try {
      setResetting(true);
      await api.post('/settings/factory-reset', { pin: resetPin });
      toast.success('✅ تم إعادة ضبط المصنع بنجاح — جميع البيانات التشغيلية مُسحت');
      setShowResetDialog(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في إعادة الضبط');
      setPinError(true);
    } finally {
      setResetting(false);
      setResetPin('');
    }
  };

  return (
    <div>
      <TopBar title="إعدادات النظام" subtitle="تكوين خيارات الكافيتيريا الأساسية" />

      <div className="page-container max-w-4xl mx-auto">
        {loading ? (
          <div className="card p-10 flex justify-center text-stone-400">
            <div className="w-8 h-8 border-4 border-coffee-200 border-t-coffee-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {/* Store Information */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-stone-100">
                <Store className="w-5 h-5 text-coffee-600" />
                <h3 className="text-lg font-bold text-stone-800">بيانات الكافيتيريا (تظهر أعلى الفاتورة)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">اسم الكافيتيريا *</label>
                  <input type="text" name="store_name" value={formData.store_name} onChange={handleChange} className="input font-semibold" required />
                </div>
                <div>
                  <label className="label">رقم الهاتف الافتراضي للتواصل</label>
                  <input type="text" name="store_phone" value={formData.store_phone} onChange={handleChange} className="input text-left" dir="ltr" placeholder="09X XXX XXXX" />
                </div>
              </div>
            </div>

            {/* Receipt & Financial Settings */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-stone-100">
                <ReceiptText className="w-5 h-5 text-coffee-600" />
                <h3 className="text-lg font-bold text-stone-800">إعدادات الفواتير والمحاسبة</h3>
              </div>
              <div className="mb-6">
                <label className="label">طباعة الإيصال تلقائياً بعد البيع</label>
                <select name="auto_print_receipt" value={formData.auto_print_receipt} onChange={handleChange} className="input">
                  <option value="true">نعم (يُطبع فوراً)</option>
                  <option value="false">لا (عبر زر الطباعة الموجود في الشاشة المنبثقة فقط)</option>
                </select>
              </div>
              <div>
                <label className="label">النص السفلي للفاتورة (تذييل الإيصال)</label>
                <textarea name="receipt_footer" value={formData.receipt_footer} onChange={handleChange} className="input" rows={2} placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل، شكراً لزيارتكم..." />
              </div>
            </div>

            {/* Admin Note */}
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 flex gap-4">
              <ShieldAlert className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <span className="font-bold block mb-1">منطقة للمدراء فقط</span>
                <span>تعديل هذه البيانات سيؤثر على مخرجات التقارير وصيغة الإيصالات، تأكد من صحة المدخلات.</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2 gap-3">
              <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto px-8 py-3 text-lg">
                {saving ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div> جاري الحفظ...</span>
                ) : (
                  <span className="flex items-center gap-2"><Save className="w-5 h-5" /> حفظ التغييرات</span>
                )}
              </button>
            </div>

          </form>
        )}

        {/* ========= FACTORY RESET ZONE ========= */}
        <div className="mt-8 card border-2 border-red-200 overflow-hidden">
          <div className="bg-red-50 px-6 py-4 flex items-center gap-3 border-b border-red-100">
            <RotateCcw className="w-5 h-5 text-red-700" />
            <h3 className="text-base font-black text-red-800">إعادة ضبط المصنع</h3>
            <span className="text-xs bg-red-200 text-red-800 font-bold px-2 py-0.5 rounded-full mr-auto">⚠️ خطر</span>
          </div>
          <div className="p-6">
            <p className="text-stone-700 text-sm mb-1 font-medium">ماذا يفعل هذا الإجراء؟</p>
            <ul className="text-sm text-stone-600 space-y-1 mb-4 list-none">
              {[
                'مسح جميع الفواتير والمبيعات',
                'مسح جميع المشتريات والمصاريف',
                'مسح سجل الأنشطة والورديات',
                'مسح جميع المنتجات والتصنيفات',
                'إعادة أرصدة العملاء إلى الصفر',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-red-700">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-stone-500 bg-stone-50 p-3 rounded-lg border mb-4">
              ✅ <strong>يبقى:</strong> بيانات العملاء (بدون رصيد)، المستخدمين، إعدادات النظام، بنود الصرف.
            </p>
            <button
              type="button"
              onClick={openResetDialog}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> ضبط المصنع
            </button>
          </div>
        </div>
      </div>

      {/* ========= FACTORY RESET MODAL ========= */}
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white" />
              <h2 className="text-white font-black text-lg">تأكيد ضبط المصنع</h2>
            </div>

            {resetStep === 1 ? (
              /* Step 1: Warning */
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                  <p className="text-red-800 font-bold text-base mb-2">⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!</p>
                  <p className="text-red-700 text-sm">سيتم مسح جميع بيانات المعاملات بشكل نهائي من قاعدة البيانات. تأكد من أخذ نسخة احتياطية قبل المتابعة.</p>
                </div>
                <p className="text-stone-700 text-sm font-medium mb-6">هل أنت متأكد أنك تريد المتابعة؟</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowResetDialog(false)} className="btn-secondary flex-1">إلغاء</button>
                  <button onClick={() => setResetStep(2)} className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl hover:bg-red-700 transition-colors text-sm">
                    نعم، متابعة
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: PIN */
              <div className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <Lock className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="font-black text-stone-800 text-lg">أدخل رمز التأكيد</h3>
                  <p className="text-stone-500 text-sm mt-1">أدخل الرمز السري لتأكيد عملية الضبط</p>
                </div>

                <div className="mb-4">
                  <input
                    type="password"
                    value={resetPin}
                    onChange={e => { setResetPin(e.target.value); setPinError(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleFactoryReset()}
                    maxLength={4}
                    className={`input text-center text-3xl font-mono tracking-widest ${pinError ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : ''}`}
                    placeholder="••••"
                    autoFocus
                    dir="ltr"
                  />
                  {pinError && (
                    <p className="text-red-600 text-xs text-center mt-2 font-bold">❌ رمز التأكيد غير صحيح، حاول مرة أخرى</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setResetStep(1)} disabled={resetting} className="btn-secondary flex-1">رجوع</button>
                  <button
                    onClick={handleFactoryReset}
                    disabled={resetting || resetPin.length < 4}
                    className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl hover:bg-red-700 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {resetting ? (
                      <><div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" /> جاري الضبط...</>
                    ) : (
                      <><RotateCcw className="w-4 h-4" /> تنفيذ الضبط</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
