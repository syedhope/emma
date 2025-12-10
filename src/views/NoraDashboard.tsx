
import React, { useState, useEffect } from 'react';
import { FileText, Save, Share2, AlertTriangle, Check, BrainCircuit, Plus, MessageSquare, Send, ArrowLeft, X, UserPlus, HelpCircle, Eye, Info, CheckCircle2, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';
import { AppView, DashboardMode, FindingLikelihood, AIFinding, UserPersona, CaseStatus } from '../types';
import { LumaExplainer } from './LumaExplainer';

export const NoraDashboard: React.FC = () => {
  const { 
      currentCase, 
      updateReport, 
      navigate, 
      aiFindings, 
      finalReport, 
      currentUser, 
      updateCaseStatus,
      updateCase,
      mriSlices
  } = useCaseContext();

  // Initialize report from global state or default template.
  const [localReport, setLocalReport] = useState<string>(() => {
     if (finalReport) return finalReport;
     // Anonymized Template
     const historyDisplay = (currentCase?.clinicalHistory === 'NA' || !currentCase?.clinicalHistory)
        ? 'Clinical History not provided'
        : currentCase.clinicalHistory;

     // Format Case Sequence
     const caseSeq = currentCase?.caseSequence || '001';
     const caseId = currentCase?.patientId ? `${currentCase.patientId}-${caseSeq}` : 'UNKNOWN';

     return `EXAM: MRI PELVIS FOR ENDOMETRIOSIS
CASE ID: ${caseId}
REF: ${currentCase?.patientId || 'UNKNOWN'}
CLINICAL INDICATION: ${historyDisplay}

FINDINGS:
`;
  });

  const [secondOpinion, setSecondOpinion] = useState<string>(currentCase?.secondOpinionNotes || "");
  const [acceptedFindings, setAcceptedFindings] = useState<Set<string>>(new Set());
  
  // Viewer State
  const [activeSliceIndex, setActiveSliceIndex] = useState(0);

  // Modal State
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState("Dr. Maryam (Endometriosis Specialist)");
  const [consultNote, setConsultNote] = useState("");

  // Determine if we are in Peer Review Mode based on User and Case Status
  const isPeerMode = currentUser === UserPersona.PEER && currentCase?.status === CaseStatus.PENDING_REVIEW;
  const isReviewComplete = currentCase?.status === CaseStatus.REVIEWED || currentCase?.status === CaseStatus.FINALIZED;

  // Reset slice index if slices change/reset
  useEffect(() => {
    if (mriSlices.length > 0 && activeSliceIndex >= mriSlices.length) {
        setActiveSliceIndex(0);
    }
  }, [mriSlices, activeSliceIndex]);

  const handleAcceptFinding = (finding: AIFinding) => {
    if (isPeerMode) return; 
    
    // Jump to the best slice for this finding
    if (finding.bestSliceId && mriSlices.length > 0) {
        const sliceIdx = mriSlices.findIndex(s => s.id === finding.bestSliceId);
        if (sliceIdx !== -1) setActiveSliceIndex(sliceIdx);
    }

    const findingText = `- ${finding.region}: ${finding.description} (${finding.likelihood} confidence)`;
    setLocalReport((prev) => prev + findingText + "\n");
    setAcceptedFindings(prev => new Set(prev).add(finding.id));
  };

  // Allow clicking a finding to view it without accepting
  const handleViewFinding = (finding: AIFinding) => {
    if (finding.bestSliceId && mriSlices.length > 0) {
        const sliceIdx = mriSlices.findIndex(s => s.id === finding.bestSliceId);
        if (sliceIdx !== -1) setActiveSliceIndex(sliceIdx);
    }
  };

  const handleSaveDraft = () => {
    updateReport(localReport);
    if (currentCase) {
        updateCase({
            ...currentCase,
            secondOpinionNotes: secondOpinion
        });
    }
    alert("Draft saved.");
  };

  // Open Modal logic
  const handleOpenConsultModal = () => {
    setIsConsultModalOpen(true);
  };

  // Open Preview Logic
  const handlePreviewPatientView = () => {
    updateReport(localReport); // Sync so preview is accurate
    setIsPreviewModalOpen(true);
  };

  // Confirm and Send logic
  const handleConfirmConsult = () => {
    updateReport(localReport);
    if (currentCase) {
        updateCase({
            ...currentCase,
            status: CaseStatus.PENDING_REVIEW,
            peerRequestNote: consultNote,
            assignedPeer: selectedPeer
        });
    }
    setIsConsultModalOpen(false);
    navigate(AppView.HOME);
    alert(`Consultation requested sent to ${selectedPeer}.`);
  };

  // Peer Reviewer Action: Submit Review back to Dr. Smith
  const handleSubmitReview = () => {
    if (!secondOpinion.trim()) {
        alert("Please enter second opinion notes before submitting.");
        return;
    }
    updateReport(localReport); 
    if (currentCase) {
        updateCase({
            ...currentCase,
            secondOpinionNotes: secondOpinion,
            status: CaseStatus.REVIEWED
        });
    }
    navigate(AppView.HOME);
    alert("Review submitted. Case returned to Primary Radiologist.");
  };

  // Finalize Action
  const handleFinalizeAndExplain = () => {
    updateReport(localReport);
    updateCaseStatus(CaseStatus.FINALIZED);
    setIsPreviewModalOpen(false);
    alert("Report approved and released to patient.");
    navigate(AppView.HOME); 
  };

  if (!currentCase) {
      return <div className="p-10 text-center text-slate-500">No active case. Please start from Home.</div>;
  }

  // Helper to render the MIRA findings box content
  const renderFindingsContent = () => {
    // 1. MIRA was run, but no findings (Clean Scan)
    if (currentCase.aiAnalysisMetadata && aiFindings.length === 0) {
        return (
            <div className="bg-green-50 rounded-lg p-4 border border-green-100 flex items-start">
                <CheckCircle2 className="text-green-600 mr-3 flex-shrink-0" size={18} />
                <div>
                    <h5 className="font-bold text-green-800 text-sm">MIRA Analysis: Clean Scan</h5>
                    <p className="text-xs text-green-700 mt-1">Automated analysis did not detect specific abnormalities. Proceeding with manual analysis.</p>
                </div>
            </div>
        );
    }

    // 2. MIRA was NOT run (or legacy case without metadata), and no findings
    if (!currentCase.aiAnalysisMetadata && aiFindings.length === 0) {
        return (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-start">
                <Info className="text-slate-400 mr-3 flex-shrink-0" size={18} />
                <div>
                    <h5 className="font-bold text-slate-600 text-sm">Manual Review Mode</h5>
                    <p className="text-xs text-slate-500 mt-1">No AI analysis data available. Please perform a standard visual review.</p>
                </div>
            </div>
        );
    }

    // 3. Findings available
    return (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {aiFindings.map((finding) => (
                <div key={finding.id} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm text-sm group hover:border-teal-300 transition-all cursor-pointer" onClick={() => handleViewFinding(finding)}>
                    <div className="flex items-start">
                        {finding.likelihood === FindingLikelihood.HIGH ? (
                        <AlertTriangle size={14} className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                        ) : (
                        <Check size={14} className="text-teal-500 mt-0.5 mr-2 flex-shrink-0" />
                        )}
                        <div>
                        <span className="font-semibold text-slate-700">{finding.region}:</span> <span className="text-slate-600">{finding.description}</span>
                        </div>
                    </div>
                    
                    {!isPeerMode && (
                        <button 
                        onClick={(e) => { e.stopPropagation(); handleAcceptFinding(finding); }}
                        disabled={acceptedFindings.has(finding.id)}
                        className={`ml-3 flex items-center text-xs font-bold px-2 py-1 rounded border transition-colors ${
                            acceptedFindings.has(finding.id) 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                            : 'bg-white text-teal-600 border-teal-200 hover:bg-teal-50 hover:border-teal-300'
                        }`}
                        >
                        {acceptedFindings.has(finding.id) ? (
                            <>Added</>
                        ) : (
                            <><Plus size={12} className="mr-1" /> Accept</>
                        )}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header Toolbar */}
      <div className={`bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 ${isPeerMode ? 'border-b-blue-500' : ''}`}>
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <button onClick={() => navigate(AppView.HOME)} className="mr-3 text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <FileText className={`mr-2 ${isPeerMode ? 'text-blue-600' : 'text-teal-600'}`} size={24} />
            {isPeerMode ? 'Peer Review Mode' : 'Radiologist Dashboard'}
            <span className="font-normal text-slate-400 mx-2">|</span>
            <span className="font-normal text-slate-600 text-sm">Exam: {currentCase.patientId}-{currentCase.caseSequence || '001'}</span>
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleSaveDraft}
            className="flex items-center text-slate-600 hover:text-teal-600 px-3 py-2 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
          >
            <Save size={18} className="mr-2" />
            Save
          </button>
          
          {/* Workflow Buttons based on Persona & Status */}
          {currentUser === UserPersona.PRIMARY && currentCase.status !== CaseStatus.FINALIZED && (
              <>
                <button 
                    onClick={handleOpenConsultModal}
                    className="flex items-center bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                >
                    <Share2 size={18} className="mr-2" />
                    Submit for Peer Review
                </button>
                <button 
                    onClick={handlePreviewPatientView}
                    className="flex items-center bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-colors"
                >
                    <Eye size={18} className="mr-2" />
                    Preview Patient Summary
                </button>
              </>
          )}

          {currentUser === UserPersona.PEER && isPeerMode && (
              <button 
                onClick={handleSubmitReview}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-colors"
              >
                <Send size={18} className="mr-2" />
                Submit Review
              </button>
          )}

           {/* Read Only / Historical View State */}
           {currentUser === UserPersona.PEER && !isPeerMode && (
               <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded">Read Only</span>
           )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Image Viewer */}
        <div className="w-1/2 bg-black flex flex-col items-center justify-center relative border-r border-slate-800 group">
            <div className="absolute top-4 left-4 flex space-x-2 z-10">
                <span className="bg-black/50 text-white text-xs px-2 py-1 rounded border border-white/20">
                    Series: T2_SAG
                </span>
                <span className="bg-black/50 text-white text-xs px-2 py-1 rounded border border-white/20">
                    Slice: {mriSlices.length > 0 ? activeSliceIndex + 1 : 0}/{mriSlices.length}
                </span>
            </div>

            {/* AI Context Overlay */}
            {currentCase.aiAnalysisMetadata && (
                <div className="absolute top-4 right-4 z-10">
                     <span className="bg-teal-900/80 text-teal-100 text-[10px] px-2 py-1 rounded border border-teal-700/50 backdrop-blur-sm">
                         AI Context: {currentCase.aiAnalysisMetadata.imageDescription}
                     </span>
                </div>
            )}
            
            {/* Main Image Display */}
            {mriSlices.length > 0 && mriSlices[activeSliceIndex] ? (
                <img 
                    key={activeSliceIndex}
                    src={mriSlices[activeSliceIndex].url} 
                    alt={`MRI Slice ${activeSliceIndex + 1}`} 
                    className="max-h-full max-w-full object-contain opacity-90 transition-opacity duration-200"
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-500">
                     <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                        <ImageOff size={32} className="opacity-50" />
                    </div>
                    <p className="font-medium text-lg">No MRI Series Loaded</p>
                    <p className="text-sm opacity-60 mt-1 max-w-[200px] text-center">Upload patient scans in MIRA to enable the viewer.</p>
                </div>
            )}

            {/* Slice Navigation Controls */}
            {mriSlices.length > 1 && (
                <div className="absolute bottom-6 flex items-center space-x-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => setActiveSliceIndex(prev => Math.max(0, prev - 1))}
                        disabled={activeSliceIndex === 0}
                        className="text-white hover:text-teal-400 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <span className="text-xs font-mono text-white/80 w-12 text-center">
                        {activeSliceIndex + 1} / {mriSlices.length}
                    </span>
                    <button 
                        onClick={() => setActiveSliceIndex(prev => Math.min(mriSlices.length - 1, prev + 1))}
                        disabled={activeSliceIndex === mriSlices.length - 1}
                        className="text-white hover:text-teal-400 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            )}
        </div>

        {/* Right: Report Editor & Findings */}
        <div className={`w-1/2 flex flex-col h-full overflow-y-auto transition-colors duration-300 ${isPeerMode ? 'bg-blue-50/30 border-l-4 border-blue-500' : 'bg-slate-50'}`}>
           
           {/* Consultation Request Alert (Visible to Peer) */}
           {isPeerMode && currentCase.peerRequestNote && (
               <div className="mx-4 mt-4 p-4 bg-blue-100 border border-blue-200 rounded-lg text-blue-900 shadow-sm animate-fadeIn flex-shrink-0">
                   <div className="flex items-start">
                       <HelpCircle size={20} className="mr-3 flex-shrink-0 mt-0.5 text-blue-700" />
                       <div>
                           <h4 className="font-bold text-sm mb-1">Consultation Request</h4>
                           <p className="text-sm text-blue-800">{currentCase.peerRequestNote}</p>
                           <p className="text-xs text-blue-600 mt-2 font-medium">Requested by Dr. Smith</p>
                       </div>
                   </div>
               </div>
           )}

           {/* AI Findings Summary Box */}
           <div className={`mx-4 mt-4 p-4 rounded-xl border flex-shrink-0 transition-colors duration-300 ${isPeerMode ? 'bg-orange-50 border-orange-200' : 'bg-purple-50 border-purple-100'}`}>
             <div className={`flex items-center font-medium mb-3 ${isPeerMode ? 'text-orange-800' : 'text-purple-800'}`}>
                <BrainCircuit size={18} className="mr-2" />
                {isPeerMode ? 'MIRA Findings (Peer Review View)' : 'MIRA Findings (Auto-Detected)'}
             </div>
             
             {renderFindingsContent()}

           </div>

           {/* Editor Section */}
           <div className="p-6 flex flex-col gap-6">
             <div className="flex flex-col">
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide">Structured Radiology Report</label>
                    {isPeerMode && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Peer Review Active</span>}
                </div>
                
                <textarea 
                    className={`w-full p-6 bg-white border rounded-lg shadow-sm focus:ring-2 outline-none font-mono text-sm leading-relaxed text-slate-800 resize-y transition-all min-h-[400px] ${
                        isPeerMode 
                        ? 'border-blue-200 focus:ring-blue-500' 
                        : 'border-slate-200 focus:ring-teal-500'
                    }`}
                    value={localReport}
                    onChange={(e) => setLocalReport(e.target.value)}
                    placeholder="Start typing or accept findings above..."
                    disabled={isPeerMode} 
                />
             </div>

             {/* Second Opinion Box - Visible to Peer during review, or to Primary after review */}
             {(isPeerMode || isReviewComplete) && (
                 <div className="flex flex-col animate-fadeIn">
                    <label className="block text-sm font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center">
                        <MessageSquare size={16} className="mr-2" />
                        {isReviewComplete ? 'Peer Review Notes (Dr. Maryam)' : 'Second Opinion Notes'}
                    </label>
                    <textarea 
                        className={`w-full p-4 bg-blue-50 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 resize-y placeholder-blue-300 min-h-[200px] ${!isPeerMode ? 'opacity-80' : ''}`}
                        value={secondOpinion}
                        onChange={(e) => setSecondOpinion(e.target.value)}
                        placeholder="Enter peer review comments, discrepancies, or additional recommendations here..."
                        disabled={!isPeerMode}
                    />
                 </div>
             )}
             
             {/* Bottom Spacer to ensure content isn't cut off */}
             <div className="h-8"></div>
           </div>
        </div>
      </div>

      {/* Consultation Request Modal */}
      {isConsultModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800 flex items-center">
                          <UserPlus className="mr-2 text-teal-600" size={20} />
                          Request Consultation
                      </h3>
                      <button onClick={() => setIsConsultModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Select Specialist</label>
                          <select 
                            value={selectedPeer}
                            onChange={(e) => setSelectedPeer(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-white"
                          >
                              <option>Dr. Maryam (Endometriosis Specialist)</option>
                              <option>Dr. Al-Fayed (Oncology Lead)</option>
                              <option>Dr. Patel (General Radiology)</option>
                          </select>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Consult / Notes</label>
                          <textarea 
                            value={consultNote}
                            onChange={(e) => setConsultNote(e.target.value)}
                            placeholder="e.g., Ambiguous signal in the Pouch of Douglas. Please verify adhesion vs. lesion."
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm resize-none"
                          />
                      </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
                      <button 
                        onClick={() => setIsConsultModalOpen(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleConfirmConsult}
                        className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center"
                      >
                          <Send size={16} className="mr-2" />
                          Send Request
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Patient Preview Modal */}
      {isPreviewModalOpen && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full h-[90vh] max-w-5xl overflow-hidden flex flex-col">
               <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center space-x-3">
                     <Eye size={20} className="text-teal-400" />
                     <h3 className="font-bold text-lg">Patient View Preview (Verification Mode)</h3>
                  </div>
                  <button onClick={() => setIsPreviewModalOpen(false)} className="text-slate-400 hover:text-white">
                     <X size={24} />
                  </button>
               </div>
               
               <div className="flex-1 overflow-hidden bg-slate-50">
                  {/* Reuse LUMA Component in Preview Mode */}
                  <LumaExplainer isPreview={true} />
               </div>

               <div className="bg-white border-t border-slate-200 p-4 flex justify-end space-x-4 flex-shrink-0">
                  <button 
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                  >
                    Back to Edit
                  </button>
                  <button 
                    onClick={handleFinalizeAndExplain}
                    className="px-5 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg font-medium shadow-sm flex items-center"
                  >
                    <Check size={18} className="mr-2" />
                    Approve & Release to Patient
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
