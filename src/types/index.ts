export type UserRole = 'ADMIN' | 'FOREMAN' | 'WORKER';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string; // np. "Brygadzista", "Cieśla", "Zbrojarz", "Kierownik budowy"
  isForeman: boolean;
  isAdmin: boolean;
  login: string;
  password?: string;
  createdAt: string;
}

export interface ConstructionSite {
  id: string;
  name: string; // np. "Poznań - Piątkowo", "Poznań - Franowo"
  address?: string;
  active: boolean;
}

export interface DiscussedTopicTemplate {
  id: string;
  title: string;
  category?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  isForeman: boolean;
  signatureDataUrl: string; // PNG Base64 z canvasu podpisu
  signedAt: string;
}

export interface PhotoDocumentationItem {
  id: string;
  photoDataUrl: string; // Base64 lub URL zdjęcia
  description: string;
  takenAt: string;
}

export type ReportType = 'START_SHIFT' | 'END_SHIFT';

export interface GeoLocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  address?: string;
}

export interface DailyReport {
  id: string;
  tenantId: string;
  reportType: ReportType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  siteId: string;
  siteName: string;
  foremanId: string;
  foremanName: string;
  location: GeoLocationData;
  // Dla Rozpoczęcia prac:
  discussedTopics?: string[];
  attendanceList?: AttendanceRecord[];
  // Dla Zakończenia prac:
  photoDocumentation?: PhotoDocumentationItem[];
  // Metadane:
  pdfFileName: string;
  pdfDataUrl?: string;
  sentToEmails: string[];
  sentAt: string;
  status: 'SENT' | 'SAVED_LOCAL' | 'FAILED';
  errorMessage?: string;
}

export interface TenantSettings {
  tenantId: string;
  organizationName: string; // "SolutionsBay / SB Technology"
  logoText: string; // "SB Technology"
  logoSubtitle: string; // "RYCOS Shift"
  startShiftEmailRecipients: string[];
  endShiftEmailRecipients: string[];
  resendApiKey?: string;
  resendFromEmail?: string;
  storageFolder?: string;
}

export interface PdfTemplate {
  id: string;
  tenantId: string;
  reportType: ReportType;
  name: string;
  htmlContent: string;
  active: boolean;
  updatedAt: string;
}
