import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pkg from "pg";
const { Pool } = pkg;

class PostgresMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "postgres-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Default configurations that can be overridden via env vars
    this.defaultConfig = {
      schema: process.env.POSTGRES_DEFAULT_SCHEMA || "public",
      context: process.env.POSTGRES_DEFAULT_CONTEXT || "",
      maxRows: parseInt(process.env.POSTGRES_MAX_ROWS) || 100,
      timeout: parseInt(process.env.POSTGRES_TIMEOUT) || 30000,
    };

    // PostgreSQL connection configuration
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || "postgres",
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "query",
            description: "Execute a PostgreSQL query and return results",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description:
                    "The PostgreSQL query to execute (SELECT, INSERT, UPDATE, DELETE, etc.)",
                },
                schema: {
                  type: "string",
                  description:
                    "Schema name to use (defaults to configured schema)",
                },
                context: {
                  type: "string",
                  description: "Additional context for the query",
                },
                maxRows: {
                  type: "number",
                  description:
                    "Maximum number of rows to return (defaults to configured maxRows)",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "describe_table",
            description: "Get table structure and metadata",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "Name of the table to describe",
                },
                schema: {
                  type: "string",
                  description: "Schema name (defaults to configured schema)",
                },
              },
              required: ["tableName"],
            },
          },
          {
            name: "list_tables",
            description: "List all tables in the database or specific schema",
            inputSchema: {
              type: "object",
              properties: {
                schema: {
                  type: "string",
                  description: "Schema name (defaults to configured schema)",
                },
                pattern: {
                  type: "string",
                  description:
                    "Pattern to filter table names (SQL LIKE pattern)",
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "query":
          return await this.handleQuery(args);
        case "describe_table":
          return await this.handleDescribeTable(args);
        case "list_tables":
          return await this.handleListTables(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async handleQuery(args) {
    const { query, schema, context, maxRows } = args;
    const targetSchema = schema || this.defaultConfig.schema;
    const limitRows = maxRows || this.defaultConfig.maxRows;

    try {
      const client = await this.pool.connect();

      try {
        // Add context information if provided
        let contextInfo = "";
        if (context || this.defaultConfig.context) {
          contextInfo = `\nContext: ${context || this.defaultConfig.context}\n`;
        }

        // Modify query to add LIMIT if it's a SELECT and doesn't have one
        let finalQuery = query;
        if (
          query.trim().toUpperCase().startsWith("SELECT") &&
          !query.toUpperCase().includes("LIMIT") &&
          limitRows > 0
        ) {
          finalQuery += ` LIMIT ${limitRows}`;
        }

        const result = await client.query(finalQuery);

        const response = {
          success: true,
          query: finalQuery,
          schema: targetSchema,
          context: context || this.defaultConfig.context,
          execution: {
            command: result.command,
            rowCount: result.rowCount || 0,
            fields: result.fields
              ? result.fields.map((f) => ({
                  name: f.name,
                  dataTypeID: f.dataTypeID,
                  dataTypeSize: f.dataTypeSize,
                  dataTypeModifier: f.dataTypeModifier,
                }))
              : null,
          },
          data: result.rows || [],
          metadata: {
            hasData: result.rows && result.rows.length > 0,
            dataCount: result.rows ? result.rows.length : 0,
            wasLimited: query !== finalQuery,
            limitApplied: limitRows,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const errorResponse = {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          detail: error.detail,
          hint: error.hint,
        },
        query: query,
        schema: targetSchema,
        context: context || this.defaultConfig.context,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }

  async handleDescribeTable(args) {
    const { tableName, schema } = args;
    const targetSchema = schema || this.defaultConfig.schema;

    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    try {
      const client = await this.pool.connect();

      try {
        const result = await client.query(query, [targetSchema, tableName]);

        const response = {
          success: true,
          table: {
            name: tableName,
            schema: targetSchema,
            fullName: `${targetSchema}.${tableName}`,
          },
          columns: result.rows.map((row, index) => ({
            position: index + 1,
            name: row.column_name,
            dataType: row.data_type,
            nullable: row.is_nullable === "YES",
            defaultValue: row.column_default,
            constraints: {
              characterMaximumLength: row.character_maximum_length,
              numericPrecision: row.numeric_precision,
              numericScale: row.numeric_scale,
            },
            typeInfo: {
              fullType:
                row.data_type +
                (row.character_maximum_length
                  ? `(${row.character_maximum_length})`
                  : "") +
                (row.numeric_precision
                  ? `(${row.numeric_precision}` +
                    (row.numeric_scale ? `,${row.numeric_scale}` : "") +
                    ")"
                  : ""),
            },
          })),
          metadata: {
            columnCount: result.rows.length,
            found: result.rows.length > 0,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const errorResponse = {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          detail: error.detail,
          hint: error.hint,
        },
        table: {
          name: tableName,
          schema: targetSchema,
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }

  async handleListTables(args) {
    const { schema, pattern } = args;
    const targetSchema = schema || this.defaultConfig.schema;

    let query = `
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = $1
    `;
    const params = [targetSchema];

    if (pattern) {
      query += ` AND table_name LIKE $2`;
      params.push(pattern);
    }

    query += ` ORDER BY table_name`;

    try {
      const client = await this.pool.connect();

      try {
        const result = await client.query(query, params);

        const response = {
          success: true,
          schema: targetSchema,
          pattern: pattern || null,
          tables: result.rows.map((row, index) => ({
            position: index + 1,
            name: row.table_name,
            type: row.table_type,
            fullName: `${targetSchema}.${row.table_name}`,
          })),
          metadata: {
            tableCount: result.rows.length,
            found: result.rows.length > 0,
            filtered: pattern !== null,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const errorResponse = {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          detail: error.detail,
          hint: error.hint,
        },
        schema: targetSchema,
        pattern: pattern || null,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("PostgreSQL MCP server running on stdio");
  }
}

const server = new PostgresMCPServer();
server.run().catch(console.error);
