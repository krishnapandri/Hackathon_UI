import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Database tables
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  productId: integer("product_id").references(() => products.id),
  orderDate: timestamp("order_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(),
});

export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  territory: text("territory"),
  commission: decimal("commission", { precision: 5, scale: 2 }),
});

// Query builder schemas
export const queryBuilderState = z.object({
  selectedTables: z.array(z.string()),
  selectedColumns: z.record(z.string(), z.array(z.string())),
  aggregationFunction: z.string().optional(),
  targetColumn: z.string().optional(),
  groupByColumns: z.array(z.string()),
});

export const sqlQueryRequest = z.object({
  naturalLanguageQuery: z.string(),
  selectedTables: z.array(z.string()),
  selectedColumns: z.record(z.string(), z.array(z.string())),
  aggregationFunction: z.string().optional(),
  targetColumn: z.string().optional(),
  groupByColumns: z.array(z.string()),
});

export const sqlQueryResponse = z.object({
  sql: z.string(),
  naturalLanguage: z.string(),
  error: z.string().optional(),
});

export const queryExecutionResult = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.any())),
  totalCount: z.number(),
  executionTime: z.number(),
});

export type QueryBuilderState = z.infer<typeof queryBuilderState>;
export type SqlQueryRequest = z.infer<typeof sqlQueryRequest>;
export type SqlQueryResponse = z.infer<typeof sqlQueryResponse>;
export type QueryExecutionResult = z.infer<typeof queryExecutionResult>;

export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type SalesRep = typeof salesReps.$inferSelect;

export type InsertCustomer = typeof customers.$inferInsert;
export type InsertProduct = typeof products.$inferInsert;
export type InsertOrder = typeof orders.$inferInsert;
export type InsertSalesRep = typeof salesReps.$inferInsert;
