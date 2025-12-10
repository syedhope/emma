import React, { useState, useEffect } from 'react';
import { UploadCloud, ScanEye, CheckCircle2, AlertCircle, X, BrainCircuit, ArrowRight, ShieldAlert, Shield, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';
import { AppView, CaseData, FindingLikelihood, AIFinding, CaseStatus, AIAnalysisMetadata, MriSlice } from '../types';
import { GoogleGenAI } from "@google/genai";

export const MiraUpload: React.FC = () => {
  const { navigate, updateCase, setSlices, mriSlices, setFindings, aiFindings, currentCase, apiKey } = useCaseContext();
  
  // Local Form State
  const [patientIdInput, setPatientIdInput] = useState(currentCase?.patientId || '');
  const [clinicalHistory, setClinicalHistory] = useState(currentCase?.clinicalHistory || '');
  
  // UI State
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Highlight state for visual feedback
  const [highlightedSliceId, setHighlightedSliceId] = useState<string | null>(null);
  
  // New State for validation feedback
  const [analysisMeta, setAnalysisMeta] = useState<AIAnalysisMetadata | null>(currentCase?.aiAnalysisMetadata || null);

  // Sync local state if global state changes (e.g. reloading from local storage)
  useEffect(() => {
    if (currentCase) {
      setPatientIdInput(currentCase.patientId);
      setClinicalHistory(currentCase.clinicalHistory || '');
      if (currentCase.aiAnalysisMetadata) {
        setAnalysisMeta(currentCase.aiAnalysisMetadata);
        setAnalysisComplete(true);
      } else if (aiFindings.length > 0) {
        // Fallback for legacy state
        setAnalysisComplete(true);
      }
    }
  }, [currentCase, aiFindings]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFiles = (files: FileList | null) => {
    setError(null);
    if (!files) return;
    
    // Auto-generate sequence numbers for description
    const startIdx = mriSlices.length + 1;
    const newSlices = Array.from(files).map((file, index) => ({
      id: `slice-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      description: `Slice ${startIdx + index}`,
      file: file
    }));

    setSlices([...mriSlices, ...newSlices]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const removeSlice = (id: string) => {
    setSlices(mriSlices.filter(s => s.id !== id));
    setError(null);
    // Reset analysis if image changes
    setAnalysisComplete(false);
    setAnalysisMeta(null);
    setFindings([]);
  };

  const handleReset = () => {
    // 1. Clear MIRA-specific state (Images & Findings)
    setSlices([]);
    setFindings([]);
    setAnalysisMeta(null);
    setAnalysisComplete(false);
    setError(null);
    setIsProcessing(false);
    setProcessingProgress(0);
    setHighlightedSliceId(null);

    // 2. Persist reset to Global State (Preserving Patient Data)
    if (currentCase) {
        const updated = { 
            ...currentCase, 
            aiAnalysisMetadata: undefined // Clear the analysis metadata
        };
        // We intentionally do NOT clear patientId, notes, or clinicalHistory
        updateCase(updated);
    }
  };

  const generateSecureId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    setPatientIdInput(`ANON-${year}-${random}`);
    setError(null);
  };

  // Helper: Convert File to Base64 for Gemini API
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove the Data URL prefix (e.g. "data:image/jpeg;base64,")
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // --- DEDUPLICATION LOGIC ---
  interface RawFinding {
    title: string;
    description: string;
    confidence: FindingLikelihood;
    location: string;
    sliceId: string;
  }

  const deduplicateFindings = (rawFindings: RawFinding[]): AIFinding[] => {
    const grouped: Record<string, { 
      bestConfidence: FindingLikelihood; 
      descriptions: Set<string>; 
      sliceIds: Set<string>;
      bestSliceId: string;
      region: string;
      title: string;
    }> = {};

    const confidenceScore = { [FindingLikelihood.HIGH]: 3, [FindingLikelihood.MEDIUM]: 2, [FindingLikelihood.LOW]: 1 };

    rawFindings.forEach(f => {
      // Create a unique key based on Region + Title (normalized)
      const key = `${f.location.toLowerCase()}-${f.title.toLowerCase()}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          bestConfidence: f.confidence,
          descriptions: new Set([f.description]),
          sliceIds: new Set([f.sliceId]),
          bestSliceId: f.sliceId,
          region: f.location,
          title: f.title
        };
      } else {
        const entry = grouped[key];
        
        // Update Best Slice/Confidence
        if (confidenceScore[f.confidence] > confidenceScore[entry.bestConfidence]) {
           entry.bestConfidence = f.confidence;
           entry.bestSliceId = f.sliceId;
        }
        
        // Collect Metadata
        entry.sliceIds.add(f.sliceId);
        entry.descriptions.add(f.description);
      }
    });

    // Convert Groups to AIFindings
    return Object.values(grouped).map((entry, index) => {
       // Format Description
       const uniqueSlices = Array.from(entry.sliceIds);
       const sliceCount = uniqueSlices.length;
       const distinctDesc = Array.from(entry.descriptions)[0]; // Use the first (often most relevant) or merge
       
       let finalDesc = `${entry.title}: ${distinctDesc}`;
       
       // Append slice context
       if (sliceCount > 1) {
         // Find indices of slices for user friendly display (e.g. "Slices 1-3")
         // This assumes mriSlices order hasn't changed.
         const indices = uniqueSlices
            .map(id => mriSlices.findIndex(s => s.id === id) + 1)
            .filter(i => i > 0)
            .sort((a,b) => a - b);
         
         if (indices.length > 0) {
             const rangeStr = indices.length > 2 
                ? `${indices[0]}-${indices[indices.length - 1]}` 
                : indices.join(', ');
             finalDesc += ` (Observed in slices: ${rangeStr})`;
         }
       }

       return {
         id: `finding-${Date.now()}-${index}`,
         region: entry.region,
         likelihood: entry.bestConfidence,
         description: finalDesc,
         coordinates: { x: 0, y: 0 },
         status: 'pending',
         sourceSlices: uniqueSlices,
         bestSliceId: entry.bestSliceId
       };
    });
  };

  const analyzeWithMIRA = async () => {
    setError(null);
    setAnalysisMeta(null);

    // 0. Configuration Check
    if (!apiKey) {
      setError("Configuration Missing: Please add your Gemini API Key in the Settings menu to enable AI analysis.");
      return;
    }

    // 1. Input Validation
    if (!patientIdInput.trim()) {
      setError("Please generate a Patient ID to proceed.");
      return;
    }
    
    let finalClinicalHistory = clinicalHistory.trim();
    if (!finalClinicalHistory) {
        finalClinicalHistory = "NA";
        setClinicalHistory("NA");
    }

    if (mriSlices.length === 0) {
      setError("Please upload at least one MRI slice.");
      return;
    }

    // Save Clinical Context
    const updatedCase: CaseData = {
      id: patientIdInput,
      patientId: patientIdInput,
      caseSequence: '001',
      age: 30,
      notes: finalClinicalHistory, 
      clinicalHistory: finalClinicalHistory,
      scannedAt: new Date().toISOString(),
      status: currentCase?.status || CaseStatus.DRAFT
    };
    updateCase(updatedCase);

    setIsProcessing(true);
    setProcessingProgress(5);

    try {
      // 2. Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const concurrencyLimit = 3;
      const allRawFindings: RawFinding[] = [];
      let validMriCount = 0;
      let processedCount = 0;
      let lastImageDescription = "Unknown";

      // Helper for Single Slice Analysis
      const analyzeSlice = async (slice: MriSlice) => {
         if (!slice.file) return null;
         const base64Image = await fileToBase64(slice.file);
         
         const prompt = `
            You are an expert radiologist specializing in Endometriosis. 
            Analyze this image (Sequence: ${slice.description}) and the following clinical context: "${finalClinicalHistory === 'NA' ? 'No history provided' : finalClinicalHistory}".
            
            Step 1: Verify if this is a Pelvic MRI scan.
            Step 2: If it IS a Pelvic MRI, identify any potential abnormalities (e.g., Endometriomas, Adhesions, Thickening, or Deep Infiltrating Endometriosis).
            Step 3: If it is NOT a Pelvic MRI, provide a description of what it is.
            
            CRITICAL: Return your response as valid JSON only.
            Schema:
            {
              "is_pelvic_mri": boolean,
              "image_description": "Short description of the image content",
              "findings": [
                {
                  "title": "Short medical term (e.g., Ovarian Cyst)",
                  "confidence": "High" | "Medium" | "Low",
                  "description": "One sentence clinical observation.",
                  "location": "Anatomical region (e.g., Left Ovary)"
                }
              ]
            }
         `;

         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
              parts: [
                { inlineData: { mimeType: slice.file.type, data: base64Image } },
                { text: prompt }
              ]
            },
            config: { responseMimeType: 'application/json' }
         });

         const cleanJson = response.text ? response.text.replace(/```json/g, '').replace(/```/g, '').trim() : "{}";
         const result = JSON.parse(cleanJson);
         return { sliceId: slice.id, result };
      };

      // 3. Batch Processing Loop
      for (let i = 0; i < mriSlices.length; i += concurrencyLimit) {
          const chunk = mriSlices.slice(i, i + concurrencyLimit);
          const results = await Promise.all(chunk.map(analyzeSlice));

          results.forEach(res => {
              if (res && res.result) {
                  const { result, sliceId } = res;
                  lastImageDescription = result.image_description;
                  
                  if (result.is_pelvic_mri) {
                      validMriCount++;
                      if (result.findings) {
                          result.findings.forEach((f: any) => {
                              allRawFindings.push({
                                  title: f.title,
                                  description: f.description,
                                  confidence: f.confidence,
                                  location: f.location,
                                  sliceId: sliceId
                              });
                          });
                      }
                  }
              }
          });
          
          processedCount += chunk.length;
          setProcessingProgress(10 + Math.round((processedCount / mriSlices.length) * 80));
      }

      // 4. Final Aggregation & Deduplication
      const isGenerallyValid = validMriCount > 0; // At least one valid slice
      
      const meta: AIAnalysisMetadata = {
        isPelvicMri: isGenerallyValid,
        imageDescription: isGenerallyValid ? `Multi-slice MRI Series (${mriSlices.length} images)` : lastImageDescription,
        timestamp: new Date().toISOString()
      };
      
      setAnalysisMeta(meta);
      updateCase({ ...updatedCase, aiAnalysisMetadata: meta });

      if (!isGenerallyValid) {
        setFindings([]);
        setAnalysisComplete(true);
        setIsProcessing(false);
        return;
      }

      const deduplicatedFindings = deduplicateFindings(allRawFindings);
      setFindings(deduplicatedFindings);
      setAnalysisComplete(true);
      setProcessingProgress(100);

    } catch (err: any) {
      console.error("MIRA Analysis Failed:", err);
      setError(`Analysis Failed: ${err.message || "Unknown error occurred."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getLikelihoodBadge = (likelihood: FindingLikelihood) => {
    const l = likelihood.toString().toLowerCase();
    if (l === 'high') {
        return <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-full uppercase">High Confidence</span>;
    } else if (l === 'medium') {
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full uppercase">Medium Confidence</span>;
    } else {
        return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full uppercase">Low Confidence</span>;
    }
  };

  const renderAnalysisResult = () => {
    if (!analysisComplete || !analysisMeta) return null;

    if (!analysisMeta.isPelvicMri) {
        return (
            <div className="space-y-6 animate-fadeIn">
                 <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex flex-col items-center text-center text-yellow-800">
                    <AlertTriangle className="mb-3 text-yellow-600" size={32} />
                    <h4 className="font-bold text-lg mb-1">MIRA Alert: Non-MRI Detected</h4>
                    <p className="text-sm text-yellow-700 mb-2">
                      The uploaded files do not appear to be standard pelvic MRI sequences.
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide bg-yellow-100 px-2 py-1 rounded">
                      Please upload valid Pelvic MRI slices to proceed
                    </p>
                 </div>
            </div>
        );
    }

    if (aiFindings.length === 0) {
        return (
            <div className="space-y-6 animate-fadeIn">
                 <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex flex-col items-center text-center text-green-800">
                    <CheckCircle2 className="mb-3 text-green-600" size={32} />
                    <h4 className="font-bold text-lg mb-1">Analysis Complete: Clear Scan</h4>
                    <p className="text-sm text-green-700 mb-2">
                        Scanned {mriSlices.length} slices. No specific abnormalities detected.
                    </p>
                 </div>
                 <div className="flex items-start p-4 bg-slate-100 rounded-xl border border-slate-200">
                    <BrainCircuit size={18} className="text-slate-400 mr-3 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500 leading-relaxed">
                      You can still proceed to the Radiologist Dashboard for a full manual review.
                    </p>
                 </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Success Banner */}
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-center text-teal-800">
            <CheckCircle2 className="mr-3" size={24} />
            <div>
                <h4 className="font-bold">Analysis Complete</h4>
                <p className="text-sm text-teal-700">Scanned {mriSlices.length} slices • Found {aiFindings.length} distinct abnormalities.</p>
            </div>
            </div>

            {/* Findings List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center">
                    <BrainCircuit className="text-purple-600 mr-2" size={18} />
                    AI Findings Report
                </h3>
                <span className="text-xs font-mono text-slate-400">GEMINI-2.5-FLASH</span>
            </div>
            
            <div className="divide-y divide-slate-100">
                {aiFindings.map((finding) => (
                <div 
                    key={finding.id} 
                    className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => setHighlightedSliceId(finding.bestSliceId || null)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-lg font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">{finding.description}</h4>
                        {getLikelihoodBadge(finding.likelihood)}
                    </div>
                    <p className="text-sm text-slate-500 mb-3">Region: <span className="font-medium text-slate-700">{finding.region}</span></p>
                    <p className="text-xs text-slate-400 flex items-center">
                       <Layers size={12} className="mr-1" />
                       Click to visualize on Best Slice
                    </p>
                </div>
                ))}
            </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start p-4 bg-slate-100 rounded-xl border border-slate-200">
            <AlertCircle size={18} className="text-slate-400 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
                <strong>Note:</strong> MIRA uses Gemini to suggest regions and findings for radiologist review. 
                This is an assistive tool and not a final diagnosis. Please verify all findings in the NORA Dashboard.
            </p>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-100 p-2 rounded-lg text-teal-700">
            <ScanEye size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">MIRA: Vision Agent</h2>
            <p className="text-sm text-slate-500">Multi-Slice Analysis for Endometriosis Detection</p>
          </div>
        </div>
        
        {analysisComplete && analysisMeta?.isPelvicMri && (
          <button 
            onClick={() => navigate(AppView.NORA)}
            className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm animate-fadeIn"
          >
            <span>Proceed to NORA Dashboard</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Input & Upload */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Patient Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center justify-between">
                <span className="flex items-center">
                    <span className="w-1.5 h-4 bg-teal-500 rounded-full mr-2"></span>
                    Patient Context
                </span>
                <span className="flex items-center text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-100">
                    <Shield size={10} className="mr-1" />
                    Privacy Mode Active
                </span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                      <Shield size={14} className="mr-1 text-slate-400" />
                      Patient ID (Anonymized)
                  </label>
                  <div className="flex space-x-2">
                    <input 
                        type="text" 
                        value={patientIdInput}
                        onChange={(e) => {
                        setPatientIdInput(e.target.value);
                        if (error) setError(null);
                        }}
                        placeholder="e.g. ANON-2025-XXXX"
                        disabled={isProcessing || analysisComplete}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm transition-all font-mono"
                    />
                    {!analysisComplete && !isProcessing && (
                        <button 
                            onClick={generateSecureId}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg border border-slate-200 transition-colors flex items-center text-xs font-semibold whitespace-nowrap"
                            title="Generate Secure ID"
                        >
                            <RefreshCw size={14} className="mr-1" />
                            Generate Secure ID
                        </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Clinical History</label>
                  {clinicalHistory === 'NA' && (analysisComplete || isProcessing) ? (
                     <div className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-400 italic">
                        Clinical History not provided
                     </div>
                  ) : (
                    <textarea 
                        value={clinicalHistory}
                        onChange={(e) => {
                        setClinicalHistory(e.target.value);
                        if (error) setError(null);
                        }}
                        placeholder="Patient reports... (or type 'NA' if no history available)"
                        rows={4}
                        disabled={isProcessing || analysisComplete}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm resize-none transition-all"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-fit">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 flex items-center">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                MRI Series Upload
              </h3>

              {!analysisComplete && (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 ${
                    isDragging 
                      ? 'border-teal-500 bg-teal-50 scale-[1.02]' 
                      : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
                  }`}
                >
                  <UploadCloud className={`mb-3 ${isDragging ? 'text-teal-600' : 'text-slate-400'}`} size={40} />
                  <p className="text-slate-700 font-medium mb-1">Drag & drop MRI files</p>
                  <p className="text-slate-400 text-xs mb-4">PNG, JPG supported</p>
                  <label className="cursor-pointer bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm">
                    Browse Files
                    <input type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleFileSelect} />
                  </label>
                </div>
              )}

              {/* Thumbnail Strip with Interaction */}
              {mriSlices.length > 0 && (
                <div className="mt-6 space-y-2">
                   <p className="text-xs font-semibold text-slate-500 uppercase flex justify-between">
                     <span>Uploaded Slices ({mriSlices.length})</span>
                     {highlightedSliceId && <span className="text-teal-600">Showing Highlighted</span>}
                   </p>
                   <div className="grid grid-cols-4 gap-2">
                      {mriSlices.map((slice) => {
                        const isHighlighted = slice.id === highlightedSliceId;
                        return (
                          <div 
                            key={slice.id} 
                            className={`relative aspect-square group transition-all duration-300 ${isHighlighted ? 'ring-4 ring-teal-400 scale-105 z-10' : ''}`}
                            onClick={() => setHighlightedSliceId(slice.id)}
                          >
                             <img src={slice.url} alt="thumbnail" className="w-full h-full object-cover rounded-lg border border-slate-200 cursor-pointer" />
                             {!analysisComplete && !isProcessing && (
                               <button 
                                  onClick={(e) => { e.stopPropagation(); removeSlice(slice.id); }}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                 <X size={12} />
                               </button>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}
            </div>

            {/* Error & Action Button */}
            {!analysisComplete && (
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start text-red-800 animate-fadeIn shadow-sm">
                    <ShieldAlert className="mt-0.5 mr-3 flex-shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-sm">Action Required</h4>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={analyzeWithMIRA}
                  disabled={isProcessing}
                  className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center transition-all ${
                      isProcessing 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-purple-200 hover:-translate-y-0.5'
                  }`}
                >
                  {isProcessing ? 'Analysing Slices...' : 'Analyze with MIRA'}
                </button>
              </div>
            )}
            
            {/* Reset Button (Only when analysis is done) */}
            {analysisComplete && (
                 <button
                 onClick={handleReset}
                 className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center"
               >
                 <RefreshCw className="mr-2" size={16} />
                 Reset Analysis & Upload New
               </button>
            )}
          </div>

          {/* RIGHT COLUMN: Processing & Results */}
          <div className="lg:col-span-7">
             
             {/* EMPTY STATE */}
             {!isProcessing && !analysisComplete && (
               <div className="h-full flex flex-col items-center justify-center bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center opacity-70">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <BrainCircuit className="text-slate-300" size={40} />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-600 mb-2">Ready for Analysis</h3>
                  <p className="text-slate-500 max-w-md">Upload patient MRI scans (multiple slices supported) and clinical context to begin the Gemini 3 Pro vision analysis.</p>
               </div>
             )}

             {/* PROCESSING STATE */}
             {isProcessing && (
               <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl shadow-lg border border-purple-100 p-12 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-white opacity-50"></div>
                  <div className="relative z-10 w-full max-w-md text-center">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6 mx-auto animate-pulse">
                      <Layers className="text-purple-600" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Processing with MIRA</h3>
                    <p className="text-slate-500 mb-8">Gemini is scanning {mriSlices.length} slices concurrently...</p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                       <div 
                         className="bg-purple-600 h-full rounded-full transition-all duration-300 ease-out"
                         style={{ width: `${processingProgress}%` }}
                       ></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                       <span>Vision Analysis Active</span>
                       <span>{processingProgress}%</span>
                    </div>
                  </div>
               </div>
             )}

             {/* RESULTS RENDERER */}
             {renderAnalysisResult()}

          </div>
        </div>
      </div>
    </div>
  );
};