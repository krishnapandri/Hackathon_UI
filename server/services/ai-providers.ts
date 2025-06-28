import { SqlQueryRequest, SqlQueryResponse } from "@shared/schema";
import { storage } from "../storage";
import { simpleQueryValidator } from "./query-validator-simple";
import dotenv from "dotenv";
dotenv.config();

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  free: boolean;
  requiresKey: boolean;
  keyName?: string;
}

export interface AIProvider {
  name: string;
  baseUrl: string;
  models: AIModel[];
  generateQuery: (request: SqlQueryRequest, model: string) => Promise<SqlQueryResponse>;
}

// Available AI Models
export const FREE_AI_MODELS: AIModel[] = [
  // Groq Models (Current)
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    provider: "groq",
    description: "Fast, high-quality responses for SQL generation",
    contextLength: 32768,
    free: false,
    requiresKey: true,
    keyName: "GROQ_API_KEY"
  },
  
  // Hugging Face Models (Free)
  {
    id: "microsoft/DialoGPT-large",
    name: "DialoGPT Large",
    provider: "huggingface",
    description: "Free conversational AI model",
    contextLength: 1024,
    free: true,
    requiresKey: true,
    keyName: "HUGGINGFACE_API_KEY"
  },
  {
    id: "meta-llama/Llama-2-7b-chat-hf",
    name: "Llama 2 7B Chat",
    provider: "huggingface",
    description: "Free Meta Llama 2 model for chat",
    contextLength: 4096,
    free: true,
    requiresKey: true,
    keyName: "HUGGINGFACE_API_KEY"
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.1",
    name: "Mistral 7B Instruct",
    provider: "huggingface",
    description: "Free Mistral instruction-following model",
    contextLength: 8192,
    free: true,
    requiresKey: true,
    keyName: "HUGGINGFACE_API_KEY"
  },
  
  // OpenRouter Models (Free tier)
  {
    id: "microsoft/phi-3-mini-4k-instruct:free",
    name: "Phi-3 Mini 4K",
    provider: "openrouter",
    description: "Free Microsoft Phi-3 model",
    contextLength: 4096,
    free: true,
    requiresKey: true,
    keyName: "OPENROUTER_API_KEY"
  },
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    name: "Llama 3.2 3B",
    provider: "openrouter",
    description: "Free Llama 3.2 model",
    contextLength: 131072,
    free: true,
    requiresKey: true,
    keyName: "OPENROUTER_API_KEY"
  },
  {
    id: "qwen/qwen-2-7b-instruct:free",
    name: "Qwen 2 7B",
    provider: "openrouter",
    description: "Free Qwen 2 instruction model",
    contextLength: 32768,
    free: true,
    requiresKey: true,
    keyName: "OPENROUTER_API_KEY"
  },
  
  // Local/Offline Models (Always Free)
  {
    id: "local-template",
    name: "Template Generator",
    provider: "local",
    description: "Rule-based SQL template generator (no API required)",
    contextLength: 0,
    free: true,
    requiresKey: false
  }
];

// Groq Provider (existing)
export async function generateGroqQuery(
  request: SqlQueryRequest,
  model: string = "llama-3.3-70b-versatile"
): Promise<SqlQueryResponse> {
  const Groq = (await import("groq-sdk")).default;
  
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required");
  }
  
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const tableMetadata = await storage.getTableMetadata();
  const rulesConfig = (global as any).rulesConfig || {
    businessRules: [],
    queryConfig: {
      companyIdField: "CompanyPincode",
      typeStatusValue: 200,
      excludeTablePatterns: ["_copy"],
      defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
    },
  };

  const systemPrompt = buildSystemPrompt(tableMetadata, rulesConfig);
  const userPrompt = `Generate SQL Server T-SQL query for: ${request.naturalLanguageQuery}`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: model,
    temperature: 0.1,
    max_tokens: 2000,
  });

  const sql = completion.choices[0]?.message?.content?.trim() || "";
  const cleanSql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim();

  // Comprehensive query validation and correction
  const validationResult = await simpleQueryValidator.validateAndCorrectQuery(cleanSql, request);
  
  let finalSql = validationResult.correctedQuery || cleanSql;
  let responseWithWarnings = request.naturalLanguageQuery;
  
  // Add validation warnings to response if any
  if (validationResult.warnings.length > 0) {
    console.log("🔧 Groq query validation warnings:", validationResult.warnings);
    responseWithWarnings += ` (Note: ${validationResult.warnings.join(', ')})`;
  }
  
  console.log("✅ Groq final validated SQL:", finalSql);

  return {
    sql: finalSql,
    naturalLanguage: responseWithWarnings,
  };
}

