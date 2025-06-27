import sql from 'mssql';
import { IStorage } from './storage';
import { Customer, Product, Order, SalesRep, InsertCustomer, InsertProduct, InsertOrder, InsertSalesRep, QueryExecutionResult } from '@shared/schema';

interface MSSQLTableMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

export class MSSQLStorage implements IStorage {
  private pool: sql.ConnectionPool | null = null;
  private config: sql.config;

  constructor() {
    this.config = {
      server: '101.53.155.39',
      database: 'devsoftaitooldb',
      user: 'devsoftaitool',
      password: 'Aaitoolsosdb@150a1a',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 60000,
        requestTimeout: 60000,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
  }

  private async getConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      this.pool = new sql.ConnectionPool(this.config);
      await this.pool.connect();
    }
    return this.pool;
  }

  // Business Rules Context
  private getBusinessRulesContext(): string {
    return `
-- Business Rules Context:
-- 1. Sales Amount Ratio Formula: (Current Period Sales / Previous Period Sales) * 100
-- 2. Matrix Generation: 16x16 matrix for analytical purposes
-- 3. Always use proper SQL Server syntax and functions
-- 4. Consider data relationships and constraints
-- 5. Use appropriate aggregation functions for financial calculations
-- 6. Handle NULL values appropriately in calculations
-- 7. Use proper date functions for time-based queries
-- 8. Consider performance implications for large datasets
`;
  }

  async executeQuery(sqlQuery: string): Promise<QueryExecutionResult> {
    const startTime = Date.now();
    
    try {
      const pool = await this.getConnection();
      const request = pool.request();
      const result = await request.query(sqlQuery);

      const executionTime = Date.now() - startTime;
      
      if (result.recordset && result.recordset.length > 0) {
        const columns = Object.keys(result.recordset[0]);
        const rows = result.recordset.map(row => {
          const rowData: { [key: string]: any } = {};
          columns.forEach(col => {
            rowData[col] = row[col];
          });
          return rowData;
        });

        return {
          columns,
          rows,
          totalCount: rows.length,
          executionTime
        };
      }

      return {
        columns: [],
        rows: [],
        totalCount: 0,
        executionTime
      };
    } catch (error) {
      console.error('SQL Query execution error:', error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableMetadata(): Promise<{ tables: Array<MSSQLTableMetadata> }> {
    try {
      const pool = await this.getConnection();
      const request = pool.request();

      // Get all views with their column information, excluding _copy views
      const viewQuery = `
        SELECT 
          v.TABLE_NAME as VIEW_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.NUMERIC_PRECISION,
          c.NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.VIEWS v
        LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON v.TABLE_NAME = c.TABLE_NAME
        WHERE v.TABLE_SCHEMA = 'dbo'
        AND v.TABLE_NAME NOT LIKE '%_copy%'
        AND v.TABLE_NAME NOT LIKE '%_Copy%'
        AND v.TABLE_NAME NOT LIKE '%_COPY%'
        ORDER BY v.TABLE_NAME, c.ORDINAL_POSITION
      `;

      const result = await request.query(viewQuery);
      
      // Group by view name and build view metadata
      const viewsMap = new Map<string, MSSQLTableMetadata>();
      
      for (const row of result.recordset as any[]) {
        const viewName = row.VIEW_NAME;
        
        if (!viewsMap.has(viewName)) {
          viewsMap.set(viewName, {
            name: viewName,
            recordCount: 0, // Views with WHERE 1=2 return no rows
            columns: []
          });
        }

        const view = viewsMap.get(viewName)!;
        if (row.COLUMN_NAME) {
          let dataType = row.DATA_TYPE;
          if (row.CHARACTER_MAXIMUM_LENGTH) {
            dataType += `(${row.CHARACTER_MAXIMUM_LENGTH})`;
          } else if (row.NUMERIC_PRECISION) {
            dataType += `(${row.NUMERIC_PRECISION}${row.NUMERIC_SCALE ? ',' + row.NUMERIC_SCALE : ''})`;
          }

          view.columns.push({
            name: row.COLUMN_NAME,
            type: dataType
          });
        }
      }

      // Validate each view by querying with WHERE 1=2 to ensure column access
      const views = Array.from(viewsMap.values());
      for (const view of views) {
        try {
          const testRequest = pool.request();
          await testRequest.query(`SELECT * FROM [${view.name}] WHERE 1=2`);
          console.log(`View ${view.name} is accessible with ${view.columns.length} columns`);
        } catch (error) {
          console.warn(`View ${view.name} access test failed:`, error);
          // Remove inaccessible views
          const index = views.indexOf(view);
          if (index > -1) {
            views.splice(index, 1);
          }
        }
      }

      return {
        tables: views
      };
    } catch (error) {
      console.error('Error fetching view metadata:', error);
      throw new Error(`Failed to fetch view metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Legacy methods for compatibility (these will return empty results since we're using actual MSSQL data)
  async getCustomers(): Promise<Customer[]> {
    const result = await this.executeQuery('SELECT TOP 100 * FROM customers ORDER BY id');
    return result.rows as Customer[];
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const result = await this.executeQuery(`SELECT * FROM customers WHERE id = ${id}`);
    return result.rows[0] as Customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    throw new Error('Create operations not implemented for production database');
  }

  async getProducts(): Promise<Product[]> {
    const result = await this.executeQuery('SELECT TOP 100 * FROM products ORDER BY id');
    return result.rows as Product[];
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await this.executeQuery(`SELECT * FROM products WHERE id = ${id}`);
    return result.rows[0] as Product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    throw new Error('Create operations not implemented for production database');
  }

  async getOrders(): Promise<Order[]> {
    const result = await this.executeQuery('SELECT TOP 100 * FROM orders ORDER BY id');
    return result.rows as Order[];
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await this.executeQuery(`SELECT * FROM orders WHERE id = ${id}`);
    return result.rows[0] as Order;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    throw new Error('Create operations not implemented for production database');
  }

  async getSalesReps(): Promise<SalesRep[]> {
    const result = await this.executeQuery('SELECT TOP 100 * FROM sales_reps ORDER BY id');
    return result.rows as SalesRep[];
  }

  async getSalesRep(id: number): Promise<SalesRep | undefined> {
    const result = await this.executeQuery(`SELECT * FROM sales_reps WHERE id = ${id}`);
    return result.rows[0] as SalesRep;
  }

  async createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep> {
    throw new Error('Create operations not implemented for production database');
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }
}