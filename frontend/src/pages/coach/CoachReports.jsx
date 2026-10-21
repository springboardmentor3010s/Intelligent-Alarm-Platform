import React from "react";
import DashboardLayout from "../../components/DashboardLayout";
import CombinedReportViewer from "../../components/CombinedReportViewer";
import { FileText, ShieldCheck, Download, Award, Users } from "lucide-react";

export default function CoachReports() {
  return (
    <DashboardLayout 
      title="Coach Reports & Data Export" 
      subtitle="Select any user across the platform, preview their unified 5-in-1 performance analytics, and export consolidated PDF or Excel files."
    >
      <div className="space-y-6 mt-4">
        {/* Coach Overview Banner */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Wellness Coach Performance Center
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You can select and evaluate any user's cognitive habit metrics, wake-up consistency, challenge accuracy, productivity, and sleep logs.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Authorized Coach Access</span>
          </div>
        </div>

        {/* Combined Report Viewer */}
        <CombinedReportViewer 
          role="coach" 
          title="User Unified Performance Reports"
          subtitle="Select any user to inspect their consolidated 5-section performance preview and download in PDF or Excel format."
        />
      </div>
    </DashboardLayout>
  );
}
