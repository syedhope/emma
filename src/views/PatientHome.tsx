import React from 'react';
import { FileText, CheckCircle2, Clock, Activity, ChevronRight, Calendar, ArrowRight, BrainCircuit, UserCheck, FileCheck } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';
import { AppView, CaseStatus } from '../types';

export const PatientHome: React.FC = () => {
  const { currentCase, navigate, mriSlices, aiFindings } = useCaseContext();

  // Determine current stage for the stepper
  // Stages: 
  // 1. Uploaded (mriSlices > 0)
  // 2. AI Analysis (aiFindings > 0 or metadata exists)
  // 3. Doctor Review (status != DRAFT)
  // 4. Ready (status == FINALIZED)

  const hasUpload = mriSlices.length > 0 || !!currentCase;
  const hasAI = hasUpload && (aiFindings.length > 0 || !!currentCase?.aiAnalysisMetadata);
  const hasReviewStarted = hasAI && currentCase?.status !== CaseStatus.DRAFT;
  const isReady = currentCase?.status === CaseStatus.FINALIZED;

  const steps = [
    {
      id: 1,
      label: "Scan Uploaded",
      icon: FileText,
      status: hasUpload ? 'complete' : 'pending',
      date: currentCase?.scannedAt
    },
    {
      id: 2,
      label: "AI Processing",
      icon: BrainCircuit,
      status: hasAI ? 'complete' : (hasUpload ? 'active' : 'pending'),
      description: "MIRA Vision Analysis"
    },
    {
      id: 3,
      label: "Doctor Review",
      icon: UserCheck,
      status: isReady ? 'complete' : (hasReviewStarted ? 'active' : 'pending'),
      description: "Radiologist Verification"
    },
    {
      id: 4,
      label: "Results Ready",
      icon: FileCheck,
      status: isReady ? 'complete' : 'pending',
      description: "Final Report Available"
    }
  ];

  return (
    <div className="p-8 md:p-12 h-full flex flex-col max-w-5xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Hello, <span className="text-purple-600">Jane</span>
        </h1>
        <p className="text-lg text-slate-500">
          Welcome to your health dashboard. Track your MRI analysis progress below.
        </p>
      </header>

      {/* ACTIVE CASE CARD */}
      <section className="mb-12">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Active Case Tracker</h2>
        
        {!currentCase ? (
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center opacity-70">
              <Activity className="mx-auto text-slate-300 mb-4" size={32} />
              <h3 className="text-lg font-semibold text-slate-600">No Active Analysis</h3>
              <p className="text-slate-500">You don't have any scans currently being processed.</p>
           </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
               <div className="flex items-center space-x-3">
                 <div className="bg-purple-100 p-2 rounded-lg text-purple-700">
                    <Activity size={20} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-800">Pelvic MRI Analysis</h3>
                    <p className="text-xs text-slate-500 font-mono">ID: {currentCase.patientId}-{currentCase.caseSequence || '001'}</p>
                 </div>
               </div>
               {isReady && (
                 <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Action Required
                 </span>
               )}
            </div>

            <div className="p-8">
               {/* STEPPER UI */}
               <div className="relative flex items-center justify-between mb-8">
                  {/* Connecting Line */}
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-100 -z-10"></div>
                  
                  {steps.map((step, idx) => {
                      let colorClass = "bg-slate-100 text-slate-400 border-slate-200"; // Pending
                      if (step.status === 'complete') colorClass = "bg-green-500 text-white border-green-500";
                      else if (step.status === 'active') colorClass = "bg-orange-100 text-orange-600 border-orange-200 animate-pulse";
                      
                      return (
                        <div key={step.id} className="flex flex-col items-center bg-white px-2">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-3 transition-all ${colorClass}`}>
                              {step.status === 'complete' ? <CheckCircle2 size={20} /> : <step.icon size={18} />}
                           </div>
                           <span className={`text-sm font-bold ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>
                              {step.label}
                           </span>
                           {step.description && (
                              <span className="text-[10px] text-slate-400 mt-1 max-w-[100px] text-center hidden md:block">
                                  {step.description}
                              </span>
                           )}
                        </div>
                      );
                  })}
               </div>

               {/* ACTION AREA */}
               {isReady ? (
                 <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-blue-900">Your Results Are Ready</h4>
                        <p className="text-sm text-blue-700">Dr. Smith has finalized your radiology report. AI translation is available.</p>
                    </div>
                    <button 
                      onClick={() => navigate(AppView.LUMA)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-all flex items-center hover:scale-105"
                    >
                        View Summary <ArrowRight size={18} className="ml-2" />
                    </button>
                 </div>
               ) : (
                 <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-500 flex items-center justify-center">
                        <Clock size={16} className="mr-2" />
                        Estimated completion: <span className="font-semibold ml-1">24-48 hours</span>
                    </p>
                 </div>
               )}
            </div>
          </div>
        )}
      </section>

      {/* HISTORY LIST */}
      <section>
         <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Previous Scans</h2>
         <div className="space-y-3">
            {/* Mock History Item 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
               <div className="flex items-center space-x-4">
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                     <FileText size={20} />
                  </div>
                  <div>
                     <h4 className="font-bold text-slate-700">Pelvic MRI Follow-up</h4>
                     <p className="text-xs text-slate-500 font-mono">ID: ANON-2024-4288-0002</p>
                  </div>
               </div>
               <div className="flex items-center text-slate-500 text-sm space-x-6">
                  <div className="flex items-center">
                     <Calendar size={14} className="mr-2" />
                     Nov 12, 2024
                  </div>
                  <div className="flex items-center text-green-600 font-medium">
                     <CheckCircle2 size={14} className="mr-1" />
                     Completed
                  </div>
                  <ChevronRight size={16} />
               </div>
            </div>

            {/* Mock History Item 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
               <div className="flex items-center space-x-4">
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                     <FileText size={20} />
                  </div>
                  <div>
                     <h4 className="font-bold text-slate-700">Initial Diagnostic Scan</h4>
                     <p className="text-xs text-slate-500 font-mono">ID: ANON-2023-4288-0001</p>
                  </div>
               </div>
               <div className="flex items-center text-slate-500 text-sm space-x-6">
                  <div className="flex items-center">
                     <Calendar size={14} className="mr-2" />
                     June 05, 2023
                  </div>
                  <div className="flex items-center text-green-600 font-medium">
                     <CheckCircle2 size={14} className="mr-1" />
                     Completed
                  </div>
                  <ChevronRight size={16} />
               </div>
            </div>
         </div>
      </section>
    </div>
  );
};