import Groq from "groq-sdk";
import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateSqlQuery(
  request: SqlQueryRequest,
): Promise<SqlQueryResponse> {
  try {
    // Debug: Log the request to see what data is being sent from UI
    console.log("🔍 Query Request:", JSON.stringify(request, null, 2));
    
    // Get actual database schema
    const tableMetadata = await storage.getTableMetadata();

    // Get rules configuration from global storage
    const rulesConfig = (global as any).rulesConfig || {
      businessRules: [],
      queryConfig: {
        companyIdField: "company_id",
        typeStatusValue: 200,
        excludeTablePatterns: ["_copy"],
        defaultConditions: ["company_id IS NOT NULL", "typestatus = 200"],
      },
    };

    // Build the actual SQL query based on the request parameters
    let sqlQuery = "SELECT ";
    
    // Handle DISTINCT
    if (request.distinct) {
      sqlQuery += "DISTINCT ";
    }
    
    // Handle TOP clause only if limit is specified
    if (request.limit && request.limit > 0) {
      sqlQuery += `TOP ${request.limit} `;
    }
    
    // Build column list
    let columns: string[] = [];
    
    // Add aggregation columns
    if (request.aggregationColumns && request.aggregationColumns.length > 0) {
      request.aggregationColumns.forEach(agg => {
        const alias = agg.alias ? ` AS [${agg.alias}]` : "";
        columns.push(`${agg.function}([${agg.column}])${alias}`);
      });
    }
    
    // Add selected columns
    if (request.selectedColumns && Object.keys(request.selectedColumns).length > 0) {
      Object.entries(request.selectedColumns).forEach(([tableName, tableColumns]) => {
        tableColumns.forEach(column => {
          // Only add if not already in aggregation columns
          const isAggregated = request.aggregationColumns?.some(agg => 
            agg.column === `${tableName}.${column}` || agg.column === column
          );
          if (!isAggregated) {
            columns.push(`[${tableName}].[${column}]`);
          }
        });
      });
    }
    
    // If no columns specified, use *
    if (columns.length === 0) {
      columns.push("*");
    }
    
    sqlQuery += columns.join(", ");
    
    // FROM clause
    sqlQuery += `\nFROM [${request.selectedTables[0]}]`;
    
    // Handle multiple tables with JOINs (simplified - inner join for now)
    if (request.selectedTables.length > 1) {
      for (let i = 1; i < request.selectedTables.length; i++) {
        sqlQuery += `\nINNER JOIN [${request.selectedTables[i]}] ON 1=1`; // Placeholder join
      }
    }
    
    // WHERE clause - always include mandatory conditions
    let whereConditions = [...rulesConfig.queryConfig.defaultConditions];
    
    // Add custom filter conditions
    if (request.filterConditions && request.filterConditions.length > 0) {
      request.filterConditions.forEach(filter => {
        let condition = `[${filter.column}] ${filter.operator}`;
        
        if (filter.operator === "BETWEEN" && filter.value && filter.value2) {
          condition += ` ${filter.value} AND ${filter.value2}`;
        } else if (filter.operator === "IN" || filter.operator === "NOT IN") {
          const values = Array.isArray(filter.value) ? filter.value : [filter.value];
          condition += ` (${values.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')})`;
        } else if (filter.operator === "IS NULL" || filter.operator === "IS NOT NULL") {
          // No value needed
        } else if (filter.operator === "LIKE") {
          condition += ` '%${filter.value}%'`;
        } else if (filter.value !== undefined) {
          condition += typeof filter.value === 'string' ? ` '${filter.value}'` : ` ${filter.value}`;
        }
        
        whereConditions.push(condition);
      });
    }
    
    sqlQuery += `\nWHERE ${whereConditions.join(" AND ")}`;
    
    // GROUP BY clause
    if (request.groupByColumns && request.groupByColumns.length > 0) {
      sqlQuery += `\nGROUP BY ${request.groupByColumns.map(col => `[${col}]`).join(", ")}`;
    }
    
    // ORDER BY clause
    if (request.sortColumns && request.sortColumns.length > 0) {
      const orderBy = request.sortColumns.map(sort => `[${sort.column}] ${sort.direction}`).join(", ");
      sqlQuery += `\nORDER BY ${orderBy}`;
    }

    // Debug: Log the generated SQL
    console.log("🔍 Generated SQL:", sqlQuery);

    return {
      sql: sqlQuery,
      naturalLanguage: request.naturalLanguageQuery,
    };
  } catch (error) {
    console.error("SQL generation error:", error);
    return {
      sql: "",
      naturalLanguage: request.naturalLanguageQuery,
      error: "Failed to generate SQL query. Please check your configuration and try again.",
    };
  }
}
