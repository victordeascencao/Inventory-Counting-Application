export interface Product {
  id: number;
  name: string;
  barcode: string;
  quantity: number;
  location?: string;
  location_id?: number;
  internal_reference?: string;
  image_url?: string;
  min_stock?: number;
  max_stock?: number;
  category?: string;
  last_updated?: Date;
}

export interface StockMove {
  id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  location: string;
  location_from?: string;
  location_to?: string;
  timestamp: Date;
  user?: string;
  barcode?: string;
  reason?: string;
  reference?: string;
  synced?: boolean;
}

export interface Location {
  id: number;
  name: string;
  code: string;
  type: 'warehouse' | 'storage' | 'production' | 'customer' | 'supplier';
  parent_id?: number;
}

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
  apiKey?: string;
  defaultLocation?: string;
  autoSync?: boolean;
}

export interface ScanHistory {
  id: string;
  barcode: string;
  product_name: string;
  quantity: number;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  timestamp: Date;
  location?: string;
  synced?: boolean;
}

export interface BatchScan {
  id: string;
  items: ScanHistory[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  completed_at?: Date;
}

export interface DashboardMetrics {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  recentMovements: number;
  pendingSync: number;
  todayScans: number;
  weeklyTrend: number;
}

export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  action: 'scan_in' | 'scan_out' | 'count' | 'transfer' | 'report' | 'sync';
  badge?: number;
}