import { useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import NotFound from "@/pages/not-found";
import QueryBuilder from "@/pages/query-builder";
import EnhancedQueryBuilder from "@/pages/enhanced-query-builder";
import AIQueryBuilder from "@/pages/ai-query-builder";
import RulesConfig from "@/pages/rules-config";
import { Database, Sparkles, Bot, Settings, Zap } from "lucide-react";

function Navigation() {
  const [location, setLocation] = useLocation();
  
  // Keyboard shortcut for Rules Configuration (Alt+Z)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'z') {
        event.preventDefault();
        setLocation('/rules-config');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              ERP Query Builder
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Advanced SQL Query Interface</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"} 
              size="sm"
              className="h-9"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Advanced Builder
            </Button>
          </Link>
          <Link href="/ai-builder">
            <Button 
              variant={location === "/ai-builder" ? "default" : "ghost"} 
              size="sm"
              className="h-9"
            >
              <Bot className="h-4 w-4 mr-2" />
              AI Builder
            </Button>
          </Link>
          <Link href="/rules-config">
            <Button 
              variant={location === "/rules-config" ? "default" : "ghost"} 
              size="sm"
              className="h-9"
            >
              <Settings className="h-4 w-4 mr-2" />
              Rules
            </Button>
          </Link>
        </nav>

        {/* Theme Toggle */}
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={EnhancedQueryBuilder} />
        {/* <Route path="/" component={QueryBuilder} /> */}
        <Route path="/ai-builder" component={AIQueryBuilder} />
        <Route path="/rules-config" component={RulesConfig} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="erp-query-builder-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
