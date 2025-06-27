import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Database, 
  Table as TableIcon, 
  Columns, 
  Calculator, 
  Wand2, 
  Play, 
  RotateCcw, 
  Copy, 
  Download,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Filter
} from "lucide-react";
import type { QueryBuilderState, SqlQueryResponse, QueryExecutionResult } from "@shared/schema";

interface TableMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

export default function QueryBuilder() {
  const { toast } = useToast();
  const [queryState, setQueryState] = useState<QueryBuilderState>({
    selectedTables: [],
    selectedColumns: {},
    aggregationColumns: [],
    groupByColumns: [],
    filterConditions: [],
    sortColumns: [],
    distinct: false,
  });
  
  const [generatedQuery, setGeneratedQuery] = useState<SqlQueryResponse | null>(null);
  const [queryResults, setQueryResults] = useState<QueryExecutionResult | null>(null);
  const [naturalLanguagePreview, setNaturalLanguagePreview] = useState<string>("");
  
  // Enhanced filtering and search states
  const [columnSearch, setColumnSearch] = useState<string>("");
  const [aggregationSearch, setAggregationSearch] = useState<string>("");
  const [groupBySearch, setGroupBySearch] = useState<string>("");
  const [showTypeStatusOnly, setShowTypeStatusOnly] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Fetch table metadata
  const { data: tableData, isLoading: tablesLoading } = useQuery<{ tables: TableMetadata[] }>({
    queryKey: ["/api/tables"],
  });

  // Generate SQL query mutation
  const generateQueryMutation = useMutation({
    mutationFn: async (request: any) => {
      const response = await apiRequest("POST", "/api/generate-query", request);
      return response.json();
    },
    onSuccess: (data: SqlQueryResponse) => {
      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setGeneratedQuery(data);
        toast({
          title: "Success",
          description: "SQL query generated successfully",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate SQL query",
        variant: "destructive",
      });
    },
  });

  // Execute query mutation
  const executeQueryMutation = useMutation({
    mutationFn: async (sql: string) => {
      const response = await apiRequest("POST", "/api/execute-query", { sql });
      return response.json();
    },
    onSuccess: (data: QueryExecutionResult) => {
      setQueryResults(data);
      toast({
        title: "Success",
        description: `Query executed successfully. ${data.totalCount} rows returned.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to execute query",
        variant: "destructive",
      });
    },
  });

  // Update natural language preview
  useEffect(() => {
    if (queryState.selectedTables.length > 0) {
      const tableNames = queryState.selectedTables.join(", ");
      const columnCount = Object.values(queryState.selectedColumns).flat().length;
      const aggregation = queryState.aggregationColumns.length > 0 ? "Aggregated" : "SELECT";
      const groupBy = queryState.groupByColumns.length > 0 ? ` grouped by ${queryState.groupByColumns.join(", ")}` : "";
      
      setNaturalLanguagePreview(
        `${aggregation} data from ${tableNames} table${queryState.selectedTables.length > 1 ? "s" : ""} with ${columnCount} column${columnCount !== 1 ? "s" : ""}${groupBy}.`
      );
    } else {
      setNaturalLanguagePreview("Select tables and columns to see query description.");
    }
  }, [queryState]);

  const handleTableSelection = (tableName: string, checked: boolean) => {
    setQueryState(prev => {
      const newSelectedTables = checked 
        ? [...prev.selectedTables, tableName]
        : prev.selectedTables.filter(t => t !== tableName);
      
      const newSelectedColumns = { ...prev.selectedColumns };
      if (!checked) {
        delete newSelectedColumns[tableName];
      }
      
      return {
        ...prev,
        selectedTables: newSelectedTables,
        selectedColumns: newSelectedColumns,
      };
    });
  };

  const handleColumnSelection = (tableName: string, columnName: string, checked: boolean) => {
    setQueryState(prev => ({
      ...prev,
      selectedColumns: {
        ...prev.selectedColumns,
        [tableName]: checked
          ? [...(prev.selectedColumns[tableName] || []), columnName]
          : (prev.selectedColumns[tableName] || []).filter(c => c !== columnName),
      },
    }));
  };

  const handleGroupByToggle = (columnName: string) => {
    setQueryState(prev => ({
      ...prev,
      groupByColumns: prev.groupByColumns.includes(columnName)
        ? prev.groupByColumns.filter(c => c !== columnName)
        : [...prev.groupByColumns, columnName],
    }));
  };

  const handleGenerateQuery = () => {
    if (queryState.selectedTables.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one table",
        variant: "destructive",
      });
      return;
    }

    const request = {
      naturalLanguageQuery: naturalLanguagePreview,
      ...queryState,
    };

    generateQueryMutation.mutate(request);
  };

  const handleExecuteQuery = () => {
    if (!generatedQuery?.sql) {
      toast({
        title: "Error",
        description: "Please generate a query first",
        variant: "destructive",
      });
      return;
    }

    executeQueryMutation.mutate(generatedQuery.sql);
  };

  const handleReset = () => {
    setQueryState({
      selectedTables: [],
      selectedColumns: {},
      aggregationColumns: [],
      groupByColumns: [],
      filterConditions: [],
      sortColumns: [],
      distinct: false,
    });
    setGeneratedQuery(null);
    setQueryResults(null);
    setColumnSearch("");
    setAggregationSearch("");
    setGroupBySearch("");
    setShowTypeStatusOnly(false);
    setExpandedGroups({});
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Success",
        description: "Copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const exportResults = async (format: string) => {
    if (!queryResults) return;

    try {
      const response = await apiRequest("POST", "/api/export-results", {
        format,
        data: queryResults,
      });

      if (format === "csv") {
        const blob = new Blob([await response.text()], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "query-results.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: "Success",
        description: `Results exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export results",
        variant: "destructive",
      });
    }
  };

  const availableColumns = queryState.selectedTables.flatMap(tableName => {
    const table = tableData?.tables.find(t => t.name === tableName);
    return table?.columns.map(col => `${tableName}.${col.name}`) || [];
  });

  // Helper functions for column grouping and filtering
  const getColumnPrefix = (columnName: string): string => {
    // Extract prefix before common suffixes or camelCase patterns
    const patterns = [
      /^([a-zA-Z]+)(qty|Qty|QTY)$/i,
      /^([a-zA-Z]+)(amount|Amount|AMOUNT)$/i,
      /^([a-zA-Z]+)(price|Price|PRICE)$/i,
      /^([a-zA-Z]+)(date|Date|DATE)$/i,
      /^([a-zA-Z]+)(id|Id|ID)$/i,
      /^([a-zA-Z]+)(name|Name|NAME)$/i,
      /^([a-zA-Z]+)([A-Z][a-z]+)$/,
      /^([a-zA-Z]+)_/,
    ];
    
    for (const pattern of patterns) {
      const match = columnName.match(pattern);
      if (match) return match[1].toLowerCase();
    }
    
    // Fallback: return first 3-4 characters or whole word if short
    return columnName.length > 4 ? columnName.substring(0, 4).toLowerCase() : columnName.toLowerCase();
  };

  const groupColumnsByPrefix = (columns: Array<{name: string, type: string}>) => {
    const groups: Record<string, Array<{name: string, type: string}>> = {};
    const ungrouped: Array<{name: string, type: string}> = [];
    
    columns.forEach(column => {
      const prefix = getColumnPrefix(column.name);
      const matchingColumns = columns.filter(col => 
        getColumnPrefix(col.name) === prefix && col.name !== column.name
      );
      
      if (matchingColumns.length > 0) {
        if (!groups[prefix]) {
          groups[prefix] = [];
        }
        if (!groups[prefix].find(col => col.name === column.name)) {
          groups[prefix].push(column);
        }
      } else {
        ungrouped.push(column);
      }
    });
    
    return { groups, ungrouped };
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const filterColumns = (columns: Array<{name: string, type: string}>, searchTerm: string, typeStatusOnly: boolean) => {
    return columns.filter(col => 
      col.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (!typeStatusOnly || col.name.toLowerCase().includes('typestatus'))
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Database className="text-primary text-xl" />
              <h1 className="text-xl font-semibold text-neutral-800">SQL Query Builder</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Query Builder */}
          <div className="lg:col-span-2 space-y-6">
            {/* Table Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TableIcon className="text-primary mr-2" />
                  Select Tables
                </CardTitle>
                <p className="text-sm text-neutral-600">Choose the database tables you want to query</p>
              </CardHeader>
              <CardContent>
                {tablesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tableData?.tables.map((table) => (
                      <label key={table.name} className="flex items-center p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={queryState.selectedTables.includes(table.name)}
                          onCheckedChange={(checked) => handleTableSelection(table.name, checked as boolean)}
                          className="w-4 h-4"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium text-neutral-800">{table.name}</div>
                          <div className="text-xs text-neutral-500">{table.recordCount} records</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Column Selection */}
            {queryState.selectedTables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Columns className="text-primary mr-2" />
                    Select Columns
                  </CardTitle>
                  <p className="text-sm text-neutral-600">Choose columns from selected tables</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search columns..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTypeStatusOnly(!showTypeStatusOnly)}
                      className={showTypeStatusOnly ? "bg-blue-100 border-blue-300" : ""}
                    >
                      <Filter className="h-4 w-4 mr-1" />
                      TypeStatus
                    </Button>
                  </div>

                  {queryState.selectedTables.map((tableName) => {
                    const table = tableData?.tables.find(t => t.name === tableName);
                    if (!table) return null;

                    const filteredColumns = filterColumns(table.columns, columnSearch, showTypeStatusOnly);
                    const { groups, ungrouped } = groupColumnsByPrefix(filteredColumns);

                    return (
                      <div key={tableName} className="mb-6 last:mb-0">
                        <h3 className="text-sm font-medium text-neutral-700 mb-3 flex items-center">
                          <TableIcon className="text-neutral-400 mr-2 text-xs" />
                          {tableName}
                        </h3>

                        {/* Grouped columns with expand/collapse */}
                        {Object.entries(groups).map(([groupName, groupColumns]) => (
                          <div key={groupName} className="mb-4">
                            <div 
                              className="flex items-center cursor-pointer mb-2 p-2 bg-gray-50 rounded hover:bg-gray-100"
                              onClick={() => toggleGroupExpansion(`${tableName}-${groupName}`)}
                            >
                              {expandedGroups[`${tableName}-${groupName}`] ? (
                                <ChevronDown className="h-4 w-4 text-gray-500 mr-2" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500 mr-2" />
                              )}
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {groupName} ({groupColumns.length})
                              </span>
                            </div>
                            
                            {expandedGroups[`${tableName}-${groupName}`] && (
                              <div className="ml-6 grid grid-cols-2 md:grid-cols-3 gap-2">
                                {groupColumns.map((column) => (
                                  <label key={column.name} className="flex items-center text-sm">
                                    <Checkbox
                                      checked={(queryState.selectedColumns[tableName] || []).includes(column.name)}
                                      onCheckedChange={(checked) => handleColumnSelection(tableName, column.name, checked as boolean)}
                                      className="w-3 h-3"
                                    />
                                    <span className="ml-2 text-neutral-700">{column.name}</span>
                                    <span className="ml-1 text-xs text-neutral-400">({column.type})</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Ungrouped columns */}
                        {ungrouped.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {ungrouped.map((column) => (
                              <label key={column.name} className="flex items-center text-sm">
                                <Checkbox
                                  checked={(queryState.selectedColumns[tableName] || []).includes(column.name)}
                                  onCheckedChange={(checked) => handleColumnSelection(tableName, column.name, checked as boolean)}
                                  className="w-3 h-3"
                                />
                                <span className="ml-2 text-neutral-700">{column.name}</span>
                                <span className="ml-1 text-xs text-neutral-400">({column.type})</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Aggregation Functions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="text-primary mr-2" />
                  Aggregation Functions
                </CardTitle>
                <p className="text-sm text-neutral-600">Apply mathematical operations to your data</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search aggregation columns..."
                      value={aggregationSearch}
                      onChange={(e) => setAggregationSearch(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTypeStatusOnly(!showTypeStatusOnly)}
                      className={showTypeStatusOnly ? "bg-blue-100 border-blue-300" : ""}
                    >
                      <Filter className="h-4 w-4 mr-1" />
                      TypeStatus
                    </Button>
                  </div>

                  {queryState.aggregationColumns.map((agg, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <Select
                        value={agg.function}
                        onValueChange={(value) => {
                          const newAggregations = [...queryState.aggregationColumns];
                          newAggregations[index] = { ...agg, function: value as any };
                          setQueryState(prev => ({ ...prev, aggregationColumns: newAggregations }));
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COUNT">COUNT</SelectItem>
                          <SelectItem value="SUM">SUM</SelectItem>
                          <SelectItem value="AVG">AVG</SelectItem>
                          <SelectItem value="MAX">MAX</SelectItem>
                          <SelectItem value="MIN">MIN</SelectItem>
                          <SelectItem value="COUNT_DISTINCT">COUNT DISTINCT</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={agg.column}
                        onValueChange={(value) => {
                          const newAggregations = [...queryState.aggregationColumns];
                          newAggregations[index] = { ...agg, column: value };
                          setQueryState(prev => ({ ...prev, aggregationColumns: newAggregations }));
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns
                            .filter(col => 
                              col.toLowerCase().includes(aggregationSearch.toLowerCase()) &&
                              (!showTypeStatusOnly || col.toLowerCase().includes('typestatus'))
                            )
                            .map((column) => (
                            <SelectItem key={column} value={column}>{column}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newAggregations = queryState.aggregationColumns.filter((_, i) => i !== index);
                          setQueryState(prev => ({ ...prev, aggregationColumns: newAggregations }));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    onClick={() => {
                      const newAggregation = { function: "COUNT" as any, column: "", alias: "" };
                      setQueryState(prev => ({ ...prev, aggregationColumns: [...prev.aggregationColumns, newAggregation] }));
                    }}
                  >
                    + Add Aggregation
                  </Button>
                </div>

                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <label className="block text-sm font-medium text-neutral-700">Group By</label>
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search group by columns..."
                      value={groupBySearch}
                      onChange={(e) => setGroupBySearch(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableColumns
                      .filter(col => 
                        col.toLowerCase().includes(groupBySearch.toLowerCase()) &&
                        (!showTypeStatusOnly || col.toLowerCase().includes('typestatus'))
                      )
                      .map((column) => (
                      <Badge
                        key={column}
                        variant={queryState.groupByColumns.includes(column) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleGroupByToggle(column)}
                      >
                        {column}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button 
                onClick={handleGenerateQuery}
                disabled={generateQueryMutation.isPending || queryState.selectedTables.length === 0}
                className="px-6 py-3 font-medium"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                {generateQueryMutation.isPending ? "Generating..." : "Generate SQL Query"}
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* Query Preview */}
          <div className="space-y-6">
            {/* Natural Language Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="text-primary mr-2" />
                  Query Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    {naturalLanguagePreview}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Generated SQL */}
            {generatedQuery && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center">
                      <Database className="text-primary mr-2" />
                      Generated SQL
                    </CardTitle>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(generatedQuery.sql)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-neutral-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-green-400 font-mono">
                      <code>{generatedQuery.sql}</code>
                    </pre>
                  </div>
                  {generatedQuery.naturalLanguage && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">{generatedQuery.naturalLanguage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Execute Button */}
            {generatedQuery && (
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleExecuteQuery}
                disabled={executeQueryMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {executeQueryMutation.isPending ? "Executing..." : "Execute Query"}
              </Button>
            )}

            {/* Loading State */}
            {(generateQueryMutation.isPending || executeQueryMutation.isPending) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-neutral-600">
                      {generateQueryMutation.isPending ? "Generating query..." : "Executing query..."}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Query Results */}
        {queryResults && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <TableIcon className="text-primary mr-2" />
                    Query Results
                    <span className="ml-2 text-sm font-normal text-neutral-500">
                      ({queryResults.totalCount} rows)
                    </span>
                  </CardTitle>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportResults("csv")}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportResults("excel")}
                    >
                      <FileSpreadsheet className="mr-1 h-4 w-4" />
                      Export Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {queryResults.columns.map((column) => (
                          <TableHead key={column} className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            {column.replace(/_/g, " ")}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queryResults.rows.map((row, index) => (
                        <TableRow key={index} className="hover:bg-neutral-50">
                          {queryResults.columns.map((column) => (
                            <TableCell key={column} className="text-sm text-neutral-900">
                              {row[column]?.toString() || ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 text-sm text-neutral-500">
                  Execution time: {queryResults.executionTime}ms
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
