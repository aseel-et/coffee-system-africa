import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, CheckCircle, Copy, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface LicenseStatus {
  activated: boolean;
  machineId: string;
  hostname: string;
}

interface ActivationPageProps {
  onActivated: () => void;
}

const ActivationPage: React.FC<ActivationPageProps> = ({ onActivated }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    try {
      setChecking(true);
      const res = await api.get('/license/status');
      setStatus(res.data.data);
      if (res.data.data.activated) {
        onActivated();
      }
    } catch (err) {
      console.error('License check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      toast.error('يرجى إدخال مفتاح التفعيل');
      return;
    }

    try {
      setLoading(true);
      await api.post('/license/activate', { key: licenseKey.trim() });
      toast.success('تم تفعيل النظام بنجاح! 🎉');
      setTimeout(() => {
        onActivated();
      }, 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'مفتاح التفعيل غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const copyMachineId = () => {
    if (status?.machineId) {
      navigator.clipboard.writeText(status.machineId);
      toast.success('تم نسخ معرف الجهاز');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-coffee-950 via-espresso-800 to-coffee-900">
        <div className="w-10 h-10 border-4 border-coffee-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-coffee-950 via-espresso-800 to-coffee-900 p-4" dir="rtl">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-coffee-500/10 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-20 h-20 bg-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-1">تفعيل النظام</h1>
          <p className="text-coffee-300 font-medium">كافيتيريا جامعة أفريقيا</p>
        </div>

        {/* Activation Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          {/* Warning */}
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-200 text-sm font-bold">النظام غير مفعل</p>
              <p className="text-amber-300/70 text-xs mt-0.5">يرجى التواصل مع المطور للحصول على مفتاح التفعيل</p>
            </div>
          </div>

          {/* Machine ID */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-stone-300 mb-2">معرف الجهاز (Machine ID)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm select-all tracking-wider">
                {status?.machineId || '...'}
              </div>
              <button
                onClick={copyMachineId}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-colors"
                title="نسخ معرف الجهاز"
              >
                <Copy className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-stone-400 text-xs mt-2">
              أرسل هذا المعرف للمطور ليولد لك مفتاح التفعيل
            </p>
          </div>

          {/* License Key Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-stone-300 mb-2">
              <Key className="w-4 h-4 inline ml-1" />
              مفتاح التفعيل
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="AUCS-XXXX-XXXX-XXXX"
              className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-stone-500 
                focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all duration-200 text-center
                font-mono text-lg tracking-[0.2em] font-bold"
              dir="ltr"
              maxLength={19}
              autoComplete="off"
            />
          </div>

          {/* Activate Button */}
          <motion.button
            onClick={handleActivate}
            disabled={loading || !licenseKey.trim()}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3.5 rounded-xl font-semibold 
              transition-all duration-200 flex items-center justify-center gap-2 shadow-lg
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {loading ? 'جارٍ التحقق...' : 'تفعيل النظام'}
          </motion.button>

          {/* Hostname info */}
          {status?.hostname && (
            <p className="text-center text-stone-500 text-xs mt-4">
              اسم الجهاز: {status.hostname}
            </p>
          )}
        </div>

        <p className="text-center text-stone-500 text-xs mt-6">
          نظام إدارة الكافيتيريا • الإصدار 1.0.0
        </p>
      </motion.div>
    </div>
  );
};

export default ActivationPage;
