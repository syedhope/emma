import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppView, CaseData, MriSlice, AIFinding, DashboardMode, UserPersona, CaseStatus } from '../types';

interface CaseContextType {
  // State
  activeView: AppView;
  currentCase: CaseData | null;
  mriSlices: MriSlice[];
  aiFindings: AIFinding[];
  finalReport: string;
  dashboardMode: DashboardMode;
  currentUser: UserPersona;
  apiKey: string;
  
  // Actions
  navigate: (view: AppView) => void;
  updateCase: (data: CaseData) => void;
  updateCaseStatus: (status: CaseStatus) => void;
  setSlices: (slices: MriSlice[]) => void;
  setFindings: (findings: AIFinding[]) => void;
  updateReport: (report: string) => void;
  setDashboardMode: (mode: DashboardMode) => void;
  setCurrentUser: (user: UserPersona) => void;
  resetCase: () => void;
  saveApiKey: (key: string) => void;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

const STORAGE_KEY = 'emma_app_state_v2';
const API_KEY_STORAGE_KEY = 'GEMINI_API_KEY';

export const CaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initial State Defaults
  const [activeView, setActiveView] = useState<AppView>(AppView.HOME);
  const [currentCase, setCurrentCase] = useState<CaseData | null>(null);
  const [mriSlices, setMriSlices] = useState<MriSlice[]>([]);
  const [aiFindings, setAiFindings] = useState<AIFinding[]>([]);
  const [finalReport, setFinalReport] = useState<string>('');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(DashboardMode.PRIMARY);
  const [currentUser, setCurrentUser] = useState<UserPersona>(UserPersona.PRIMARY);
  const [apiKey, setApiKey] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from LocalStorage on Mount
  useEffect(() => {
    try {
      // Load App State
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeView) setActiveView(parsed.activeView);
        if (parsed.currentCase) setCurrentCase(parsed.currentCase);
        if (parsed.mriSlices) setMriSlices(parsed.mriSlices);
        if (parsed.aiFindings) setAiFindings(parsed.aiFindings);
        if (parsed.finalReport) setFinalReport(parsed.finalReport);
        if (parsed.dashboardMode) setDashboardMode(parsed.dashboardMode);
        if (parsed.currentUser) setCurrentUser(parsed.currentUser);
      }

      // Load API Key (Separate storage for security/management)
      const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedKey) {
        setApiKey(storedKey);
      } else if (process.env.API_KEY) {
        // Fallback to environment variable if available and not overridden by user
        setApiKey(process.env.API_KEY);
      }

    } catch (e) {
      console.error("Failed to load state from local storage", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save App State to LocalStorage on Change
  useEffect(() => {
    if (!isInitialized) return;

    const stateToSave = {
      activeView,
      currentCase,
      mriSlices,
      aiFindings,
      finalReport,
      dashboardMode,
      currentUser
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [activeView, currentCase, mriSlices, aiFindings, finalReport, dashboardMode, currentUser, isInitialized]);

  const navigate = (view: AppView) => setActiveView(view);
  
  const updateCase = (data: CaseData) => setCurrentCase(data);
  
  const updateCaseStatus = (status: CaseStatus) => {
    if (currentCase) {
      setCurrentCase({ ...currentCase, status });
    }
  };

  const setSlices = (slices: MriSlice[]) => setMriSlices(slices);
  
  const setFindings = (findings: AIFinding[]) => setAiFindings(findings);
  
  const updateReport = (report: string) => setFinalReport(report);
  
  const resetCase = () => {
    setCurrentCase(null);
    setMriSlices([]);
    setAiFindings([]);
    setFinalReport('');
    setDashboardMode(DashboardMode.PRIMARY);
    navigate(AppView.HOME);
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  return (
    <CaseContext.Provider value={{
      activeView,
      currentCase,
      mriSlices,
      aiFindings,
      finalReport,
      dashboardMode,
      currentUser,
      apiKey,
      navigate,
      updateCase,
      updateCaseStatus,
      setSlices,
      setFindings,
      updateReport,
      setDashboardMode,
      setCurrentUser,
      resetCase,
      saveApiKey
    }}>
      {children}
    </CaseContext.Provider>
  );
};

export const useCaseContext = () => {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCaseContext must be used within a CaseProvider');
  }
  return context;
};