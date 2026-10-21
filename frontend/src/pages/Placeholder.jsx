import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Clock } from 'lucide-react';

export default function Placeholder({ title }) {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <div className="w-20 h-20 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-full flex items-center justify-center mb-6 shadow-xl shadow-[#6366f1]/10">
          <Clock className="w-10 h-10 text-[#6366f1]" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">{title || "Coming Soon"}</h1>
        <p className="text-slate-500 dark:text-[#94a3b8] max-w-md">
          This feature is currently under active development. Check back soon for updates!
        </p>
      </div>
    </DashboardLayout>
  );
}
