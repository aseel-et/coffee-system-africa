import React from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-stone-50 flex print:bg-white" dir="rtl">
      <div className="print:hidden">
        <Sidebar />
      </div>
      {/* Main content - offset by sidebar width */}
      <main className="flex-1 mr-[260px] print:mr-0 transition-all duration-300 min-h-screen print:min-h-0 overflow-auto print:overflow-visible">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
