import React, { useState, useEffect } from 'react';
import { History, Filter, AlertCircle, Trash2 } from 'lucide-react';
import api from '../services/api';
import { formatDate } from '../utils/formatters';
import TopBar from '../components/layout/TopBar';
import SearchInput from '../components/ui/SearchInput';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import toast from 'react-hot-toast';

const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/activity-logs', { params: { action: actionFilter, limit: 100 } });
      setLogs(res.data.data);
    } catch (err) {
      toast.error('حدث خطأ في جلب سجل الأنشطة');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create': return <span className="badge badge-green">إضافة</span>;
      case 'update': return <span className="badge badge-blue">تعديل</span>;
      case 'delete': return <span className="badge badge-red">حذف</span>;
      case 'login': return <span className="badge badge-coffee">دخول النظام</span>;
      case 'logout': return <span className="badge badge-gray">خروج</span>;
      case 'cancel': return <span className="badge badge-yellow">إلغاء</span>;
      default: return <span className="badge badge-gray">{action}</span>;
    }
  };

  const filteredLogs = logs.filter(log => !search || log.description?.includes(search) || log.user_name?.includes(search) || log.module?.includes(search));

  return (
    <div>
      <TopBar title="سجل الأنشطة (Audit Trail)" subtitle="مراقبة حركات النظام وإجراءات المستخدمين" />

      <div className="page-container">
        <div className="card p-4 flex flex-wrap gap-4 items-center justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث في التفاصيل أو اسم الموظف..." className="w-80" />
          
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm">
              <Filter className="w-4 h-4 text-stone-400" />
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="bg-transparent focus:outline-none text-stone-700">
                <option value="">كل العمليات</option>
                <option value="create">الإضافات (Create)</option>
                <option value="update">التعديلات (Update)</option>
                <option value="delete">عمليات الحذف (Delete)</option>
                <option value="login">تسجيل الدخول (Login)</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonTable cols={6} />
        ) : filteredLogs.length === 0 ? (
          <div className="card">
             <EmptyState title="لا توجد سجلات" description="لم يتم العثور على أي نشاط مطابق للبحث" icon={History} />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table text-sm">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>المستخدم</th>
                  <th>الإجراء</th>
                  <th>الجزء المحرر</th>
                  <th>رقم المرجع (ID)</th>
                  <th>التفاصيل ومسار العملية</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-4 text-stone-500 whitespace-nowrap">{formatDate(log.created_at, 'datetime')}</td>
                    <td className="p-4 font-semibold text-stone-800">{log.user_name || 'نظام آلي'}</td>
                    <td className="p-4">{getActionBadge(log.action_type)}</td>
                    <td className="p-4">
                      <span className="text-stone-600 font-mono text-xs bg-stone-100 px-2 py-1 rounded inline-block">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-4 font-mono-nums text-stone-500">{log.reference_id || '-'}</td>
                    <td className="p-4 text-stone-600 text-sm min-w-[300px]" title={log.description}>
                      {log.description ? (
                         <div className="line-clamp-2 max-w-md break-words">{log.description}</div>
                      ) : '-'}
                      <div className="text-stone-300 text-[10px] mt-1 font-mono" dir="ltr">{log.ip_address}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogsPage;
