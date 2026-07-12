import React, { useState, useEffect } from 'react';
import { Plus, Search, User, Phone, MapPin, Wallet, History, CreditCard, ArrowUpCircle, ArrowDownCircle, Settings2, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import Modal from '../components/ui/Modal';
import ExcelActions from '../components/ui/ExcelActions';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const CustomersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    balance: '0'
  });

  const [txData, setTxData] = useState({
    type: 'payment',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      setCustomers(res.data.data);
    } catch (err) {
      toast.error('خطأ في جلب بيانات العملاء');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) return toast.error('اسم العميل مطلوب');
    try {
      setSaving(true);
      if (selectedCustomer) {
        await api.put(`/customers/${selectedCustomer.id}`, formData);
        toast.success('تم تحديث بيانات العميل');
      } else {
        await api.post('/customers', formData);
        toast.success('تم إضافة العميل بنجاح');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error('خطأ في حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  const handleTransaction = async () => {
    if (!txData.amount || parseFloat(txData.amount) <= 0) return toast.error('المبلغ مطلوب');
    try {
      setSaving(true);
      await api.post(`/customers/${selectedCustomer.id}/transactions`, {
        type: txData.type,
        amount: parseFloat(txData.amount),
        notes: txData.notes
      });
      toast.success('تم تسجيل المعاملة بنجاح');
      setIsTxModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error('خطأ في تسجيل المعاملة');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  return (
    <div>
      <TopBar 
        title="إدارة العملاء والديون" 
        subtitle="متابعة حسابات العملاء والديون الآجلة"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <ExcelActions
                basePath="/customers"
                exportName="customers"
                templateFileName="قالب_العملاء.xlsx"
                onImported={fetchCustomers}
              />
            )}
            <button onClick={() => { setSelectedCustomer(null); setFormData({name:'', phone:'', address:'', balance:'0'}); setIsModalOpen(true); }} className="btn-primary">
              <Plus className="w-4 h-4" /> عميل جديد
            </button>
          </div>
        }
      />

      <div className="page-container">
        <div className="card p-4 mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="ابحث باسم العميل أو رقم الهاتف..." 
              className="input pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-coffee-100 rounded-full flex items-center justify-center text-coffee-700 font-bold text-xl">
                  {customer.name.charAt(0)}
                </div>
                <div className="text-left">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${customer.balance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {customer.balance >= 0 ? 'دائن' : 'مدين'}
                  </span>
                  <p className={`text-xl font-black mt-1 font-mono-nums ${customer.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrency(customer.balance)}
                  </p>
                </div>
              </div>

              <h3 className="font-bold text-lg text-stone-800 mb-1">{customer.name}</h3>
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center gap-2 text-stone-500 text-sm">
                  <Phone className="w-4 h-4" /> {customer.phone || 'بدون هاتف'}
                </div>
                <div className="flex items-center gap-2 text-stone-500 text-sm">
                  <MapPin className="w-4 h-4" /> {customer.address || 'بدون عنوان'}
                </div>
              </div>

              {isAdmin && (
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setSelectedCustomer(customer); setTxData({type:'payment', amount:'', notes:''}); setIsTxModalOpen(true); }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors text-sm font-bold"
                  >
                    <History className="w-4 h-4" /> الحساب
                  </button>
                  <button 
                    onClick={() => { setSelectedCustomer(customer); setFormData({name:customer.name, phone:customer.phone||'', address:customer.address||'', balance:customer.balance.toString()}); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-coffee-600 text-white rounded-xl hover:bg-coffee-700 transition-colors text-sm font-bold"
                  >
                    <Settings2 className="w-4 h-4" /> تعديل
                  </button>
                  <button 
                    onClick={async () => {
                      if (Math.abs(customer.balance) > 0.001) {
                        toast.error('لا يمكن حذف عميل لديه رصيد غير مصفر');
                        return;
                      }
                      if (window.confirm(`هل أنت متأكد من حذف العميل "${customer.name}" نهائياً من النظام؟`)) {
                        try {
                          await api.delete(`/customers/${customer.id}`);
                          toast.success('تم حذف العميل بنجاح');
                          fetchCustomers();
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'خطأ في الحذف');
                        }
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all text-sm font-bold col-span-2 mt-1 border border-red-100"
                  >
                    <Trash2 className="w-4 h-4" /> حذف العميل
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Customer Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">اسم العميل *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" placeholder="الاسم الكامل..." />
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input" placeholder="09xxxxxxx" />
          </div>
          <div>
            <label className="label">العنوان</label>
            <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="input" placeholder="حي / سكن / كلية..." />
          </div>
          {!selectedCustomer && (
            <div>
              <label className="label">الرصيد الافتتاحي</label>
              <input type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="input" placeholder="0" />
              <p className="text-xs text-stone-400 mt-1">المبالغ الموجبة تعني رصيد للعميل، السالبة تعني دين عليه.</p>
            </div>
          )}
          <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full justify-center py-3 mt-4">
            {saving ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
          </button>
        </div>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title={`سير الحساب: ${selectedCustomer?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setTxData({...txData, type: 'payment'})}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${txData.type === 'payment' ? 'border-green-600 bg-green-50' : 'border-stone-100 bg-stone-50'}`}
            >
              <ArrowUpCircle className="w-8 h-8 text-green-600" />
              <span className="font-bold text-green-900">سداد دين / إيداع</span>
            </button>
            <button 
              onClick={() => setTxData({...txData, type: 'debt'})}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${txData.type === 'debt' ? 'border-red-600 bg-red-50' : 'border-stone-100 bg-stone-50'}`}
            >
              <ArrowDownCircle className="w-8 h-8 text-red-600" />
              <span className="font-bold text-red-900">سحب / دين جديد</span>
            </button>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">المبلغ</label>
              <input type="number" value={txData.amount} onChange={e => setTxData({...txData, amount: e.target.value})} className="input text-2xl font-black text-center font-mono-nums" placeholder="0.00" />
            </div>
            <button onClick={handleTransaction} disabled={saving} className="btn-primary h-[54px] px-8">
              {saving ? '...' : 'تثبيت'}
            </button>
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <input type="text" value={txData.notes} onChange={e => setTxData({...txData, notes: e.target.value})} className="input" placeholder="سبب العملية..." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomersPage;
