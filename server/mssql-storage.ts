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

      // Get all tables with their column information, excluding _copy tables
      const tableQuery = `
        SELECT 
          t.TABLE_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.CHARACTER_MAXIMUM_LENGTH,
          c.NUMERIC_PRECISION,
          c.NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.TABLES t
        LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        AND t.TABLE_SCHEMA = 'dbo'
        AND t.TABLE_NAME NOT LIKE '%_copy%'
        AND t.TABLE_NAME NOT LIKE '%_Copy%'
        AND t.TABLE_NAME NOT LIKE '%_COPY%'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
      `;

      const result = await request.query(tableQuery);
      
      // Group by table name
      const tablesMap = new Map<string, MSSQLTableMetadata>();
      
      for (const row of result.recordset as any[]) {
        const tableName = row.TABLE_NAME;
        
        if (!tablesMap.has(tableName)) {
          // Get row count for this table
          const countRequest = pool.request();
          let recordCount = 0;
          try {
            const countResult = await countRequest.query(`SELECT COUNT(*) as count FROM [${tableName}]`);
            recordCount = countResult.recordset[0]?.count || 0;
          } catch (error) {
            console.warn(`Could not get count for table ${tableName}:`, error);
          }

          tablesMap.set(tableName, {
            name: tableName,
            recordCount,
            columns: []
          });
        }

        const table = tablesMap.get(tableName)!;
        if (row.COLUMN_NAME) {
          let dataType = row.DATA_TYPE;
          if (row.CHARACTER_MAXIMUM_LENGTH) {
            dataType += `(${row.CHARACTER_MAXIMUM_LENGTH})`;
          } else if (row.NUMERIC_PRECISION) {
            dataType += `(${row.NUMERIC_PRECISION}${row.NUMERIC_SCALE ? ',' + row.NUMERIC_SCALE : ''})`;
          }

          table.columns.push({
            name: row.COLUMN_NAME,
            type: dataType
          });
        }
      }

      return {
        tables: Array.from(tablesMap.values())
      };
    } catch (error) {
      console.error('Error fetching table metadata:', error);
      throw new Error(`Failed to fetch table metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
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