import React from 'react';
import { Bell, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/formatters';

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const TopBar: React.FC<TopBarProps> = ({ title, subtitle, actions }) => {
  const { user } = useAuth();
  const now = new Date();

  return (
    <header className="h-16 bg-white border-b border-stone-100 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
      </div>

      {/* Right: Actions + Info */}
      <div className="flex items-center gap-3">
        {actions}
        <div className="text-xs text-stone-400 text-left hidden sm:block">
          <div className="font-medium text-stone-600">{user?.full_name}</div>
          <div>{formatDate(now, 'datetime')}</div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
