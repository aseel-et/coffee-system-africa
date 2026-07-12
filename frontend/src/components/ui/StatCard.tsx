import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variantStyles = {
  default: { iconColor: 'text-coffee-600', iconBg: 'bg-coffee-100', border: 'border-stone-100' },
  success: { iconColor: 'text-green-600', iconBg: 'bg-green-100', border: 'border-green-100' },
  warning: { iconColor: 'text-yellow-600', iconBg: 'bg-yellow-100', border: 'border-yellow-100' },
  danger: { iconColor: 'text-red-600', iconBg: 'bg-red-100', border: 'border-red-100' },
  info: { iconColor: 'text-blue-600', iconBg: 'bg-blue-100', border: 'border-blue-100' },
};

const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon: Icon, trend,
  variant = 'default', className = ''
}) => {
  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`stat-card ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-stone-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-stone-400 font-normal">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 ${styles.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${styles.iconColor}`} />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