// Hugging Face Provider
export async function generateHuggingFaceQuery(
  request: SqlQueryRequest,
  model: string = "meta-llama/Llama-2-7b-chat-hf"
): Promise<SqlQueryResponse> {
  if (!process.env.HUGGINGFACE_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY is required");
  }

  const { HfInference } = await import("@huggingface/inference");
  const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

  const tableMetadata = await storage.getTableMetadata();
  const rulesConfig = (global as any).rulesConfig || {
    businessRules: [],
    queryConfig: {
      companyIdField: "CompanyPincode",
      typeStatusValue: 200,
      excludeTablePatterns: ["_copy"],
      defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
    },
  };

  const systemPrompt = buildSystemPrompt(tableMetadata, rulesConfig);
  const userPrompt = `Generate SQL Server T-SQL query for: ${request.naturalLanguageQuery}`;

  try {
    const response = await hf.textGeneration({
      model: model,
      inputs: `${systemPrompt}\n\nUser: ${userPrompt}\nAssistant: `,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.1,
        return_full_text: false,
      },
    });

    let sql = "";
    if (typeof response.generated_text === 'string') {
      sql = response.generated_text.trim();
    }

    const cleanSql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim();

    // Comprehensive query validation and correction
    const validationResult = await simpleQueryValidator.validateAndCorrectQuery(cleanSql, request);
    
    let finalSql = validationResult.correctedQuery || cleanSql;
    let responseWithWarnings = request.naturalLanguageQuery;
    
    // Add validation warnings to response if any
    if (validationResult.warnings.length > 0) {
      console.log("🔧 HuggingFace query validation warnings:", validationResult.warnings);
      responseWithWarnings += ` (Note: ${validationResult.warnings.join(', ')})`;
    }
    
    console.log("✅ HuggingFace final validated SQL:", finalSql);

    return {
      sql: finalSql,
      naturalLanguage: responseWithWarnings,
    };
  } catch (error) {
    console.error("Hugging Face API error:", error);
    throw new Error(`Hugging Face generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// OpenRouter Provider
export async function generateOpenRouterQuery(
  request: SqlQueryRequest,
  model: string = "microsoft/phi-3-mini-4k-instruct:free"
): Promise<SqlQueryResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  const tableMetadata = await storage.getTableMetadata();
  const rulesConfig = (global as any).rulesConfig || {
    businessRules: [],
    queryConfig: {
      companyIdField: "CompanyPincode",
      typeStatusValue: 200,
      excludeTablePatterns: ["_copy"],
      defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
    },
  };

  const systemPrompt = buildSystemPrompt(tableMetadata, rulesConfig);
  const userPrompt = `Generate SQL Server T-SQL query for: ${request.naturalLanguageQuery}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "SQL Query Builder",
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  const sql = data.choices[0]?.message?.content?.trim() || "";
  const cleanSql = sql.replace(/```sql\n?/g, "").replace(/```\n?/g, "").trim();

  // Comprehensive query validation and correction
  const validationResult = await simpleQueryValidator.validateAndCorrectQuery(cleanSql, request);
  
  let finalSql = validationResult.correctedQuery || cleanSql;
  let responseWithWarnings = request.naturalLanguageQuery;
  
  // Add validation warnings to response if any
  if (validationResult.warnings.length > 0) {
    console.log("🔧 OpenRouter query validation warnings:", validationResult.warnings);
    responseWithWarnings += ` (Note: ${validationResult.warnings.join(', ')})`;
  }
  
  console.log("✅ OpenRouter final validated SQL:", finalSql);

  return {
    sql: finalSql,
    naturalLanguage: responseWithWarnings,
  };
}

// Local Template Generator (Always Free)
export async function generateLocalTemplate(
  request: SqlQueryRequest
): Promise<SqlQueryResponse> {
  const tableMetadata = await storage.getTableMetadata();
  const rulesConfig = (global as any).rulesConfig || {
    businessRules: [],
    queryConfig: {
      companyIdField: "CompanyPincode",
      typeStatusValue: 200,
      excludeTablePatterns: ["_copy"],
      defaultConditions: ["CompanyTypeStatus IS NOT NULL", "SalesTypeStatus = 200"],
    },
  };

  // Simple template-based SQL generation
  const query = request.naturalLanguageQuery.toLowerCase();
  let sql = "";

  if (query.includes("profit") && query.includes("margin")) {
    sql = `SELECT s.ItemCode, s.ItemDescription, 
    CASE 
        WHEN s.SalesFinalSaleRate > 0 THEN 
            (s.SalesFinalSaleRate - ISNULL(s.SalesPurchaseCost, 0)) / s.SalesFinalSaleRate * 100.0 
        ELSE 0 
    END AS ProfitMargin
FROM Sales s
WHERE s.CompanyTypeStatus IS NOT NULL 
    AND s.SalesTypeStatus = 200 
    AND s.SalesFinalSaleRate > 0
ORDER BY ProfitMargin DESC`;
  } else if (query.includes("sales") || query.includes("revenue") || query.includes("amount")) {
    sql = `SELECT s.ItemCode, s.ItemDescription, SUM(s.SalesProductTotalAmount) AS TotalSalesAmount
FROM Sales s
WHERE s.CompanyTypeStatus IS NOT NULL AND s.SalesTypeStatus = 200
GROUP BY s.ItemCode, s.ItemDescription
ORDER BY TotalSalesAmount DESC`;
  } else if (query.includes("stock") || query.includes("inventory")) {
    if (query.includes("color") && (query.includes("group") || query.includes("item"))) {
      // Specific handling for item and color grouping with stock
      sql = `SELECT st.ItemCode, st.ItemDescription, st.ColorName, SUM(st.StockQty) AS CurrentStockQty
FROM Stock st
WHERE st.CompanyTypeStatus IS NOT NULL AND st.StockTypeStatus = 200
GROUP BY st.ItemCode, st.ItemDescription, st.ColorName
ORDER BY CurrentStockQty DESC`;
    } else {
      sql = `SELECT st.ItemCode, st.ItemDescription, SUM(st.StockQty) AS TotalStock
FROM Stock st
WHERE st.CompanyTypeStatus IS NOT NULL AND st.StockTypeStatus = 200
GROUP BY st.ItemCode, st.ItemDescription
ORDER BY TotalStock DESC`;
    }
  } else if (query.includes("customer") || query.includes("client")) {
    sql = `SELECT s.CustomerName, COUNT(*) AS OrderCount, SUM(s.SalesProductTotalAmount) AS TotalAmount
FROM Sales s
WHERE s.CompanyTypeStatus IS NOT NULL AND s.SalesTypeStatus = 200
GROUP BY s.CustomerName
ORDER BY TotalAmount DESC`;
  } else {
    // Default query
    sql = `SELECT TOP 100 *
FROM Sales s
WHERE s.CompanyTypeStatus IS NOT NULL AND s.SalesTypeStatus = 200
ORDER BY s.SalesDate DESC`;
  }

  // Comprehensive query validation and correction
  const validationResult = await simpleQueryValidator.validateAndCorrectQuery(sql, request);
  
  let finalSql = validationResult.correctedQuery || sql;
  let responseWithWarnings = request.naturalLanguageQuery;
  
  // Add validation warnings to response if any
  if (validationResult.warnings.length > 0) {
    console.log("🔧 Local template validation warnings:", validationResult.warnings);
    responseWithWarnings += ` (Note: ${validationResult.warnings.join(', ')})`;
  }
  
  console.log("✅ Local template final validated SQL:", finalSql);

  return {
    sql: finalSql,
    naturalLanguage: responseWithWarnings,
  };
}

// System prompt builder (shared across providers)  
function buildSystemPrompt(tableMetadata: any, rulesConfig: any): string {
  let schemaDescription = "Database Schema (Microsoft SQL Server Views):\n";
  tableMetadata.tables.forEach((view: any) => {
    schemaDescription += `\n- ${view.name} (View - query with WHERE 1=2 for structure):\n`;
    view.columns.forEach((column: any) => {
      schemaDescription += `  • ${column.name}: ${column.type}\n`;
    });
  });

  let businessRulesContext = `
Business Rules and Context:
`;

  rulesConfig.businessRules.forEach((rule: any, index: number) => {
    if (rule.isActive) {
      businessRulesContext += `${index + 1}. ${rule.name}: ${rule.description}\n   Formula: ${rule.formula}\n`;
    }
  });

  businessRulesContext += `
Additional Rules:
- Financial Calculations: Always handle NULL values appropriately using ISNULL() or COALESCE()
- Division Operations: ALWAYS use NULLIF() to prevent divide by zero errors (e.g., value1/NULLIF(value2,0))
- Mathematical Safety: Use CASE WHEN statements to check for zero denominators before division
- Date Handling: Use SQL Server date functions (GETDATE(), DATEADD(), DATEDIFF(), etc.)
- Performance: Consider using appropriate indexes and limit result sets with TOP clause
- Aggregations: Use SUM(), AVG(), COUNT(), MIN(), MAX() for financial metrics
- String Operations: Use SQL Server string functions (CONCAT(), SUBSTRING(), LEN(), etc.)
- Conditional Logic: Use CASE WHEN statements for complex business logic
- Error Prevention: Always validate data before mathematical operations
- Example Safe Division: CASE WHEN SalesFinalSaleRate > 0 THEN (SalesFinalSaleRate - SalesPurchaseCost) / SalesFinalSaleRate * 100 ELSE 0 END
- Window Functions: Use ROW_NUMBER(), RANK(), PARTITION BY for analytical queries
- Data Types: Handle DECIMAL/NUMERIC for financial calculations properly

Mandatory Query Constraints:
- ALWAYS include WHERE clause with: ${rulesConfig.queryConfig.defaultConditions.join(" AND ")}
- NEVER use tables matching patterns: ${rulesConfig.queryConfig.excludeTablePatterns.join(", ")}
- Company ID field: ${rulesConfig.queryConfig.companyIdField}
- Type Status value: ${rulesConfig.queryConfig.typeStatusValue}

SQL Server Specific Syntax:
- Use [square brackets] for table/column names with spaces or reserved words
- Use TOP N instead of LIMIT N
- Use ISNULL(column, default_value) for NULL handling
- Use CONCAT() or + for string concatenation
- Use CAST() or CONVERT() for data type conversions
- Use appropriate SQL Server date formats and functions

STOCK ANALYSIS QUERY PATTERNS:
For stock grouping queries (item, color, quantity):
- Always use Stock view for current stock quantities
- Common stock columns: ItemCode, ItemDescription, ColorName, StockQty, CategoryName
- For grouping by item and color: GROUP BY ItemCode, ItemDescription, ColorName
- Use SUM(StockQty) for total stock quantities when grouping
- Sample pattern: SELECT ItemCode, ItemDescription, ColorName, SUM(StockQty) AS CurrentStockQty FROM Stock WHERE ... GROUP BY ItemCode, ItemDescription, ColorName
- For stock levels by category: GROUP BY CategoryName, ItemCode
- Always include proper WHERE conditions for Stock view: CompanyTypeStatus IS NOT NULL AND StockTypeStatus = 200
`;

  return `You are an expert Microsoft SQL Server query generator. Generate valid T-SQL queries based on natural language requests.

${schemaDescription}

${businessRulesContext}

CRITICAL RULES - MUST BE FOLLOWED:
- Generate only SELECT queries for data analysis
- ALWAYS include WHERE clause with mandatory conditions, using proper table prefixes
- You are working with VIEWS, not tables - all schema objects are views
- NEVER query views containing patterns: ${rulesConfig.queryConfig.excludeTablePatterns.join(", ")}
- Use proper SQL Server T-SQL syntax for views
- Include appropriate JOINs when querying multiple views
- Handle date/time queries with SQL Server functions
- Use aggregation functions when requested (SUM, AVG, COUNT, etc.)
- Use [square brackets] for view/column names when needed
- Handle NULL values appropriately with ISNULL() or COALESCE()
- For matrix queries, generate proper pivot/unpivot or case statements
- Use ORDER BY for sorted results
- Consider using window functions for analytical queries
- NEVER use TOP clause unless the user explicitly requests a specific number (like "top 5", "first 10", "limit to 20")
- When user says "highest" or "lowest" without a number, use ORDER BY without TOP clause

MATHEMATICAL OPERATION SAFETY (CRITICAL):
- ALWAYS prevent divide by zero errors using NULLIF(denominator, 0)
- Use CASE WHEN for complex mathematical validations
- Example safe profit margin: CASE WHEN s.SalesFinalSaleRate > 0 THEN (s.SalesFinalSaleRate - s.SalesPurchaseCost) / s.SalesFinalSaleRate * 100 ELSE 0 END
- Alternative safe division: (s.SalesFinalSaleRate - s.SalesPurchaseCost) / NULLIF(s.SalesFinalSaleRate, 0) * 100
- For percentage calculations, multiply by 100.0 (not 100) to force decimal precision
- Always validate denominators before any division operation
- Use TRY_CAST() when converting data types that might fail

MANDATORY WHERE CONDITIONS:
When querying Sales view: WHERE s.CompanyTypeStatus IS NOT NULL AND s.SalesTypeStatus = 200
When querying Stock view: WHERE st.CompanyTypeStatus IS NOT NULL AND st.StockTypeStatus = 200  
When querying SalesReturn view: WHERE sr.CompanyTypeStatus IS NOT NULL AND sr.SalesReturnTypeStatus = 200
Always use proper table aliases and prefix column names with the alias.

QUERY STRUCTURE TEMPLATE:
SELECT [columns with table prefixes]
FROM [view_name] alias
WHERE alias.CompanyTypeStatus IS NOT NULL AND alias.[ViewType]Status = 200
  AND [additional_conditions]
[ORDER BY clause]

IMPORTANT: Only add TOP N if user explicitly mentions:
- "top 5", "first 10", "limit 20", "show me 15", etc.
- DO NOT add TOP when user says "highest", "lowest", "best", "worst" without a number

Return only valid T-SQL without explanations or markdown formatting.`;
}

// Main query generation function with model selection
export async function generateQueryWithModel(
  request: SqlQueryRequest,
  modelId: string = "llama-3.3-70b-versatile"
): Promise<SqlQueryResponse> {
  const model = FREE_AI_MODELS.find(m => m.id === modelId);
  
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }

  try {
    switch (model.provider) {
      case "groq":
        return await generateGroqQuery(request, model.id);
      case "huggingface":
        return await generateHuggingFaceQuery(request, model.id);
      case "openrouter":
        return await generateOpenRouterQuery(request, model.id);
      case "local":
        return await generateLocalTemplate(request);
      default:
        throw new Error(`Provider ${model.provider} not supported`);
    }
  } catch (error) {
    console.error(`Error with ${model.provider} provider:`, error);
    
    // Fallback to local template generator
    if (model.provider !== "local") {
      console.log("Falling back to local template generator");
      return await generateLocalTemplate(request);
    }
    
    throw error;
  }
}

// Get available models (filter by what API keys are available)
export function getAvailableModels(): AIModel[] {
  return FREE_AI_MODELS.filter(model => {
    if (!model.requiresKey) return true;
    if (model.keyName && process.env[model.keyName]) return true;
    return false;
  });
}