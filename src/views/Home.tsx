import React from 'react';
import { PlusCircle, Activity, ShieldCheck, Users, FileClock, CheckCircle, ArrowRight } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';
import { AppView, UserPersona, CaseStatus } from '../types';
import { PatientHome } from './PatientHome';

export const Home: React.FC = () => {
  const { navigate, resetCase, currentCase, currentUser } = useCaseContext();

  // If Patient Persona, render the dedicated Patient Dashboard
  if (currentUser === UserPersona.PATIENT) {
      return <PatientHome />;
  }

  const handleNewCase = () => {
    resetCase();
    navigate(AppView.MIRA);
  };

  const handleOpenCase = () => {
    navigate(AppView.NORA);
  };

  const renderInbox = () => {
    // If no case exists, show empty state
    if (!currentCase) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileClock className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No Active Cases</h3>
                <p className="text-slate-500 mb-6">Your inbox is currently empty. Start a new analysis.</p>
                <button 
                  onClick={handleNewCase}
                  className="inline-flex items-center bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <PlusCircle className="mr-2" size={18} />
                  Start New Case
                </button>
            </div>
        );
    }

    // Dr. Smith's View (Primary)
    if (currentUser === UserPersona.PRIMARY) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-800 text-lg">Recent Cases</h3>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-teal-300 transition-all cursor-pointer" onClick={handleOpenCase}>
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-teal-100 p-3 rounded-lg text-teal-700">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">Case: {currentCase.patientId}</h4>
                                <p className="text-sm text-slate-500">ID: {currentCase.id} • {currentCase.scannedAt ? new Date(currentCase.scannedAt).toLocaleDateString() : 'Just now'}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {currentCase.status === CaseStatus.DRAFT && (
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase">Draft</span>
                            )}
                            {currentCase.status === CaseStatus.PENDING_REVIEW && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full uppercase">Awaiting Review</span>
                            )}
                            {currentCase.status === CaseStatus.REVIEWED && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase">Review Complete</span>
                            )}
                            <ArrowRight className="text-slate-300" size={20} />
                        </div>
                    </div>
                    {currentCase.status === CaseStatus.REVIEWED && (
                        <div className="bg-blue-50 px-6 py-2 border-t border-blue-100 flex items-center text-sm text-blue-800">
                           <CheckCircle size={14} className="mr-2" />
                           Dr. Maryam has completed the peer review. Ready to finalize.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Dr. Maryam's View (Peer)
    if (currentUser === UserPersona.PEER) {
        // Only show if pending review
        if (currentCase.status !== CaseStatus.PENDING_REVIEW) {
            return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="text-blue-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">All Caught Up!</h3>
                    <p className="text-slate-500">Your review queue is empty.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-800 text-lg">Review Queue (1)</h3>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-l-4 border-l-blue-500 border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer" onClick={handleOpenCase}>
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-blue-100 p-3 rounded-lg text-blue-700">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">Case: {currentCase.patientId}</h4>
                                <p className="text-sm text-slate-500">Requested by Dr. Smith</p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full uppercase mr-4">Action Required</span>
                            <button className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                                Start Review
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="p-8 md:p-12 h-full flex flex-col">
      <header className="mb-8">
        <div className="flex items-end justify-between">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back, <span className={currentUser === UserPersona.PRIMARY ? 'text-teal-600' : 'text-blue-600'}>{currentUser}</span>
                </h1>
                <p className="text-lg text-slate-500">
                {currentUser === UserPersona.PRIMARY ? 'Radiology Workspace' : 'Peer Review Workspace'}
                </p>
            </div>
            {currentUser === UserPersona.PRIMARY && (
                <button 
                onClick={handleNewCase}
                className="hidden md:flex items-center bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition-colors shadow-sm"
                >
                <PlusCircle className="mr-2" size={18} />
                New Case
                </button>
            )}
        </div>
      </header>

      {/* Dynamic Inbox Area */}
      <div className="mb-12">
         {renderInbox()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 opacity-60">
          <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center mb-4">
            <Activity size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">MIRA: Vision Agent</h3>
          <p className="text-slate-500 text-sm">
            AI-assisted lesion detection.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 opacity-60">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">NORA: Orchestrator</h3>
          <p className="text-slate-500 text-sm">
            Structured reporting and peer review.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 opacity-60">
          <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center mb-4">
            <Users size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">LUMA: Patient Explainer</h3>
          <p className="text-slate-500 text-sm">
            Patient-friendly summaries.
          </p>
        </div>
      </div>

      <footer className="mt-auto text-center text-slate-400 text-sm">
        <p>Prototype only. Not for clinical use. Powered by Google Gemini API.</p>
      </footer>
    </div>
  );
};