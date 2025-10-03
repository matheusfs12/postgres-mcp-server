# PostgreSQL MCP Server

A PostgreSQL MCP server with multiple tools for database interaction, designed for use with Cursor.

## Features

- **Query Tool**: Execute PostgreSQL queries with automatic LIMIT and context support
- **Describe Table Tool**: Get detailed table structure and metadata
- **List Tables Tool**: List tables in schemas with optional pattern filtering
- **Configurable Defaults**: Set default schema, context, max rows, and timeout
- **Global Installation**: Can be installed globally and used across projects

## Installation

### Global Installation

```bash
npm install -g .
```

## Configuration

### Setting up in Cursor

1. **Open Cursor Settings**
   - Press `Cmd + ,` (macOS) or `Ctrl + ,` (Windows/Linux)
   - Or go to `Cursor > Preferences`

2. **Find MCP Settings**
   - Look for "MCP" or "Model Context Protocol" in settings
   - Or go to `Features > MCP Servers`

3. **Add the Server Configuration**
   - Copy the configuration below into your MCP settings

4. **Restart Cursor**
   - After configuring, restart Cursor to load the MCP server

### Environment Variables

Configure the server in Cursor's MCP settings with the following environment variables:

### Database Connection
- `POSTGRES_HOST`: Database host (default: localhost)
- `POSTGRES_PORT`: Database port (default: 5432)
- `POSTGRES_DB`: Database name (default: accounting)
- `POSTGRES_USER`: Database user (default: postgres)
- `POSTGRES_PASSWORD`: Database password (default: empty)

### Default Settings
- `POSTGRES_DEFAULT_SCHEMA`: Default schema to use (default: public)
- `POSTGRES_DEFAULT_CONTEXT`: Default context for queries (default: empty)
- `POSTGRES_MAX_ROWS`: Maximum rows to return for SELECT queries (default: 100)
- `POSTGRES_TIMEOUT`: Query timeout in milliseconds (default: 30000)

### Complete Cursor Configuration

Add this configuration to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "postgres-mcp-server": {
      "command": "postgres-mcp-server",
      "args": [],
      "env": {
        "POSTGRES_HOST": "127.0.0.1",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "your_database_name",
        "POSTGRES_USER": "your_username",
        "POSTGRES_PASSWORD": "your_password",
        "POSTGRES_DEFAULT_SCHEMA": "public",
        "POSTGRES_DEFAULT_CONTEXT": "Your database context",
        "POSTGRES_MAX_ROWS": "100",
        "POSTGRES_TIMEOUT": "30000"
      }
    }
  }
}
```

### Testing the Configuration

After restarting Cursor, you can test the MCP server by asking:

- "List all tables in the public schema"
- "Show me the structure of the users table"
- "Execute this query: SELECT COUNT(*) FROM products"

## Available Tools

### 1. Query Tool (`query`)

Execute PostgreSQL queries with enhanced features:

**Parameters:**
- `query` (required): SQL query to execute
- `schema` (optional): Schema name (defaults to configured schema)
- `context` (optional): Additional context for the query
- `maxRows` (optional): Maximum rows to return (defaults to configured maxRows)

**Features:**
- Automatic LIMIT addition for SELECT queries
- Context information display
- Enhanced error reporting with emojis
- Schema information in results

**Examples:**
```sql
-- Basic query
SELECT * FROM users LIMIT 10

-- Query with specific schema
SELECT * FROM public.products

-- Query with context
SELECT COUNT(*) FROM orders WHERE status = 'completed'
```

### 2. Describe Table Tool (`describe_table`)

Get detailed table structure and metadata:

**Parameters:**
- `tableName` (required): Name of the table to describe
- `schema` (optional): Schema name (defaults to configured schema)

**Returns:**
- Column names and types
- Nullable constraints
- Default values
- Data type precision and scale

**Example:**
```
describe_table: { "tableName": "users", "schema": "public" }
```

### 3. List Tables Tool (`list_tables`)

List all tables in a schema with optional filtering:

**Parameters:**
- `schema` (optional): Schema name (defaults to configured schema)
- `pattern` (optional): SQL LIKE pattern to filter table names

**Example:**
```
list_tables: { "schema": "public", "pattern": "%user%" }
```

## Usage Examples

### Basic Query
```sql
SELECT * FROM users WHERE status = 'active'
```

### Table Discovery
```sql
-- List all tables in public schema
list_tables: { "schema": "public" }

-- Find tables with 'user' in the name
list_tables: { "schema": "public", "pattern": "%user%" }
```

### Table Structure Analysis
```sql
-- Get detailed structure of users table
describe_table: { "tableName": "users", "schema": "public" }
```

## Response Format

All tools return structured responses with:
- ✅ Success indicators with emojis
- 📊 Row counts and statistics
- 🏗️ Schema information
- 📋 Formatted results
- ❌ Clear error messages

## Security Features

- Connection pooling for efficient resource usage
- Query timeout protection
- Automatic LIMIT for SELECT queries to prevent large result sets
- Parameterized queries to prevent SQL injection

## Global Installation Benefits

- ✅ No need to install dependencies in each project
- ✅ Centralized configuration in Cursor
- ✅ Can be used across any repository
- ✅ Easy to maintain and update
- ✅ Consistent behavior across projects