import React, { useEffect, useState } from 'react';
import { ShieldCheck, HelpCircle, FileText, CheckCircle, Clock, ExternalLink, AlertCircle, Sparkles, RefreshCw, ArrowLeft } from 'lucide-react';
import { useCaseContext } from '../context/CaseContext';
import { GoogleGenAI } from "@google/genai";
import { PatientTranslation, AppView } from '../types';

// 1. Glossary Configuration for Interactive Tooltips
const GLOSSARY: Record<string, string> = {
  "Endometrioma": "A cyst on the ovary filled with old blood, often called a 'chocolate cyst'.",
  "Chocolate cyst": "A cyst on the ovary filled with old blood, formally known as an endometrioma.",
  "Adhesion": "Scar tissue that can cause organs (like ovaries or the uterus) to stick together.",
  "Pouch of Douglas": "The small area between the uterus and the rectum where endometriosis is often found.",
  "Lesion": "A general term for an area of tissue that has been damaged or changed.",
  "Hyperintense": "Appearing brighter on the MRI scan, often indicating fluid or blood.",
  "Deep Infiltrating Endometriosis": "Endometriosis that has penetrated deeper than 5mm under the tissue surface.",
  "DIE": "Deep Infiltrating Endometriosis; a severe form where tissue penetrates deeper than 5mm.",
  "Uterosacral Ligament": "Ligaments that support the uterus. Thickening here is a frequent sign of deep endometriosis.",
  "Rectovaginal": "The area between the rectum and the vagina, a common site for deep endometriosis nodules.",
  "T2 Signal": "A type of MRI sequence. 'High T2 signal' often means fluid, while 'low signal' can mean scar tissue."
};

