import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateSqlQuery } from "./services/groq";
import { sqlQueryRequest } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get table metadata
  app.get("/api/tables", async (req, res) => {
    try {
      const metadata = await storage.getTableMetadata();
      res.json(metadata);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table metadata" });
    }
  });

  // Generate SQL query using LLM
  app.post("/api/generate-query", async (req, res) => {
    try {
      const validatedRequest = sqlQueryRequest.parse(req.body);
      const result = await generateSqlQuery(validatedRequest);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Invalid request format" });
      } else {
        res.status(500).json({ error: "Failed to generate SQL query" });
      }
    }
  });

  // Generate SQL query using LLM (alternative endpoint)
  app.post("/api/generate-sql", async (req, res) => {
    try {
      const validatedRequest = sqlQueryRequest.parse(req.body);
      const result = await generateSqlQuery(validatedRequest);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Invalid request format" });
      } else {
        res.status(500).json({ error: "Failed to generate SQL query" });
      }
    }
  });

  // Execute SQL query
  app.post("/api/execute-query", async (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql || typeof sql !== "string") {
        return res.status(400).json({ error: "SQL query is required" });
      }

      const result = await storage.executeQuery(sql);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute query" });
    }
  });

  // Validate SQL query
  app.post("/api/validate-query", async (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql || typeof sql !== "string") {
        return res.status(400).json({ error: "SQL query is required" });
      }

      // Basic SQL validation (production would use a proper SQL parser)
      const validationErrors = [];
      const sqlLower = sql.toLowerCase().trim();
      
      // Check for dangerous operations
      if (sqlLower.includes("drop") || sqlLower.includes("delete") || sqlLower.includes("update") || sqlLower.includes("insert")) {
        validationErrors.push("Write operations are not allowed");
      }
      
      // Check for basic syntax
      if (!sqlLower.startsWith("select")) {
        validationErrors.push("Only SELECT queries are allowed");
      }
      
      // Check for balanced parentheses
      const openParens = (sql.match(/\(/g) || []).length;
      const closeParens = (sql.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        validationErrors.push("Unbalanced parentheses in query");
      }

      res.json({
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        warnings: []
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate query" });
    }
  });

  // Get query execution plan
  app.post("/api/explain-query", async (req, res) => {
    try {
      const { sql } = req.body;
      if (!sql || typeof sql !== "string") {
        return res.status(400).json({ error: "SQL query is required" });
      }

      // Mock execution plan (in production, use EXPLAIN functionality)
      const plan = {
        estimatedRows: Math.floor(Math.random() * 1000) + 1,
        estimatedCost: Math.floor(Math.random() * 100) + 1,
        operations: [
          { operation: "Table Scan", table: "customers", cost: 10 },
          { operation: "Hash Join", tables: ["customers", "orders"], cost: 25 },
          { operation: "Sort", columns: ["order_date"], cost: 15 }
        ],
        recommendations: [
          "Consider adding an index on customer_id for better performance",
          "LIMIT clause will improve query performance"
        ]
      };

      res.json(plan);
    } catch (error) {
      res.status(500).json({ error: "Failed to explain query" });
    }
  });

  // Export query results with multiple formats
  app.post("/api/export-results", async (req, res) => {
    try {
      const { format, data } = req.body;
      
      if (format === "csv") {
        // Generate CSV format with proper escaping
        const csvData = data.rows.map((row: any) => 
          data.columns.map((col: string) => {
            const value = row[col] || "";
            // Escape quotes and wrap in quotes if contains comma
            return typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(",")
        ).join("\n");
        
        const header = data.columns.join(",");
        const csv = header + "\n" + csvData;
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=query-results.csv");
        res.send(csv);
      } else if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=query-results.json");
        res.json({
          metadata: {
            totalRows: data.totalCount,
            executionTime: data.executionTime,
            columns: data.columns
          },
          data: data.rows
        });
      } else {
        res.status(400).json({ error: "Unsupported export format" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to export results" });
    }
  });

  // Save query template
  app.post("/api/save-query", async (req, res) => {
    try {
      const { name, description, queryState, sql } = req.body;
      
      // In production, save to database
      const savedQuery = {
        id: Date.now().toString(),
        name,
        description,
        queryState,
        sql,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };

      res.json(savedQuery);
    } catch (error) {
      res.status(500).json({ error: "Failed to save query" });
    }
  });

  // Get saved queries
  app.get("/api/saved-queries", async (req, res) => {
    try {
      // Mock saved queries (in production, fetch from database)
      const savedQueries = [
        {
          id: "1",
          name: "Monthly Sales Report",
          description: "Sales summary grouped by month",
          queryState: {},
          sql: "SELECT DATE_TRUNC('month', order_date) as month, SUM(total_amount) as total_sales FROM orders GROUP BY month ORDER BY month DESC",
          createdAt: "2024-01-15T10:30:00Z",
          lastModified: "2024-01-15T10:30:00Z"
        },
        {
          id: "2", 
          name: "Top Customers",
          description: "Customers with highest order values",
          queryState: {},
          sql: "SELECT c.name, SUM(o.total_amount) as total_spent FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY total_spent DESC LIMIT 10",
          createdAt: "2024-01-14T15:45:00Z",
          lastModified: "2024-01-14T15:45:00Z"
        }
      ];

      res.json({ queries: savedQueries });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved queries" });
    }
  });

  // Rules configuration endpoints
  app.get("/api/rules-config", async (req, res) => {
    try {
      // For now, return default configuration
      // In production, this would fetch from database
      const config = {
        businessRules: [
          {
            id: '1',
            name: 'Sales Amount Ratio',
            description: 'Calculate sales ratio between current and previous period',
            formula: '(Current_Period_Sales / Previous_Period_Sales) * 100',
            category: 'calculation',
            isActive: true
          },
          {
            id: '2',
            name: 'Matrix Generation',
            description: 'Generate 16x16 matrix for analytical purposes',
            formula: 'CASE WHEN ROW_NUMBER() OVER() <= 16 AND column_index <= 16 THEN value END',
            category: 'calculation',
            isActive: true
          }
        ],
        queryConfig: {
          companyIdField: 'company_id',
          typeStatusValue: 200,
          excludeTablePatterns: ['_copy'],
          defaultConditions: ['company_id IS NOT NULL', 'typestatus = 200']
        }
      };
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rules configuration" });
    }
  });

  app.post("/api/rules-config", async (req, res) => {
    try {
      const { businessRules, queryConfig } = req.body;
      
      // In production, save to database
      // For now, just validate and return success
      if (!businessRules || !queryConfig) {
        return res.status(400).json({ error: "Invalid configuration data" });
      }

      // Store configuration globally for use in query generation
      (global as any).rulesConfig = { businessRules, queryConfig };
      
      res.json({ success: true, message: "Configuration saved successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save rules configuration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
