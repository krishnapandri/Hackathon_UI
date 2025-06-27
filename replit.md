# Query Builder Application

## Overview

This is a modern SQL query builder application built with Angular, TypeScript, and Node.js. The application provides a visual interface for constructing SQL queries through a drag-and-drop interface, with AI-powered natural language query generation capabilities. It features a clean, responsive design using Tailwind CSS and Angular's standalone components.

## System Architecture

### Frontend Architecture
- **Framework**: Angular 19 with TypeScript
- **Build System**: Angular CLI with Vite integration for fast development
- **UI Styling**: Tailwind CSS with custom component styling
- **State Management**: RxJS with Angular services for reactive state management
- **Routing**: Angular Router for client-side navigation
- **HTTP Client**: Angular HttpClient for API communication
- **Form Handling**: Angular Reactive Forms with template-driven forms

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **Build Tool**: esbuild for production builds

### Database Schema
The application manages a simple ERP-style database with four main entities:
- **customers**: Customer information (id, name, email, phone, address)
- **products**: Product catalog (id, name, category, price, description)
- **orders**: Order transactions (id, customer_id, product_id, order_date, total_amount, status)
- **sales_reps**: Sales representative data (id, name, email, territory, commission)

## Key Components

### Query Builder Interface
- Visual table and column selection interface
- Aggregation function support (COUNT, SUM, AVG, etc.)
- Group by functionality
- Real-time query preview and validation

### AI-Powered Query Generation
- Groq Llama-3.3-70b integration for ultra-fast natural language to SQL conversion
- Context-aware query suggestions based on database schema
- Intelligent query optimization and validation

### Query Execution Engine
- Safe SQL query execution with result caching
- Result set visualization with tabular display
- Export capabilities for query results

### Storage Layer
- Drizzle ORM for type-safe database operations
- PostgreSQL-optimized queries with connection pooling
- In-memory fallback storage for development

## Data Flow

1. **User Interaction**: Users interact with the visual query builder or natural language input
2. **State Management**: React Query manages application state and server synchronization
3. **API Communication**: RESTful API endpoints handle query generation and execution
4. **AI Processing**: OpenAI service converts natural language to SQL when requested
5. **Database Operations**: Drizzle ORM executes queries against PostgreSQL database
6. **Result Display**: Query results are rendered in a responsive table interface

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon Database
- **drizzle-orm**: Modern TypeScript ORM for database operations
- **@tanstack/react-query**: Powerful data synchronization for React
- **openai**: Official OpenAI API client for GPT integration

### UI Dependencies
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Beautiful icon library
- **class-variance-authority**: CVA for component variant management

### Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **tsx**: TypeScript execution for Node.js

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 module with automatic provisioning
- **Hot Reload**: Vite HMR for instant frontend updates
- **Process Management**: npm scripts for development workflow

### Production Build
- **Frontend**: Vite build with optimized bundles and tree shaking
- **Backend**: esbuild compilation to ESM modules
- **Static Assets**: Served from dist/public directory
- **Deployment Target**: Replit Autoscale for automatic scaling

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **GROQ_API_KEY**: Groq API key for AI-powered SQL generation (required)
- **NODE_ENV**: Environment flag for development/production modes

## Recent Changes

- **June 27, 2025**: Complete Migration & Production Features Implementation
  - **Successfully migrated from Replit Agent to standard Replit environment** - Proper security and client/server separation
  - **Fixed column selection and TOP limit issues** - Enhanced Query Builder now respects user column selections
  - **Implemented intelligent query routing** - Enhanced vs AI Query Builder based on request type
  - **Added comprehensive Recent Queries functionality** - Full CRUD operations with API backend
  - **Implemented complete Saved Queries system** - Save, load, delete, and manage saved queries
  - **Added all missing button functionality** - Share, Export (CSV/JSON), Copy, Clear, Save Query Dialog
  - **Fixed AI Query Builder interface** - Proper API integration with Groq for natural language processing
  - **Added production-ready error handling** - Toast notifications and loading states for all operations
  - **Implemented real-time query execution tracking** - Execution time and result count tracking
  - **Created comprehensive backend API** - Recent queries, saved queries, export functionality

- **June 27, 2025**: Rules Configuration System & MSSQL Views Integration
  - **Added Rules Configuration tab** - Accessible via Alt+Z keyboard shortcut
  - **Integrated Microsoft SQL Server views** - Connected to production database views instead of tables
  - **Implemented WHERE 1=2 column discovery** - Query views with WHERE 1=2 to get column structure without data
  - **Business rules engine** - Customizable formulas and constraints for AI query generation
  - **Added mandatory query conditions** - All queries include company_id and typestatus = 200 filters
  - **Excluded _copy views** - System automatically filters out backup/copy views from schema
  - **Enhanced AI context** - Groq AI now uses custom business rules and view-specific constraints
  - **Added keyboard shortcuts** - Alt+Z opens Rules Configuration for quick access
  - **Production-ready query generation** - Ensures all SQL follows business rules and security constraints

- **June 27, 2025**: AI Query Builder Implementation
  - **Added AI Query Builder** - Complete redesign based on screener.in reference interface
  - Implemented comprehensive sidebar with Database Schema, Recent Queries, and Query Templates
  - Added natural language query input with suggested queries
  - Built production-ready interface with save/share functionality
  - Integrated with existing Groq API for SQL generation
  - Added proper error handling and loading states
  - Implemented responsive design consistent with current theme
  - **Migrated from Replit Agent to standard Replit environment** - ensured proper security and client/server separation

- **June 26, 2025**: Enhanced query builder with production features
  - Added multi-column aggregation support (COUNT, SUM, AVG, MAX, MIN, COUNT_DISTINCT)
  - Implemented advanced filtering with multiple operators (=, !=, >, <, LIKE, IN, BETWEEN, etc.)
  - Added sorting capabilities with multiple columns
  - Integrated query validation and execution plan analysis
  - Enhanced export functionality (CSV, JSON formats)
  - Added query template saving and management
  - Implemented tabbed interface for better organization
  - Added production-ready error handling and validation
  - Created dual interface: Basic Builder and Enhanced Builder
  - **Switched from OpenAI to Groq API** for ultra-fast SQL generation using Llama-3.3-70b model
  - **Converted entire project from React to Angular** - migrated to Angular 19 with standalone components, RxJS state management, and Angular Router

## Changelog

Changelog:
- June 26, 2025. Initial setup and enhanced query builder implementation

## User Preferences

Preferred communication style: Simple, everyday language.