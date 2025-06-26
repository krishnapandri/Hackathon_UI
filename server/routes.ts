import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateSqlQuery } from "./services/openai";
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

  // Export query results (placeholder for CSV/Excel export)
  app.post("/api/export-results", async (req, res) => {
    try {
      const { format, data } = req.body;
      
      if (format === "csv") {
        // Generate CSV format
        const csvData = data.rows.map((row: any) => 
          data.columns.map((col: string) => row[col] || "").join(",")
        ).join("\n");
        
        const header = data.columns.join(",");
        const csv = header + "\n" + csvData;
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=query-results.csv");
        res.send(csv);
      } else {
        res.status(400).json({ error: "Unsupported export format" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to export results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
