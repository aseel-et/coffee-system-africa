import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Package, Tag, Warehouse,
  ShoppingBag, FileText, Users, CreditCard, Receipt, ClipboardList,
  Settings, LogOut, Coffee, ChevronLeft, Menu, X, Landmark
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'لوحة القيادة', path: '/dashboard', adminOnly: true },
  { icon: ShoppingCart, label: 'نقطة البيع', path: '/pos' },
  { icon: FileText, label: 'الفواتير والترجيع', path: '/invoices' },
  { icon: Package, label: 'المنتجات', path: '/products', adminOnly: true },
  { icon: Tag, label: 'التصنيفات', path: '/categories', adminOnly: true },
  { icon: Warehouse, label: 'المخزون', path: '/inventory', adminOnly: true },
  { icon: ShoppingBag, label: 'المشتريات', path: '/purchases', adminOnly: true },
  { icon: Receipt, label: 'المصاريف', path: '/expenses', adminOnly: true },
  { icon: Users, label: 'العملاء والديون', path: '/customers' },
  { icon: FileText, label: 'التقارير', path: '/reports', adminOnly: true },
  { icon: CreditCard, label: 'المحاسبة', path: '/accounting', adminOnly: true },
  { icon: Landmark, label: 'الحسابات والتقارير المالية', path: '/chart-of-accounts', adminOnly: true },
  { icon: ClipboardList, label: 'سجل الأنشطة', path: '/activity-logs', adminOnly: true },
  { icon: Users, label: 'المستخدمون', path: '/users', adminOnly: true },
  { icon: Settings, label: 'الإعدادات', path: '/settings', adminOnly: true },
];

const Sidebar: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <motion.aside
      initial={{ width: 260 }}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed top-0 right-0 h-full bg-white border-l border-stone-100 shadow-sidebar z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-5 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-coffee-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden flex-1"
              >
                <h1 className="font-bold text-stone-900 text-sm leading-tight whitespace-nowrap">كافي صفقة</h1>
                <p className="text-xs text-stone-400 whitespace-nowrap">Safqa Coffee</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn-icon flex-shrink-0 mr-auto"
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx('sidebar-item', isActive && 'active')}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-stone-100 p-3">
        <div className={clsx('flex items-center gap-3 rounded-xl p-2', collapsed ? 'justify-center' : '')}>
          <div className="w-8 h-8 bg-coffee-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-coffee-700 font-bold text-sm">
              {user?.full_name?.charAt(0) || 'م'}
            </span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden flex-1"
              >
                <p className="text-sm font-medium text-stone-800 whitespace-nowrap truncate">{user?.full_name}</p>
                <p className="text-xs text-stone-400 whitespace-nowrap">
                  {user?.role === 'admin' ? 'مدير النظام' : 'كاشير'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={logout}
                className="btn-icon text-red-500 hover:bg-red-50 flex-shrink-0"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {collapsed && (
          <button onClick={logout} className="w-full btn-icon text-red-500 hover:bg-red-50 mt-1 flex justify-center">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