// 2. TermHighlighter Component
const TermHighlighter: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Sort keys by length descending to match longest phrases first
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join('|')})\\b`, 'gi');
  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, i) => {
        const lowerPart = part.toLowerCase();
        const matchedKey = terms.find(t => t.toLowerCase() === lowerPart);
        
        if (matchedKey) {
            return (
                <span key={i} className="relative group cursor-help inline-block decoration-teal-500 decoration-dotted underline underline-offset-4 text-slate-900 font-semibold mx-0.5">
                    {part}
                    {/* Tooltip */}
                    <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-50 pointer-events-none text-center leading-relaxed">
                        <span className="block font-bold mb-1 text-teal-300 border-b border-slate-700 pb-1">{matchedKey}</span>
                        {GLOSSARY[matchedKey]}
                        <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255">
                            <polygon className="fill-current" points="0,0 127.5,127.5 255,0"/>
                        </svg>
                    </span>
                </span>
            );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// Skeleton Loader Component
const LumaSkeleton = () => (
    <div className="space-y-8 animate-pulse">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-teal-100 rounded-full mr-4"></div>
                <div className="h-6 bg-slate-200 rounded w-1/3"></div>
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                <div className="h-4 bg-slate-100 rounded w-full"></div>
            </div>
        </div>
        <div className="h-64 bg-blue-50/50 rounded-3xl border border-blue-100"></div>
    </div>
);

interface LumaExplainerProps {
  isPreview?: boolean;
}

export const LumaExplainer: React.FC<LumaExplainerProps> = ({ isPreview = false }) => {
  const { currentCase, finalReport, apiKey, updateCase, navigate } = useCaseContext();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger Generation Logic
  useEffect(() => {
    const generatePatientView = async () => {
        if (!finalReport || !apiKey || !currentCase) return;
        
        // If we already have a translation, don't regenerate unless explicitly cleared
        if (currentCase.patientTranslation) return;

        setIsGenerating(true);
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const prompt = `
                You are an empathetic medical communicator. Translate the following technical radiology report into a reassuring, easy-to-understand summary for a patient. 
                Use 8th-grade reading level.
                
                Input Report: 
                "${finalReport}"
                
                Output: Return valid JSON only.
                Schema: 
                { 
                    "summary": "A 2-3 paragraph narrative explaining the findings in plain English. Use medical terms like 'Endometrioma' but explain them simply within the flow.", 
                    "questions": ["3 specific follow-up questions the patient should ask their doctor based on these specific findings"], 
                    "resources": [{"title": "Name of a relevant article/topic", "source": "Mayo Clinic/NIH/Endometriosis Foundation"}] 
                }
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            });

            if (!response.text) throw new Error("No response from AI");

            const result: PatientTranslation = JSON.parse(response.text);
            
            // Save to global state
            updateCase({
                ...currentCase,
                patientTranslation: result
            });

        } catch (err: any) {
            console.error("LUMA Generation Failed:", err);
            setError("LUMA is having trouble connecting to the translation engine. Please try again later.");
        } finally {
            setIsGenerating(false);
        }
    };

    generatePatientView();
  }, [finalReport, apiKey, currentCase, updateCase]);

  // Guardrail: Empty State Check (Skip in preview to show what's there)
  if (!currentCase || (!finalReport && !isPreview)) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-8 text-center animate-fadeIn relative">
        {/* Back Button for Empty State */}
        {!isPreview && (
            <div className="absolute top-8 left-8">
                 <button 
                  onClick={() => navigate(AppView.HOME)}
                  className="flex items-center text-slate-500 hover:text-slate-800 transition-colors font-medium"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  Back to Dashboard
                </button>
            </div>
        )}

        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
          <Clock className="text-slate-300" size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Radiology Summary Not Ready</h2>
        <p className="text-slate-500 max-w-md text-lg leading-relaxed">
          Your personalized summary is currently being generated. Please check back after your radiologist has finalized and approved the report.
        </p>
      </div>
    );
  }

  const translation = currentCase.patientTranslation;

  return (
    <div className={`flex flex-col bg-[#f8fafc] font-sans text-slate-900 ${isPreview ? 'h-full overflow-y-auto' : 'h-full overflow-y-auto'}`}>
      
      {/* Header - Privacy & Trust */}
      <header className={`bg-white border-b border-slate-200 px-8 py-8 sticky top-0 z-10 shadow-sm ${isPreview ? 'py-4 px-6' : ''}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {/* Nav Back (Only if not preview) */}
            {!isPreview && (
                <button 
                  onClick={() => navigate(AppView.HOME)}
                  className="flex items-center text-slate-500 hover:text-teal-600 transition-colors font-medium w-fit mb-2"
                >
                  <ArrowLeft size={18} className="mr-2" />
                  Back to Dashboard
                </button>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className={`font-bold text-slate-900 tracking-tight ${isPreview ? 'text-xl' : 'text-3xl'}`}>
                            Radiology Summary
                        </h1>
                        <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full border border-teal-100 uppercase tracking-wide flex items-center shadow-sm">
                            <ShieldCheck size={14} className="mr-1.5" /> Secure View
                        </span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 text-sm text-slate-500 font-medium mt-1">
                        <p>Patient Ref: <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{currentCase.patientId}</span></p>
                        <p>Exam ID: <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{currentCase.patientId}-{currentCase.caseSequence || '001'}</span></p>
                    </div>
                </div>
                
                <div className="flex items-center bg-green-50 border border-green-100 px-5 py-3 rounded-xl shadow-sm">
                    <div className="bg-green-100 p-2 rounded-full mr-3">
                        <CheckCircle className="text-green-600" size={20} />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] text-green-800 uppercase font-bold tracking-wider mb-0.5">Verified By Care Team</p>
                        <p className="text-sm font-bold text-green-900">
                            Radiology Team
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </header>

      <div className={`flex-1 max-w-4xl mx-auto w-full space-y-8 pb-20 ${isPreview ? 'p-6' : 'p-8'}`}>
        
        {/* Loading State */}
        {isGenerating && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center justify-center text-purple-800 mb-6">
                 <Sparkles className="mr-2 animate-spin" size={20} />
                 <span className="font-medium">LUMA is translating technical terms...</span>
            </div>
        )}

        {isGenerating ? (
            <LumaSkeleton />
        ) : !translation ? (
             /* Fallback if generation failed or not run yet */
             <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center">
                <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
                <h3 className="font-bold text-red-800">Translation Unavailable</h3>
                <p className="text-red-600 text-sm mb-4">{error || "Please wait for the automated translation."}</p>
                <button 
                  onClick={() => window.location.reload()} // Simple retry logic
                  className="px-4 py-2 bg-white border border-red-200 rounded-lg text-red-700 text-sm font-medium hover:bg-red-50"
                >
                    <RefreshCw size={14} className="inline mr-1" /> Retry
                </button>
             </div>
        ) : (
            <>
                {/* Main Report Summary with Interactive Tooltips */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible relative animate-fadeIn">
                    <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex items-center">
                        <FileText className="text-teal-600 mr-3" size={24} />
                        <h3 className="text-lg font-bold text-slate-800">Clinical Findings Summary</h3>
                    </div>
                    <div className="p-8">
                        {/* TIP for User */}
                        <div className="mb-6 flex items-center text-sm text-slate-500 bg-teal-50/50 p-3 rounded-lg border border-teal-100">
                            <HelpCircle size={16} className="text-teal-600 mr-2" />
                            <span>Tip: Hover over the <span className="decoration-teal-500 decoration-dotted underline underline-offset-4 font-semibold text-slate-900">underlined words</span> to see their definitions.</span>
                        </div>

                        <div className="prose prose-lg prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                            <TermHighlighter text={translation.summary} />
                        </div>
                    </div>
                </section>

                {/* Ask Your Doctor Section */}
                <section className="bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-3xl border border-blue-100 p-8 md:p-10 animate-fadeIn">
                    <div className="flex items-start mb-8">
                        <div className="bg-blue-100 p-3 rounded-xl mr-4 text-blue-600">
                            <HelpCircle size={28} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1">Ask Your Doctor</h3>
                            <p className="text-slate-500">Suggested questions based on your specific findings.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        {translation.questions.map((q, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-blue-100/50 shadow-sm hover:shadow transition-shadow cursor-default group flex items-start">
                                <div className="bg-blue-50 text-blue-600 font-bold w-6 h-6 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-xs mt-0.5">
                                    {idx + 1}
                                </div>
                                <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-relaxed">{q}</h4>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Trusted Resources Section */}
                <section className="animate-fadeIn">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                        <ExternalLink className="text-teal-600 mr-3" size={26} />
                        Trusted Resources
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {translation.resources.map((resource, idx) => (
                            <a 
                                key={idx}
                                href={`https://www.google.com/search?q=${encodeURIComponent(resource.title + ' ' + resource.source)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-200 transition-all flex items-start group"
                            >
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 mb-1 group-hover:text-teal-700 line-clamp-2">{resource.title}</h4>
                                    <p className="text-xs text-slate-500">{resource.source}</p>
                                </div>
                                <ExternalLink size={16} className="text-slate-300 group-hover:text-teal-500 mt-1 flex-shrink-0" />
                            </a>
                        ))}
                    </div>
                </section>
            </>
        )}

        {/* Disclaimer Footer */}
        <footer className="text-center pt-8">
            <div className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
                <AlertCircle size={14} className="mr-2 text-slate-400" />
                <span>Generated by EMMA AI • Verified by your Care Team • For educational purposes only</span>
            </div>
        </footer>

      </div>
    </div>
  );
};