import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Plus, 
  Save, 
  Trash2, 
  Calculator, 
  Database,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BusinessRule {
  id: string;
  name: string;
  description: string;
  formula: string;
  category: 'calculation' | 'constraint' | 'filter' | 'validation';
  isActive: boolean;
}

interface QueryConfig {
  companyIdField: string;
  typeStatusValue: number;
  excludeTablePatterns: string[];
  defaultConditions: string[];
}

export default function RulesConfig() {
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([
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
  ]);

  const [queryConfig, setQueryConfig] = useState<QueryConfig>({
    companyIdField: 'company_id',
    typeStatusValue: 200,
    excludeTablePatterns: ['_copy'],
    defaultConditions: ['company_id IS NOT NULL', 'typestatus = 200']
  });

  const [newRule, setNewRule] = useState<Partial<BusinessRule>>({
    name: '',
    description: '',
    formula: '',
    category: 'calculation',
    isActive: true
  });

  const [showAddRule, setShowAddRule] = useState(false);
  const { toast } = useToast();

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'z') {
        event.preventDefault();
        // This would trigger opening the rules modal/tab
        console.log('Rules config shortcut triggered');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addBusinessRule = () => {
    if (!newRule.name || !newRule.formula) {
      toast({
        title: "Validation Error",
        description: "Please provide both name and formula for the rule",
        variant: "destructive",
      });
      return;
    }

    const rule: BusinessRule = {
      id: Date.now().toString(),
      name: newRule.name,
      description: newRule.description || '',
      formula: newRule.formula,
      category: newRule.category || 'calculation',
      isActive: true
    };

    setBusinessRules([...businessRules, rule]);
    setNewRule({
      name: '',
      description: '',
      formula: '',
      category: 'calculation',
      isActive: true
    });
    setShowAddRule(false);

    toast({
      title: "Rule Added",
      description: `Business rule "${rule.name}" has been added successfully`,
    });
  };

  const removeBusinessRule = (id: string) => {
    setBusinessRules(businessRules.filter(rule => rule.id !== id));
    toast({
      title: "Rule Removed",
      description: "Business rule has been removed",
    });
  };

  const toggleRuleStatus = (id: string) => {
    setBusinessRules(businessRules.map(rule => 
      rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
    ));
  };

  const saveRulesConfiguration = useMutation({
    mutationFn: async () => {
      const config = {
        businessRules: businessRules.filter(rule => rule.isActive),
        queryConfig
      };
      
      const response = await apiRequest('POST', '/api/rules-config', config);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Business rules and query configuration have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'calculation': return 'bg-blue-100 text-blue-800';
      case 'constraint': return 'bg-red-100 text-red-800';
      case 'filter': return 'bg-green-100 text-green-800';
      case 'validation': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Rules Configuration</h1>
          <Badge variant="outline" className="ml-auto">Alt + Z</Badge>
        </div>
        <p className="text-muted-foreground">
          Define business rules, formulas, and query constraints for AI-powered SQL generation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Query Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyId">Company ID Field</Label>
              <Input
                id="companyId"
                value={queryConfig.companyIdField}
                onChange={(e) => setQueryConfig({
                  ...queryConfig,
                  companyIdField: e.target.value
                })}
                placeholder="company_id"
              />
            </div>

            <div>
              <Label htmlFor="typeStatus">Type Status Value</Label>
              <Input
                id="typeStatus"
                type="number"
                value={queryConfig.typeStatusValue}
                onChange={(e) => setQueryConfig({
                  ...queryConfig,
                  typeStatusValue: parseInt(e.target.value) || 200
                })}
                placeholder="200"
              />
            </div>

            <div>
              <Label htmlFor="excludePatterns">Exclude Table Patterns</Label>
              <Input
                id="excludePatterns"
                value={queryConfig.excludeTablePatterns.join(', ')}
                onChange={(e) => setQueryConfig({
                  ...queryConfig,
                  excludeTablePatterns: e.target.value.split(',').map(s => s.trim())
                })}
                placeholder="_copy, _temp, _backup"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated patterns to exclude from table selection
              </p>
            </div>

            <div>
              <Label htmlFor="defaultConditions">Default Query Conditions</Label>
              <Textarea
                id="defaultConditions"
                value={queryConfig.defaultConditions.join('\n')}
                onChange={(e) => setQueryConfig({
                  ...queryConfig,
                  defaultConditions: e.target.value.split('\n').filter(s => s.trim())
                })}
                placeholder="company_id IS NOT NULL&#10;typestatus = 200"
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                One condition per line. These will be added to all generated queries.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Business Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Business Rules
              <Button
                size="sm"
                onClick={() => setShowAddRule(!showAddRule)}
                className="ml-auto"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Rule
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 mb-4">
              <div className="space-y-3">
                {businessRules.map((rule) => (
                  <div key={rule.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{rule.name}</h4>
                        <Badge 
                          variant="secondary" 
                          className={getCategoryColor(rule.category)}
                        >
                          {rule.category}
                        </Badge>
                        {rule.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleRuleStatus(rule.id)}
                        >
                          {rule.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeBusinessRule(rule.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                    <code className="text-xs bg-muted p-2 rounded block">
                      {rule.formula}
                    </code>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {showAddRule && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                <div>
                  <Label htmlFor="ruleName">Rule Name</Label>
                  <Input
                    id="ruleName"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Enter rule name"
                  />
                </div>
                <div>
                  <Label htmlFor="ruleDescription">Description</Label>
                  <Input
                    id="ruleDescription"
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Describe what this rule does"
                  />
                </div>
                <div>
                  <Label htmlFor="ruleFormula">Formula/Rule</Label>
                  <Textarea
                    id="ruleFormula"
                    value={newRule.formula}
                    onChange={(e) => setNewRule({ ...newRule, formula: e.target.value })}
                    placeholder="Enter SQL formula or business rule"
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label htmlFor="ruleCategory">Category</Label>
                  <select
                    id="ruleCategory"
                    value={newRule.category}
                    onChange={(e) => setNewRule({ ...newRule, category: e.target.value as any })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="calculation">Calculation</option>
                    <option value="constraint">Constraint</option>
                    <option value="filter">Filter</option>
                    <option value="validation">Validation</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addBusinessRule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setShowAddRule(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Save Configuration */}
      <div className="mt-6 flex justify-end">
        <Button 
          onClick={() => saveRulesConfiguration.mutate()}
          disabled={saveRulesConfiguration.isPending}
          size="lg"
        >
          {saveRulesConfiguration.isPending ? (
            <>
              <Save className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      {/* Active Rules Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Active Rules Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium mb-2">Query Constraints</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Company ID: {queryConfig.companyIdField}</li>
                <li>• Type Status: {queryConfig.typeStatusValue}</li>
                <li>• Excluded Tables: {queryConfig.excludeTablePatterns.join(', ')}</li>
                <li>• Default Conditions: {queryConfig.defaultConditions.length} rules</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">Business Rules</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {businessRules.filter(rule => rule.isActive).map(rule => (
                  <li key={rule.id}>• {rule.name} ({rule.category})</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}