
export enum CalculationMode {
  BUILDING = 'Building',
  WALLS_ONLY = 'Walls Only',
  FLAT_AREA = 'Flat Area',
  CUSTOM = 'Custom',
}

export enum FoamType {
  OPEN_CELL = 'Open Cell',
  CLOSED_CELL = 'Closed Cell',
}

export enum AreaType {
  WALL = 'wall',
  ROOF = 'roof',
}

export interface AdditionalArea {
  id: string;
  length: number;
  width: number;
  type: AreaType;
  description?: string;
}

// Project specific line items
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number; // Cost per unit for P&L
}

// Global warehouse items
export interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number; // Cost per unit for P&L
  minLevel?: number; // For low stock alerts
}

export interface FoamSettings {
  type: FoamType;
  thickness: number;
  wastePercentage: number;
}

export interface CrewProfile {
  id: string;
  name: string;
  username: string; // Replaces PIN
  password?: string; // Replaces PIN
  leadName?: string;
  phone?: string;
  truckInfo?: string;
  status?: 'Active' | 'Inactive';
}

export interface CompanyProfile {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string; // Base64 string for local storage
  crewAccessPin?: string; // Legacy PIN for crew login
}

export interface CustomerProfile {
  id: string; // Added ID for CRM linking
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  notes?: string; // CRM Notes
  status?: 'Active' | 'Archived'; // New status for archiving
  createdAt?: string;
}

export type EstimateStatus = 'Draft' | 'Work Order' | 'Archived';

export interface EstimateRecord {
  id: string;
  customerId?: string; // Link to customer
  status: EstimateStatus;
  date: string; // ISO Date string (Creation Date)
  scheduledDate?: string; // ISO Date string (Job Execution Date)
  assignedCrewId?: string; // ID of the assigned crew/rig
  customer: CustomerProfile; // Snapshot at time of estimate
  
  // External File Links
  workOrderSheetUrl?: string; // Link to standalone Google Sheet
  
  // Crew Execution Data
  executionStatus?: 'Not Started' | 'In Progress' | 'Completed';
  actuals?: {
    openCellSets: number;
    closedCellSets: number;
    openCellStrokes?: number;
    closedCellStrokes?: number;
    inventory: InventoryItem[];
    completionDate: string;
    completedBy: string;
    laborHours?: number; // Total hours spent on job
    notes?: string; // Notes from the crew upon completion
  };

  // Inputs required to re-load/edit the estimate
  inputs: {
    mode: CalculationMode;
    length: number;
    width: number;
    wallHeight: number;
    roofPitch: string;
    includeGables: boolean;
    isMetalSurface?: boolean; // Added for Metal Surface Calculation
    additionalAreas: AdditionalArea[];
  };

  results: CalculationResults;

  // We store a snapshot of critical data to reproduce the material estimate
  materials: {
    openCellSets: number;
    closedCellSets: number;
    inventory: InventoryItem[];
  };
  // Snapshots for PDF reproduction
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  
  // Job Specifics
  notes?: string;
}

export interface MaterialUsageLogEntry {
  id: string;
  date: string;
  jobId: string;
  customerName: string;
  materialName: string;
  quantity: number;
  unit: string;
  loggedBy: string;
}

export interface Costs {
  openCell: number;
  closedCell: number;
  laborRate: number;
}

export interface CalculatorState {
  mode: CalculationMode;
  length: number;
  width: number;
  wallHeight: number;
  roofPitch: string;
  includeGables: boolean;
  isMetalSurface: boolean; // Added for Metal Surface Calculation
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  costs?: Costs;
  yields: {
    openCell: number;
    closedCell: number;
    openCellStrokes?: number; // Strokes per set
    closedCellStrokes?: number; // Strokes per set
  };
  warehouse: {
    openCellSets: number;
    closedCellSets: number;
    items: WarehouseItem[];
  };
  additionalAreas: AdditionalArea[];
  inventory: InventoryItem[]; // Project specific extras
  companyProfile: CompanyProfile;
  crews: CrewProfile[]; // Multiple crews/rigs
  
  // CRM Data
  customers: CustomerProfile[]; // Explicit customer database
  customerProfile: CustomerProfile; // Current working profile (WIP)

  savedEstimates: EstimateRecord[];
  materialLogs?: MaterialUsageLogEntry[]; // NEW: Material Tracking Ledger
  
  // Pricing & Expenses
  pricingMode?: 'level_pricing' | 'sqft_pricing';
  sqFtRates?: {
    wall: number;
    roof: number;
  };
  expenses?: {
    manHours: number;
    tripCharge: number;
  };

  // UI State for notes
  jobNotes?: string;
  scheduledDate?: string;
  assignedCrewId?: string; // ID of the assigned crew/rig
}

export interface CalculationResults {
  perimeter: number;
  slopeFactor: number;
  baseWallArea: number;
  gableArea: number;
  totalWallArea: number;
  baseRoofArea: number;
  totalRoofArea: number;
  
  wallBdFt: number;
  roofBdFt: number;
  
  totalOpenCellBdFt: number;
  totalClosedCellBdFt: number;
  
  openCellSets: number;
  closedCellSets: number;
  
  openCellStrokes: number;
  closedCellStrokes: number;

  // Cost fields
  totalCost: number;
  materialCost: number;
  laborCost: number;
  miscExpenses: number;
}

export interface UserSession {
  id: string;
  email: string;
  companyId: string;
  companyName: string;
  role: 'admin' | 'crew';
  displayName: string;
  crewId?: string;
  crewName?: string;
}
