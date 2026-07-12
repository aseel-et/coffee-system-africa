import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, UsersIcon, Search, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';
import TopBar from '../components/layout/TopBar';
import SearchInput from '../components/ui/SearchInput';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SkeletonTable } from '../components/ui/Skeleton';
import { formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'cashier',
    password: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch (err) {
      toast.error('حدث خطأ أثناء تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setFormData({
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        password: '', // Empty unless changing
        is_active: user.is_active === 1
      });
      setSelectedUser(user);
    } else {
      setFormData({
        username: '',
        full_name: '',
        role: 'cashier',
        password: '',
        is_active: true
      });
      setSelectedUser(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.username || !formData.full_name) {
      toast.error('الاسم الكامل واسم المستخدم مطلوبة'); return;
    }
    if (!selectedUser && !formData.password) {
      toast.error('كلمة المرور مطلوبة للمستخدم الجديد'); return;
    }

    try {
      setSaving(true);
      const payload = { ...formData };
      
      // Don't send empty password on update
      if (selectedUser && !payload.password) {
        delete (payload as any).password;
      }

      if (selectedUser) {
        await api.put(`/users/${selectedUser.id}`, payload);
        toast.success('تم تحديث بيانات المستخدم');
      } else {
        await api.post('/users', payload);
        toast.success('تم إضافة المستخدم بنجاح');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ بيانات المستخدم');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: any) => {
    if (user.username === 'admin') {
      toast.error('لا يمكن تغيير حالة مدير النظام الرئيسي');
      return;
    }
    try {
      await api.patch(`/users/${user.id}/status`, { is_active: user.is_active === 1 ? false : true });
      toast.success('تم تغيير حالة المستخدم');
      fetchData();
    } catch (err) {
      toast.error('خطأ في تغيير الحالة');
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      await api.delete(`/users/${selectedUser.id}`);
      toast.success('تم حذف المستخدم بنجاح');
      setIsConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في الحذف');
    } finally {
      setSaving(false);
      setSelectedUser(null);
    }
  };

  const filteredUsers = users.filter(u => 
    !search || u.full_name.includes(search) || u.username.includes(search)
  );

  return (
    <div>
      <TopBar
        title="إدارة المستخدمين"
        subtitle="صلاحيات الدخول (المدراء والكاشير)"
        actions={
          <button onClick={() => handleOpenModal()} className="btn-primary text-sm bg-coffee-600">
            <Plus className="w-4 h-4" />
            مستخدم جديد الواجهة
          </button>
        }
      />

      <div className="page-container">
        <div className="card p-4 flex flex-wrap justify-between items-center mb-6">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم الموظف..." className="w-full md:w-80" />
        </div>

        {loading ? (
          <SkeletonTable cols={6} />
        ) : filteredUsers.length === 0 ? (
          <div className="card text-center py-16">
            <UsersIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-stone-700 font-semibold mb-1">لا يوجد مستخدمين</h3>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>اسم الدخول</th>
                  <th>الصلاحيات</th>
                  <th>الحالة</th>
                  <th>آخر دخول</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          u.role === 'admin' ? 'bg-coffee-100 text-coffee-700' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {u.full_name.charAt(0)}
                        </div>
                        <div className="font-semibold text-stone-900">{u.full_name}</div>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-stone-500 bg-stone-50 rounded px-2 py-1 inline-block mt-2">
                       {u.username}
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'bg-coffee-100 text-coffee-700 font-bold' : 'badge-gray'}`}>
                        {u.role === 'admin' ? 'المدير' : 'كاشير (POS)'}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => toggleStatus(u)}
                        className={`badge ${u.is_active ? 'badge-green' : 'badge-red'} hover:opacity-80 transition cursor-pointer flex gap-1 items-center`}
                      >
                        {u.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {u.is_active ? 'نشط' : 'موقوف'}
                      </button>
                    </td>
                    <td className="text-xs text-stone-500">
                      {u.last_login ? formatDate(u.last_login, 'datetime') : 'لم يسجل دخول'}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleOpenModal(u)} className="btn-icon text-blue-600 hover:bg-blue-50 py-1.5 px-2">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setSelectedUser(u); setIsConfirmOpen(true); }} className="btn-icon text-red-600 hover:bg-red-50 py-1.5 px-2">
                          <Trash2 className="w-3.5 h-3.5" />
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
        title={selectedUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
        size="md"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} disabled={saving} className="btn-secondary">إلغاء</button>
            <button onClick={handleSubmit} disabled={saving} className="btn-primary">
              <UsersIcon className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">الاسم الكامل *</label>
            <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="input" placeholder="اسم الموظف الحقيقي" autoFocus />
          </div>

          <div>
             <label className="label">اسم الدخول (للتسجيل النظام) *</label>
             <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="input font-mono text-left" dir="ltr" placeholder="john_doe" disabled={selectedUser?.username === 'admin'} />
          </div>

          <div>
             <label className="label">{selectedUser ? 'تغيير كلمة المرور (اترك فارغ إذا لا تريد التغيير)' : 'كلمة المرور *'}</label>
             <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="input" placeholder={selectedUser ? '••••••' : 'تعيين كلمة مرور أولية'} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="label">الدور (الصلاحية)</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="input text-sm p-3 border-stone-300" disabled={selectedUser?.username === 'admin'}>
                 <option value="cashier">كاشير فقط (POS)</option>
                 <option value="admin">مدير النظام (صلاحيات كاملة)</option>
              </select>
            </div>
            
            <div className="flex items-center pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 rounded text-coffee-600 focus:ring-coffee-500" disabled={selectedUser?.username === 'admin'} />
                <span className="font-medium text-stone-800">حسابه مفعل</span>
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
        title="تأكيد حذف المستخدم"
        message={`هل أنت متأكد من حذف الحساب "${selectedUser?.full_name}" بشكل نهائي؟ (لن يمكنك استعادة بياناته)`}
        isDestructive
        confirmText="حذف المستخدم"
      />
    </div>
  );
};

export default UsersPage;
