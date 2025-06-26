import { 
  Customer, Product, Order, SalesRep,
  InsertCustomer, InsertProduct, InsertOrder, InsertSalesRep,
  QueryExecutionResult
} from "@shared/schema";

export interface IStorage {
  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  // Product operations
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;

  // Order operations
  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;

  // Sales rep operations
  getSalesReps(): Promise<SalesRep[]>;
  getSalesRep(id: number): Promise<SalesRep | undefined>;
  createSalesRep(salesRep: InsertSalesRep): Promise<SalesRep>;

  // Query execution
  executeQuery(sql: string): Promise<QueryExecutionResult>;
  
  // Table metadata
  getTableMetadata(): Promise<{
    tables: Array<{
      name: string;
      recordCount: number;
      columns: Array<{
        name: string;
        type: string;
      }>;
    }>;
  }>;
}

export class MemStorage implements IStorage {
  private customers: Map<number, Customer> = new Map();
  private products: Map<number, Product> = new Map();
  private orders: Map<number, Order> = new Map();
  private salesReps: Map<number, SalesRep> = new Map();
  private currentCustomerId = 1;
  private currentProductId = 1;
  private currentOrderId = 1;
  private currentSalesRepId = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Seed customers
    const customers: InsertCustomer[] = [
      { name: "John Smith", email: "john.smith@email.com", phone: "555-0101", address: "123 Main St" },
      { name: "Sarah Johnson", email: "sarah.j@email.com", phone: "555-0102", address: "456 Oak Ave" },
      { name: "Mike Davis", email: "mike.davis@email.com", phone: "555-0103", address: "789 Pine Rd" },
    ];

    customers.forEach(customer => {
      this.createCustomer(customer);
    });

    // Seed products
    const products: InsertProduct[] = [
      { name: "Wireless Headphones", category: "Electronics", price: "149.99", description: "High-quality wireless headphones" },
      { name: "Smart Watch", category: "Electronics", price: "299.99", description: "Advanced fitness tracking smartwatch" },
      { name: "Gaming Laptop", category: "Computers", price: "1299.99", description: "High-performance gaming laptop" },
      { name: "Office Chair", category: "Furniture", price: "249.99", description: "Ergonomic office chair" },
    ];

    products.forEach(product => {
      this.createProduct(product);
    });

    // Seed orders
    const orders: InsertOrder[] = [
      { customerId: 1, productId: 1, orderDate: new Date("2024-01-15"), totalAmount: "149.99", status: "completed" },
      { customerId: 2, productId: 2, orderDate: new Date("2024-01-14"), totalAmount: "299.99", status: "shipped" },
      { customerId: 1, productId: 3, orderDate: new Date("2024-01-13"), totalAmount: "1299.99", status: "processing" },
      { customerId: 3, productId: 4, orderDate: new Date("2024-01-12"), totalAmount: "249.99", status: "completed" },
    ];

    orders.forEach(order => {
      this.createOrder(order);
    });

    // Seed sales reps
    const salesReps: InsertSalesRep[] = [
      { name: "Alice Cooper", email: "alice.cooper@company.com", territory: "North", commission: "5.5" },
      { name: "Bob Wilson", email: "bob.wilson@company.com", territory: "South", commission: "6.0" },
    ];

    salesReps.forEach(salesRep => {
      this.createSalesRep(salesRep);
    });
  }

  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.currentCustomerId++;
    const customer: Customer = { 
      ...insertCustomer, 
      id,
      phone: insertCustomer.phone ?? null,
      address: insertCustomer.address ?? null
    };
    this.customers.set(id, customer);
    return customer;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const product: Product = { 
      ...insertProduct, 
      id,
      description: insertProduct.description ?? null
    };
    this.products.set(id, product);
    return product;
  }

  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const order: Order = { 
      ...insertOrder, 
      id,
      customerId: insertOrder.customerId ?? null,
      productId: insertOrder.productId ?? null
    };
    this.orders.set(id, order);
    return order;
  }

  async getSalesReps(): Promise<SalesRep[]> {
    return Array.from(this.salesReps.values());
  }

  async getSalesRep(id: number): Promise<SalesRep | undefined> {
    return this.salesReps.get(id);
  }

  async createSalesRep(insertSalesRep: InsertSalesRep): Promise<SalesRep> {
    const id = this.currentSalesRepId++;
    const salesRep: SalesRep = { 
      ...insertSalesRep, 
      id,
      territory: insertSalesRep.territory ?? null,
      commission: insertSalesRep.commission ?? null
    };
    this.salesReps.set(id, salesRep);
    return salesRep;
  }

  async executeQuery(sql: string): Promise<QueryExecutionResult> {
    // Simulate query execution with mock results
    const startTime = Date.now();
    
    // This is a simplified simulation - in a real implementation,
    // you would parse and execute the SQL against the actual data
    const mockResults = [
      { order_id: 1, order_date: "2024-01-15", total_amount: "$149.99", product_name: "Wireless Headphones", category: "Electronics", order_count: 1 },
      { order_id: 2, order_date: "2024-01-14", total_amount: "$299.99", product_name: "Smart Watch", category: "Electronics", order_count: 1 },
      { order_id: 3, order_date: "2024-01-13", total_amount: "$1299.99", product_name: "Gaming Laptop", category: "Computers", order_count: 1 },
      { order_id: 4, order_date: "2024-01-12", total_amount: "$249.99", product_name: "Office Chair", category: "Furniture", order_count: 1 },
    ];

    const executionTime = Date.now() - startTime;

    return {
      columns: Object.keys(mockResults[0] || {}),
      rows: mockResults,
      totalCount: mockResults.length,
      executionTime,
    };
  }

  async getTableMetadata(): Promise<{
    tables: Array<{
      name: string;
      recordCount: number;
      columns: Array<{
        name: string;
        type: string;
      }>;
    }>;
  }> {
    return {
      tables: [
        {
          name: "customers",
          recordCount: this.customers.size,
          columns: [
            { name: "id", type: "INTEGER" },
            { name: "name", type: "TEXT" },
            { name: "email", type: "TEXT" },
            { name: "phone", type: "TEXT" },
            { name: "address", type: "TEXT" },
          ],
        },
        {
          name: "orders",
          recordCount: this.orders.size,
          columns: [
            { name: "id", type: "INTEGER" },
            { name: "customer_id", type: "INTEGER" },
            { name: "product_id", type: "INTEGER" },
            { name: "order_date", type: "TIMESTAMP" },
            { name: "total_amount", type: "DECIMAL" },
            { name: "status", type: "TEXT" },
          ],
        },
        {
          name: "products",
          recordCount: this.products.size,
          columns: [
            { name: "id", type: "INTEGER" },
            { name: "name", type: "TEXT" },
            { name: "category", type: "TEXT" },
            { name: "price", type: "DECIMAL" },
            { name: "description", type: "TEXT" },
          ],
        },
        {
          name: "sales_reps",
          recordCount: this.salesReps.size,
          columns: [
            { name: "id", type: "INTEGER" },
            { name: "name", type: "TEXT" },
            { name: "email", type: "TEXT" },
            { name: "territory", type: "TEXT" },
            { name: "commission", type: "DECIMAL" },
          ],
        },
      ],
    };
  }
}

export const storage = new MemStorage();
