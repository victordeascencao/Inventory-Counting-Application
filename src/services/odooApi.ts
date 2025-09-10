import axios from 'axios';
import { Product, StockMove, OdooConfig } from '../types';
import * as SecureStore from 'expo-secure-store';

class OdooAPIService {
  private config: OdooConfig | null = null;
  private sessionId: string | null = null;

  async loadConfig(): Promise<boolean> {
    try {
      const savedConfig = await SecureStore.getItemAsync('odoo_config');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load config:', error);
      return false;
    }
  }

  async saveConfig(config: OdooConfig): Promise<void> {
    this.config = config;
    await SecureStore.setItemAsync('odoo_config', JSON.stringify(config));
  }

  async authenticate(): Promise<boolean> {
    if (!this.config) throw new Error('Odoo configuration not set');

    try {
      const response = await axios.post(
        `${this.config.url}/web/session/authenticate`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: this.config.db,
            login: this.config.username,
            password: this.config.password,
          },
          id: Date.now(),
        }
      );

      if (response.data.result && response.data.result.uid) {
        this.sessionId = response.data.result.session_id;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async searchProductByBarcode(barcode: string): Promise<Product | null> {
    if (!this.config || !this.sessionId) {
      await this.authenticate();
    }

    try {
      const response = await axios.post(
        `${this.config!.url}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'product.product',
            method: 'search_read',
            args: [[['barcode', '=', barcode]]],
            kwargs: {
              fields: ['id', 'name', 'barcode', 'qty_available', 'default_code'],
            },
          },
          id: Date.now(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session_id=${this.sessionId}`,
          },
        }
      );

      if (response.data.result && response.data.result.length > 0) {
        const product = response.data.result[0];
        return {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          quantity: product.qty_available || 0,
          internal_reference: product.default_code,
        };
      }
      return null;
    } catch (error) {
      console.error('Product search failed:', error);
      return null;
    }
  }

  async createStockMove(move: StockMove): Promise<boolean> {
    if (!this.config || !this.sessionId) {
      await this.authenticate();
    }

    try {
      const picking_type_id = move.type === 'in' ? 1 : 2;
      
      const response = await axios.post(
        `${this.config!.url}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.picking',
            method: 'create',
            args: [{
              picking_type_id: picking_type_id,
              location_id: move.type === 'in' ? 8 : 12,
              location_dest_id: move.type === 'in' ? 12 : 9,
              move_lines: [[0, 0, {
                product_id: move.product_id,
                product_uom_qty: move.quantity,
                product_uom: 1,
                name: move.product_name,
                location_id: move.type === 'in' ? 8 : 12,
                location_dest_id: move.type === 'in' ? 12 : 9,
              }]],
            }],
            kwargs: {},
          },
          id: Date.now(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session_id=${this.sessionId}`,
          },
        }
      );

      return !!response.data.result;
    } catch (error) {
      console.error('Stock move creation failed:', error);
      return false;
    }
  }

  async updateProductQuantity(productId: number, newQuantity: number): Promise<boolean> {
    if (!this.config || !this.sessionId) {
      await this.authenticate();
    }

    try {
      const response = await axios.post(
        `${this.config!.url}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.quant',
            method: 'create',
            args: [{
              product_id: productId,
              location_id: 12,
              quantity: newQuantity,
            }],
            kwargs: {},
          },
          id: Date.now(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session_id=${this.sessionId}`,
          },
        }
      );

      return !!response.data.result;
    } catch (error) {
      console.error('Quantity update failed:', error);
      return false;
    }
  }

  async getInventory(): Promise<Product[]> {
    if (!this.config || !this.sessionId) {
      await this.authenticate();
    }

    try {
      const response = await axios.post(
        `${this.config!.url}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'product.product',
            method: 'search_read',
            args: [[]],
            kwargs: {
              fields: ['id', 'name', 'barcode', 'qty_available', 'default_code'],
              limit: 100,
            },
          },
          id: Date.now(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session_id=${this.sessionId}`,
          },
        }
      );

      if (response.data.result) {
        return response.data.result.map((product: any) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode || '',
          quantity: product.qty_available || 0,
          internal_reference: product.default_code,
        }));
      }
      return [];
    } catch (error) {
      console.error('Inventory fetch failed:', error);
      return [];
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }
}

export default new OdooAPIService();