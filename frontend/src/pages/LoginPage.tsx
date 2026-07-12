import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coffee, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isAdmin, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isLoading && isAuthenticated) {
    return <Navigate to={isAdmin ? '/dashboard' : '/pos'} replace />;
  }

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = 'اسم المستخدم مطلوب';
    if (!password.trim()) errs.password = 'كلمة المرور مطلوبة';
    if (password.length > 0 && password.length < 6) errs.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    await login(username.trim(), password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-coffee-950 via-espresso-800 to-coffee-900 p-4" dir="rtl">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-coffee-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-coffee-500/10 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-20 h-20 bg-coffee-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
          >
            <Coffee className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-1">كافيتيريا</h1>
          <p className="text-coffee-300 font-medium">جامعة أفريقيا</p>
          <p className="text-stone-400 text-sm mt-1">Africa University Cafeteria</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 text-center">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-2">
                اسم المستخدم
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className={`w-full px-4 py-3 rounded-xl bg-white/10 border text-white placeholder-stone-400 
                  focus:outline-none focus:ring-2 focus:ring-coffee-400 transition-all duration-200
                  ${errors.username ? 'border-red-400' : 'border-white/20'}`}
                autoComplete="username"
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1">{errors.username}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className={`w-full px-4 py-3 rounded-xl bg-white/10 border text-white placeholder-stone-400 
                    focus:outline-none focus:ring-2 focus:ring-coffee-400 transition-all duration-200 pl-12
                    ${errors.password ? 'border-red-400' : 'border-white/20'}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-coffee-600 hover:bg-coffee-500 text-white py-3.5 rounded-xl font-semibold 
                transition-all duration-200 flex items-center justify-center gap-2 shadow-lg
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {loading ? 'جارٍ التحقق...' : 'دخول'}
            </motion.button>
          </form>


        </div>

        <p className="text-center text-stone-500 text-xs mt-6">
          نظام إدارة الكافيتيريا • الإصدار 1.0.0
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
