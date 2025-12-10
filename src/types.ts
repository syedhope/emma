
export enum AppView {
  HOME = 'HOME',
  MIRA = 'MIRA', // Upload & Vision
  NORA = 'NORA', // Radiologist Dashboard
  LUMA = 'LUMA', // Patient Explainer
  HELP = 'HELP', // Help & Guide
}

export enum FindingLikelihood {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface AIFinding {
  id: string;
  region: string; // e.g., "Left Ovary", "Pouch of Douglas"
  likelihood: FindingLikelihood;
  description: string;
  coordinates?: Coordinates;
  status?: 'pending' | 'accepted' | 'rejected';
  sourceSlices?: string[]; // IDs of slices where this was found
  bestSliceId?: string; // ID of the slice with best view/confidence
}

export enum CaseStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  REVIEWED = 'reviewed',
  FINALIZED = 'finalized'
}

export interface AIAnalysisMetadata {
  isPelvicMri: boolean;
  imageDescription: string;
  timestamp: string;
}

export interface PatientResource {
  title: string;
  source: string;
}

export interface PatientTranslation {
  summary: string;
  questions: string[];
  resources: PatientResource[];
}

export interface CaseData {
  id: string;
  patientId: string; // Renamed from patientName for anonymity
  caseSequence?: string; // e.g., "001"
  age: number;
  notes: string;
  clinicalHistory?: string;
  scannedAt: string;
  secondOpinionNotes?: string;
  status: CaseStatus;
  peerRequestNote?: string;
  assignedPeer?: string;
  aiAnalysisMetadata?: AIAnalysisMetadata;
  patientTranslation?: PatientTranslation;
}

export interface MriSlice {
  id: string;
  url: string; // Blob URL or remote URL
  description: string; // e.g., "T2 Sagittal Slice 4"
  file?: File;
}

export enum DashboardMode {
  PRIMARY = 'primary',
  PEER_REVIEW = 'peer',
}

export enum UserPersona {
  PRIMARY = 'Dr. Smith',
  PEER = 'Dr. Maryam',
  PATIENT = 'Jane Doe (Patient)'
}