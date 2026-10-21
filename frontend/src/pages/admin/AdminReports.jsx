import React from "react";
import DashboardLayout from "../../components/DashboardLayout";
import CombinedReportViewer from "../../components/CombinedReportViewer";
import { FileText, Shield, Download, Users, BrainCircuit } from "lucide-react";

export default function AdminReports() {
  return (
    <DashboardLayout 
      title="Admin Reports & Data Export" 
      subtitle="Select any user or coach across the platform, preview their consolidated 5-section performance analytics, and export complete PDF or Excel files."
    >
      <div className="space-y-6 mt-4">
        {/* Admin Overview Banner */}
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Platform-Wide Performance & Audit Center
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You have administrative access to generate, preview, and download verified 5-in-1 reports for both regular users and wellness coaches.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Users & Coaches Access</span>
          </div>
        </div>

        {/* Combined Report Viewer */}
        <CombinedReportViewer 
          role="admin" 
          title="User & Coach Combined Performance Reports"
          subtitle="Filter by role (Users or Coaches) and choose any account to preview their 5-section report before downloading in PDF or Excel."
        />
      </div>
    </DashboardLayout>
  );
}
