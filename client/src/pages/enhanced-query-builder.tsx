import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Database, 
  Table as TableIcon, 
  Columns, 
  Calculator, 
  Filter,
  SortAsc,
  Wand2, 
  Play, 
  RotateCcw, 
  Copy, 
  Download,
  Plus,
  Trash2,
  Settings2,
  ArrowUpDown,
  Eye,
  Sparkles
} from "lucide-react";
import type { 
  QueryBuilderState, 
  SqlQueryResponse, 
  QueryExecutionResult,
  AggregationColumn,
  FilterCondition,
  SortColumn 
} from "@shared/schema";

interface TableMetadata {
  name: string;
  recordCount: number;
  columns: Array<{
    name: string;
    type: string;
  }>;
}

export default function EnhancedQueryBuilder() {
  const { toast } = useToast();
  const [queryState, setQueryState] = useState<QueryBuilderState>({
    selectedTables: [],
    selectedColumns: {},
    aggregationColumns: [],
    groupByColumns: [],
    filterConditions: [],
    sortColumns: [],
    limit: undefined,
    distinct: false,
  });
  
  const [generatedQuery, setGeneratedQuery] = useState<SqlQueryResponse | null>(null);
  const [queryResults, setQueryResults] = useState<QueryExecutionResult | null>(null);
  const [naturalLanguagePreview, setNaturalLanguagePreview] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  
  // Enhanced filtering states
  const [columnSearch, setColumnSearch] = useState<string>("");
  const [aggregationSearch, setAggregationSearch] = useState<string>("");
  const [groupBySearch, setGroupBySearch] = useState<string>("");
  
  // Validation states
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isQueryValid, setIsQueryValid] = useState<boolean>(true);

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

  // Comprehensive query validation
  const validateQuery = (state: QueryBuilderState): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Basic validation
    if (state.selectedTables.length === 0) {
      errors.push("At least one table must be selected");
    }
    
    // Column selection validation
    const totalSelectedColumns = Object.values(state.selectedColumns).flat().length;
    if (totalSelectedColumns === 0 && state.aggregationColumns.length === 0) {
      errors.push("At least one column or aggregation must be selected");
    }
    
    // Aggregation validation
    if (state.aggregationColumns.length > 0) {
      for (let i = 0; i < state.aggregationColumns.length; i++) {
        const agg = state.aggregationColumns[i];
        if (!agg.column) {
          errors.push(`Aggregation ${i + 1} must have a column selected`);
        }
        if (!agg.function) {
          errors.push(`Aggregation ${i + 1} must have a function selected`);
        }
      }
      
      // When using aggregations, all non-aggregated selected columns must be in GROUP BY
      const allSelectedColumns = Object.entries(state.selectedColumns).flatMap(([table, columns]) =>
        columns.map(col => `${table}.${col}`)
      );
      
      const missingFromGroupBy = allSelectedColumns.filter(col => !state.groupByColumns.includes(col));
      if (missingFromGroupBy.length > 0) {
        errors.push(`When using aggregations, all selected columns must be grouped: ${missingFromGroupBy.join(', ')}`);
      }
    }
    
    // Filter validation
    for (let i = 0; i < state.filterConditions.length; i++) {
      const filter = state.filterConditions[i];
      if (!filter.column) {
        errors.push(`Filter condition ${i + 1} must have a column selected`);
      }
      if (!filter.operator) {
        errors.push(`Filter condition ${i + 1} must have an operator selected`);
      }
      
      // Value validation based on operator
      if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
        // These operators don't need values
      } else if (filter.operator === 'BETWEEN') {
        if (!filter.value || !filter.value2) {
          errors.push(`Filter condition ${i + 1} with BETWEEN operator needs both values`);
        }
      } else if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
        if (!filter.value || (Array.isArray(filter.value) && filter.value.length === 0)) {
          errors.push(`Filter condition ${i + 1} with ${filter.operator} operator needs at least one value`);
        }
      } else {
        if (filter.value === undefined || filter.value === null || filter.value === '') {
          errors.push(`Filter condition ${i + 1} must have a value`);
        }
      }
    }
    
    // Sort validation
    for (let i = 0; i < state.sortColumns.length; i++) {
      const sort = state.sortColumns[i];
      if (!sort.column) {
        errors.push(`Sort column ${i + 1} must have a column selected`);
      }
      if (!sort.direction) {
        errors.push(`Sort column ${i + 1} must have a direction selected`);
      }
      
      // If using aggregations, sort columns must be either aggregated or in GROUP BY
      if (state.aggregationColumns.length > 0) {
        const isAggregated = state.aggregationColumns.some(agg => agg.column === sort.column);
        const isInGroupBy = state.groupByColumns.includes(sort.column);
        if (!isAggregated && !isInGroupBy) {
          errors.push(`Sort column ${sort.column} must be either aggregated or in GROUP BY when using aggregations`);
        }
      }
    }
    
    // Limit validation
    if (state.limit !== undefined && (state.limit <= 0 || !Number.isInteger(state.limit))) {
      errors.push("Limit must be a positive integer");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Update validation whenever query state changes
  useEffect(() => {
    const validation = validateQuery(queryState);
    setIsQueryValid(validation.isValid);
    setValidationErrors(validation.errors);
  }, [queryState]);

  // Update natural language preview
  useEffect(() => {
    if (queryState.selectedTables.length > 0) {
      let preview = "";
      
      if (queryState.distinct) {
        preview += "Get unique ";
      } else {
        preview += "Get ";
      }

      if (queryState.aggregationColumns.length > 0) {
        const aggText = queryState.aggregationColumns.map(agg => 
          `${agg.function.toLowerCase()} of ${agg.column}`
        ).join(", ");
        preview += `${aggText} `;
      } else {
        const columnCount = Object.values(queryState.selectedColumns).flat().length;
        preview += `${columnCount} column${columnCount !== 1 ? "s" : ""} `;
      }

      preview += `from ${queryState.selectedTables.join(", ")} table${queryState.selectedTables.length > 1 ? "s" : ""}`;

      if (queryState.filterConditions.length > 0) {
        preview += ` where ${queryState.filterConditions.length} condition${queryState.filterConditions.length > 1 ? "s" : ""} apply`;
      }

      if (queryState.groupByColumns.length > 0) {
        preview += ` grouped by ${queryState.groupByColumns.join(", ")}`;
      }

      if (queryState.sortColumns.length > 0) {
        preview += ` sorted by ${queryState.sortColumns.map(s => `${s.column} ${s.direction.toLowerCase()}`).join(", ")}`;
      }

      if (queryState.limit) {
        preview += ` limited to ${queryState.limit} rows`;
      }

      preview += ".";
      setNaturalLanguagePreview(preview);
    } else {
      setNaturalLanguagePreview("Select tables and columns to see query description.");
    }
  }, [queryState]);



  const addAggregationColumn = () => {
    setQueryState(prev => {
      const newAggregationColumns = [...prev.aggregationColumns, {
        column: "",
        function: "COUNT" as const,
        alias: ""
      }];
      
      // When adding first aggregation, automatically add all selected columns to GROUP BY
      let newGroupByColumns = [...prev.groupByColumns];
      if (prev.aggregationColumns.length === 0) {
        const allSelectedColumns = Object.entries(prev.selectedColumns).flatMap(([table, columns]) =>
          columns.map(col => `${table}.${col}`)
        );
        
        allSelectedColumns.forEach(fullCol => {
          if (!newGroupByColumns.includes(fullCol)) {
            newGroupByColumns.push(fullCol);
          }
        });
        
        if (allSelectedColumns.length > 0) {
          toast({
            title: "Auto-updated GROUP BY",
            description: "Selected columns were automatically added to GROUP BY for aggregation query",
          });
        }
      }
      
      return {
        ...prev,
        aggregationColumns: newAggregationColumns,
        groupByColumns: newGroupByColumns,
      };
    });
  };

  const updateAggregationColumn = (index: number, field: keyof AggregationColumn, value: string) => {
    setQueryState(prev => ({
      ...prev,
      aggregationColumns: prev.aggregationColumns.map((agg, i) => 
        i === index ? { ...agg, [field]: value } : agg
      )
    }));
  };

  const removeAggregationColumn = (index: number) => {
    setQueryState(prev => {
      const newAggregationColumns = prev.aggregationColumns.filter((_, i) => i !== index);
      
      // When removing the last aggregation, clear GROUP BY constraints
      let newGroupByColumns = [...prev.groupByColumns];
      if (newAggregationColumns.length === 0) {
        // Clear GROUP BY when no aggregations remain
        newGroupByColumns = [];
        toast({
          title: "GROUP BY cleared",
          description: "GROUP BY was cleared since no aggregations remain",
        });
      }
      
      return {
        ...prev,
        aggregationColumns: newAggregationColumns,
        groupByColumns: newGroupByColumns,
      };
    });
  };

  const addFilterCondition = () => {
    setQueryState(prev => ({
      ...prev,
      filterConditions: [...prev.filterConditions, {
        column: "",
        operator: "=" as const,
        value: "",
        logicalOperator: "AND" as const
      }]
    }));
  };

  const updateFilterCondition = (index: number, field: keyof FilterCondition, value: any) => {
    setQueryState(prev => ({
      ...prev,
      filterConditions: prev.filterConditions.map((filter, i) => {
        if (i === index) {
          // Handle different field types appropriately
          if (field === 'value') {
            // Convert to appropriate type based on operator and column type
            if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
              // For IN operators, split comma-separated values and convert types
              const arrayValue = typeof value === 'string' ? 
                value.split(',').map(v => {
                  const trimmed = v.trim();
                  // Try to convert to number if it looks numeric
                  const numValue = Number(trimmed);
                  return !isNaN(numValue) && isFinite(numValue) && trimmed !== '' ? numValue : trimmed;
                }) : value;
              return { ...filter, [field]: arrayValue };
            } else {
              // For other operators, try to intelligently convert value type
              if (typeof value === 'string' && value !== '') {
                // Try to convert to number if it looks numeric
                const numValue = Number(value);
                if (!isNaN(numValue) && isFinite(numValue)) {
                  return { ...filter, [field]: numValue };
                }
              }
              return { ...filter, [field]: value };
            }
          }
          return { ...filter, [field]: value };
        }
        return filter;
      })
    }));
  };

  const removeFilterCondition = (index: number) => {
    setQueryState(prev => ({
      ...prev,
      filterConditions: prev.filterConditions.filter((_, i) => i !== index)
    }));
  };

  const addSortColumn = () => {
    setQueryState(prev => ({
      ...prev,
      sortColumns: [...prev.sortColumns, {
        column: "",
        direction: "ASC" as const
      }]
    }));
  };

  const updateSortColumn = (index: number, field: keyof SortColumn, value: string) => {
    setQueryState(prev => {
      const newSortColumns = prev.sortColumns.map((sort, i) => 
        i === index ? { ...sort, [field]: value } : sort
      );
      
      let newGroupByColumns = [...prev.groupByColumns];
      
      // If updating column and aggregations exist, ensure sort column is in GROUP BY
      if (field === 'column' && value && prev.aggregationColumns.length > 0) {
        const isAggregated = prev.aggregationColumns.some(agg => agg.column === value);
        if (!isAggregated && !newGroupByColumns.includes(value)) {
          newGroupByColumns.push(value);
          toast({
            title: "Auto-added to GROUP BY",
            description: `${value} was automatically added to GROUP BY for sorting with aggregations`,
          });
        }
      }
      
      return {
        ...prev,
        sortColumns: newSortColumns,
        groupByColumns: newGroupByColumns,
      };
    });
  };

  const removeSortColumn = (index: number) => {
    setQueryState(prev => ({
      ...prev,
      sortColumns: prev.sortColumns.filter((_, i) => i !== index)
    }));
  };

  // Helper function for column filtering
  const filterColumns = (columns: Array<{name: string, type: string}>, searchTerm: string) => {
    return columns.filter(col => {
      const matchesSearch = col.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isTypeStatus = col.name.toLowerCase().includes('typestatus');
      
      // Always filter out TypeStatus columns
      if (isTypeStatus) {
        return false;
      }
      
      return matchesSearch;
    });
  };

  const handleTableSelection = (tableName: string, checked: boolean) => {
    setQueryState(prev => {
      const newSelectedTables = checked 
        ? [...prev.selectedTables, tableName]
        : prev.selectedTables.filter(t => t !== tableName);
      
      const newSelectedColumns = { ...prev.selectedColumns };
      if (!checked) {
        delete newSelectedColumns[tableName];
      }
      
      // Clean up related states when table is deselected
      let newAggregationColumns = prev.aggregationColumns;
      let newGroupByColumns = prev.groupByColumns;
      let newFilterConditions = prev.filterConditions;
      let newSortColumns = prev.sortColumns;
      
      if (!checked) {
        // Remove aggregations that reference the deselected table
        newAggregationColumns = prev.aggregationColumns.filter(agg => 
          !agg.column.startsWith(`${tableName}.`)
        );
        
        // Remove group by columns that reference the deselected table
        newGroupByColumns = prev.groupByColumns.filter(col => 
          !col.startsWith(`${tableName}.`)
        );
        
        // Remove filter conditions that reference the deselected table
        newFilterConditions = prev.filterConditions.filter(filter => 
          !filter.column.startsWith(`${tableName}.`)
        );
        
        // Remove sort columns that reference the deselected table
        newSortColumns = prev.sortColumns.filter(sort => 
          !sort.column.startsWith(`${tableName}.`)
        );
      }
      
      return {
        ...prev,
        selectedTables: newSelectedTables,
        selectedColumns: newSelectedColumns,
        aggregationColumns: newAggregationColumns,
        groupByColumns: newGroupByColumns,
        filterConditions: newFilterConditions,
        sortColumns: newSortColumns,
      };
    });
  };

  const handleColumnSelection = (tableName: string, columnName: string, checked: boolean) => {
    setQueryState(prev => {
      const fullColumnName = `${tableName}.${columnName}`;
      const newSelectedColumns = {
        ...prev.selectedColumns,
        [tableName]: checked
          ? [...(prev.selectedColumns[tableName] || []), columnName]
          : (prev.selectedColumns[tableName] || []).filter(c => c !== columnName),
      };
      
      let newGroupByColumns = [...prev.groupByColumns];
      
      // Auto-manage GROUP BY when aggregations exist
      if (prev.aggregationColumns.length > 0) {
        if (checked) {
          // When adding a column and aggregations exist, automatically add to GROUP BY
          if (!newGroupByColumns.includes(fullColumnName)) {
            newGroupByColumns.push(fullColumnName);
            toast({
              title: "Auto-added to GROUP BY",
              description: `${fullColumnName} was automatically added to GROUP BY since aggregations are used`,
            });
          }
        } else {
          // When removing a column, remove from GROUP BY
          newGroupByColumns = newGroupByColumns.filter(col => col !== fullColumnName);
        }
      } else if (!checked) {
        // When no aggregations, remove from GROUP BY if column is deselected
        newGroupByColumns = newGroupByColumns.filter(col => col !== fullColumnName);
      }
      
      return {
        ...prev,
        selectedColumns: newSelectedColumns,
        groupByColumns: newGroupByColumns,
      };
    });
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
    if (!isQueryValid) {
      toast({
        title: "Query Validation Failed",
        description: "Please fix the validation issues before generating the query",
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
      limit: undefined,
      distinct: false,
    });
    setGeneratedQuery(null);
    setQueryResults(null);
    setColumnSearch("");
    setAggregationSearch("");
    setGroupBySearch("");
  };

  // Get available columns for aggregations and group by
  const getAvailableColumns = () => {
    const columns = queryState.selectedTables.flatMap(tableName => {
      const table = tableData?.tables.find(t => t.name === tableName);
      return table?.columns.map(col => ({
        value: `${tableName}.${col.name}`,
        label: `${tableName}.${col.name}`,
        name: col.name,
        type: col.type
      })) || [];
    });
    
    return filterColumns(
      columns.map(col => ({ name: col.name, type: col.type })), 
      aggregationSearch
    ).map(col => {
      const fullCol = columns.find(c => c.name === col.name);
      return fullCol || { value: col.name, label: col.name, name: col.name, type: col.type };
    });
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



  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Enhanced Query Builder</h1>
                <p className="text-muted-foreground">Build complex SQL queries with advanced visual tools</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
          </div>
        </div>

        {/* Natural Language Preview */}
        {showPreview && (
          <Card className="mb-6 bg-primary/5 border-primary/20 dark:bg-primary/10">
            <CardHeader>
              <CardTitle className="text-primary text-sm flex items-center">
                <Sparkles className="h-4 w-4 mr-2" />
                Query Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-primary/80 text-sm">{naturalLanguagePreview}</p>
            </CardContent>
          </Card>
        )}

        {/* Validation Feedback */}
        {!isQueryValid && validationErrors.length > 0 && (
          <Card className="mb-6 bg-destructive/5 border-destructive/20 dark:bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive text-sm flex items-center">
                <Settings2 className="h-4 w-4 mr-2" />
                Query Validation Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-destructive/80 text-sm flex items-start">
                    <span className="inline-block w-1 h-1 bg-destructive/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {error}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Query Valid Indicator */}
        {isQueryValid && queryState.selectedTables.length > 0 && (
          <Card className="mb-6 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800/30">
            <CardContent className="pt-4">
              <div className="flex items-center text-green-700 dark:text-green-400 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Query is valid and ready to generate
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Query Builder */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="tables" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="aggregations">Aggregations</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
                <TabsTrigger value="sorting">Sorting</TabsTrigger>
                <TabsTrigger value="options">Options</TabsTrigger>
              </TabsList>

              {/* Tables Tab */}
              <TabsContent value="tables" className="space-y-6">
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
                              {/* <div className="text-xs text-neutral-500">{table.recordCount} records</div> */}
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
                      {/* Search Controls */}
                      <div className="flex items-center gap-2 mb-4">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Search columns..."
                          value={columnSearch}
                          onChange={(e) => setColumnSearch(e.target.value)}
                          className="flex-1"
                        />
                      </div>

                      {queryState.selectedTables.map((tableName) => {
                        const table = tableData?.tables.find(t => t.name === tableName);
                        if (!table) return null;

                        const filteredColumns = filterColumns(table.columns, columnSearch);

                        return (
                          <div key={tableName} className="mb-6 last:mb-0">
                            <h3 className="text-sm font-medium text-neutral-700 mb-3 flex items-center">
                              <TableIcon className="text-neutral-400 mr-2 text-xs" />
                              {tableName} ({filteredColumns.length} columns)
                            </h3>
                            {filteredColumns.length > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {filteredColumns.map((column) => (
                                  <label key={column.name} className="flex items-center text-sm">
                                    <Checkbox
                                      checked={(queryState.selectedColumns[tableName] || []).includes(column.name)}
                                      onCheckedChange={(checked) => handleColumnSelection(tableName, column.name, checked as boolean)}
                                      className="w-3 h-3"
                                    />
                                    <span className="ml-2 text-neutral-700">{column.name}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500 text-sm">
                                No columns match the current filters
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Aggregations Tab */}
              <TabsContent value="aggregations" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Calculator className="text-primary mr-2" />
                        Aggregation Functions
                      </div>
                      <Button onClick={addAggregationColumn} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-neutral-600">Apply mathematical operations to your data</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search Controls for Aggregations */}
                    <div className="flex items-center gap-2 mb-4">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Input
                        placeholder="Search aggregation columns..."
                        value={aggregationSearch}
                        onChange={(e) => setAggregationSearch(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    {queryState.aggregationColumns.map((agg, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-neutral-200 rounded-lg">
                        <div>
                          <Label className="text-xs text-neutral-600">Function</Label>
                          <Select
                            value={agg.function}
                            onValueChange={(value) => updateAggregationColumn(index, "function", value)}
                          >
                            <SelectTrigger>
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
                        </div>
                        <div>
                          <Label className="text-xs text-neutral-600">Column</Label>
                          <Select
                            value={agg.column}
                            onValueChange={(value) => updateAggregationColumn(index, "column", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableColumns().map((column) => (
                                <SelectItem key={column.value} value={column.value}>
                                  {column.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-neutral-600">Alias (Optional)</Label>
                          <Input
                            placeholder="alias_name"
                            value={agg.alias || ""}
                            onChange={(e) => updateAggregationColumn(index, "alias", e.target.value)}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeAggregationColumn(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {queryState.aggregationColumns.length === 0 && (
                      <div className="text-center py-8 text-neutral-500">
                        No aggregation functions added. Click "Add" to create one.
                      </div>
                    )}

                    {queryState.aggregationColumns.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-sm font-medium text-neutral-700 mb-2 block">Group By Columns</Label>
                          <div className="flex flex-wrap gap-2">
                            {getAvailableColumns().map((column) => (
                              <Badge
                                key={column.value}
                                variant={queryState.groupByColumns.includes(column.value) ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => handleGroupByToggle(column.value)}
                              >
                                {column.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Filters Tab */}
              <TabsContent value="filters" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Filter className="text-primary mr-2" />
                        Filter Conditions
                      </div>
                      <Button onClick={addFilterCondition} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Filter
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-neutral-600">Apply conditions to filter your data</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {queryState.filterConditions.map((filter, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border border-neutral-200 rounded-lg">
                        {index > 0 && (
                          <div>
                            <Label className="text-xs text-neutral-600">Logic</Label>
                            <Select
                              value={filter.logicalOperator || "AND"}
                              onValueChange={(value) => updateFilterCondition(index, "logicalOperator", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className={index === 0 ? "md:col-start-2" : ""}>
                          <Label className="text-xs text-neutral-600">Column</Label>
                          <Select
                            value={filter.column}
                            onValueChange={(value) => updateFilterCondition(index, "column", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableColumns().map((column) => (
                                <SelectItem key={column.value} value={column.value}>
                                  {column.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-neutral-600">Operator</Label>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) => updateFilterCondition(index, "operator", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="=">=</SelectItem>
                              <SelectItem value="!=">!=</SelectItem>
                              <SelectItem value=">">&gt;</SelectItem>
                              <SelectItem value="<">&lt;</SelectItem>
                              <SelectItem value=">=">&gt;=</SelectItem>
                              <SelectItem value="<=">&lt;=</SelectItem>
                              <SelectItem value="LIKE">LIKE</SelectItem>
                              <SelectItem value="IN">IN</SelectItem>
                              <SelectItem value="NOT IN">NOT IN</SelectItem>
                              <SelectItem value="IS NULL">IS NULL</SelectItem>
                              <SelectItem value="IS NOT NULL">IS NOT NULL</SelectItem>
                              <SelectItem value="BETWEEN">BETWEEN</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-neutral-600">
                            Value {filter.operator === "IN" || filter.operator === "NOT IN" ? "(comma-separated)" : ""}
                          </Label>
                          <Input
                            placeholder={
                              filter.operator === "IN" || filter.operator === "NOT IN" 
                                ? "value1, value2, value3..." 
                                : filter.operator === "BETWEEN" 
                                ? "start value" 
                                : "Enter value..."
                            }
                            value={
                              Array.isArray(filter.value) 
                                ? filter.value.join(", ") 
                                : filter.value?.toString() || ""
                            }
                            onChange={(e) => updateFilterCondition(index, "value", e.target.value)}
                            disabled={filter.operator === "IS NULL" || filter.operator === "IS NOT NULL"}
                          />
                          {filter.operator === "BETWEEN" && (
                            <>
                              <Label className="text-xs text-neutral-600 mt-2 block">End Value</Label>
                              <Input
                                placeholder="end value"
                                value={filter.value2?.toString() || ""}
                                onChange={(e) => updateFilterCondition(index, "value2", e.target.value)}
                              />
                            </>
                          )}
                        </div>
                        <div className="flex items-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeFilterCondition(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {queryState.filterConditions.length === 0 && (
                      <div className="text-center py-8 text-neutral-500">
                        No filter conditions added. Click "Add Filter" to create one.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sorting Tab */}
              <TabsContent value="sorting" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <SortAsc className="text-primary mr-2" />
                        Sort Order
                      </div>
                      <Button onClick={addSortColumn} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Sort
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-neutral-600">Define the order of your results</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {queryState.sortColumns.map((sort, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-neutral-200 rounded-lg">
                        <div>
                          <Label className="text-xs text-neutral-600">Column</Label>
                          <Select
                            value={sort.column}
                            onValueChange={(value) => updateSortColumn(index, "column", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableColumns().map((column) => (
                                <SelectItem key={column.value} value={column.value}>
                                  {column.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-neutral-600">Direction</Label>
                          <Select
                            value={sort.direction}
                            onValueChange={(value) => updateSortColumn(index, "direction", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ASC">Ascending</SelectItem>
                              <SelectItem value="DESC">Descending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removeSortColumn(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {queryState.sortColumns.length === 0 && (
                      <div className="text-center py-8 text-neutral-500">
                        No sort columns added. Click "Add Sort" to create one.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Options Tab */}
              <TabsContent value="options" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Settings2 className="text-primary mr-2" />
                      Query Options
                    </CardTitle>
                    <p className="text-sm text-neutral-600">Additional options for your query</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Return Distinct Results</Label>
                        <p className="text-xs text-neutral-600">Remove duplicate rows from results</p>
                      </div>
                      <Switch
                        checked={queryState.distinct}
                        onCheckedChange={(checked) => setQueryState(prev => ({ ...prev, distinct: checked }))}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Limit Results</Label>
                      <Input
                        type="number"
                        placeholder="Enter maximum number of rows..."
                        value={queryState.limit || ""}
                        onChange={(e) => setQueryState(prev => ({ 
                          ...prev, 
                          limit: e.target.value ? parseInt(e.target.value) : undefined 
                        }))}
                        className="w-full"
                      />
                      <p className="text-xs text-neutral-600 mt-1">Leave empty for no limit</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button 
                onClick={handleGenerateQuery}
                disabled={generateQueryMutation.isPending || !isQueryValid}
                className="px-6"
              >
                {generateQueryMutation.isPending ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Query
                  </>
                )}
              </Button>

              <div className="flex space-x-2">
                <Button 
                  onClick={handleExecuteQuery}
                  disabled={executeQueryMutation.isPending || !generatedQuery?.sql}
                  variant="default"
                >
                  {executeQueryMutation.isPending ? (
                    <>Executing...</>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute
                    </>
                  )}
                </Button>

                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Generated Query */}
            {generatedQuery && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    Generated SQL Query
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedQuery.sql)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-neutral-900 text-green-400 p-3 rounded overflow-x-auto">
                    {generatedQuery.sql}
                  </pre>
                  {generatedQuery.naturalLanguage && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-800">{generatedQuery.naturalLanguage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Query Results */}
            {queryResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    Query Results ({queryResults.totalCount} rows)
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportResults("csv")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {queryResults.columns.map((column) => (
                            <TableHead key={column} className="text-xs font-medium">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResults.rows.slice(0, 50).map((row, index) => (
                          <TableRow key={index}>
                            {queryResults.columns.map((column) => (
                              <TableCell key={column} className="text-xs">
                                {row[column]?.toString() || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {queryResults.rows.length > 50 && (
                      <p className="text-xs text-neutral-500 text-center mt-2">
                        Showing first 50 of {queryResults.totalCount} results
                      </p>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-neutral-500">
                    Execution time: {queryResults.executionTime}ms
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}