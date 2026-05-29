import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Request, Response } from "express";
import { z } from "zod";
import pool from "./db";
import { PROTEINS, MEASUREMENT_UNITS } from "./types";

const MCP_API_KEY = process.env.MCP_API_KEY;

function authenticateRequest(req: Request): number | null {
  const { apiKey, householdId } = req.params;
  if (!MCP_API_KEY || apiKey !== MCP_API_KEY) return null;
  const hid = Number(householdId);
  return Number.isFinite(hid) && hid > 0 ? hid : null;
}

function createMcpServer() {
  const server = new McpServer({
    name: "meal-planner",
    version: "1.0.0",
  });

  server.registerTool(
    "save_recipe",
    {
      title: "Save Recipe",
      description: `Save a recipe to the meal planner. Use this when the user asks to save, add, or store a recipe. Extract all details from the conversation. Valid proteins: ${PROTEINS.join(", ")}. Valid measurement units: ${MEASUREMENT_UNITS.join(", ")}.`,
      inputSchema: {
        name: z.string().describe("Recipe name"),
        description: z.string().nullable().describe("Short one-sentence summary of the dish, or null if the name is self-explanatory"),
        mainProtein: z.enum(PROTEINS as unknown as [string, ...string[]]).describe("Main protein in the dish"),
        servingSize: z.number().min(1).describe("Number of people it serves"),
        rating: z.number().min(1).max(10).describe("How good it tastes (1-10). Ask the user if not obvious."),
        easinessScore: z.number().min(1).max(10).describe("How easy it is to make (1-10). Estimate based on complexity."),
        healthScore: z.number().min(1).max(10).describe("How healthy it is (1-10). Estimate based on ingredients."),
        prepTimeMinutes: z.number().nullable().describe("Prep time in minutes, or null if unknown"),
        cookTimeMinutes: z.number().nullable().describe("Cook time in minutes, or null if unknown"),
        url: z.string().nullable().describe("Source URL if available, or null"),
        sourceName: z.string().nullable().describe("Source name (e.g. 'NYT Cooking'), or null"),
        notes: z.string().nullable().describe("Any extra notes about the recipe, or null"),
        isBasic: z.boolean().describe("Whether this is a basic/simple weeknight meal"),
        ingredients: z.array(z.object({
          name: z.string().describe("Ingredient name (lowercase, normalized)"),
          quantity: z.number().describe("Quantity as a decimal"),
          measurementUnit: z.enum(MEASUREMENT_UNITS as unknown as [string, ...string[]]).describe("Unit of measurement"),
          optional: z.boolean().describe("Whether the ingredient is optional"),
          notes: z.string().nullable().describe("Prep details like 'diced', 'minced', or null"),
        })).describe("List of ingredients"),
      },
    },
    async (params) => {
      const { name, description, mainProtein, servingSize, rating, easinessScore, healthScore, prepTimeMinutes, cookTimeMinutes, url, sourceName, notes, isBasic, ingredients } = params;

      // householdId is injected via the transport's context — see handler below
      // For now we read from a custom property set on the server
      const householdId = (server as any)._householdId;
      if (!householdId) {
        return {
          content: [{ type: "text" as const, text: "Authentication failed. Check API key and household ID." }],
          isError: true,
        };
      }

      // Check for duplicate
      const existing = await pool.query(
        "SELECT id, name FROM meals WHERE LOWER(name) = LOWER($1) AND household_id = $2",
        [name.trim(), householdId]
      );
      if (existing.rows.length > 0) {
        return {
          content: [{ type: "text" as const, text: `A recipe named "${existing.rows[0].name}" already exists in your meal planner.` }],
          isError: true,
        };
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const mealResult = await client.query(
          `INSERT INTO meals (name, url, source_name, description, notes, prep_time_minutes, cook_time_minutes, main_protein, rating, easiness_score, health_score, serving_size, household_id, is_basic)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [name, url || null, sourceName || null, description || null, notes || null, prepTimeMinutes || null, cookTimeMinutes || null, mainProtein, rating, easinessScore, healthScore, servingSize, householdId, isBasic]
        );

        const mealId = mealResult.rows[0].id;

        if (ingredients.length > 0) {
          const values: unknown[] = [];
          const placeholders: string[] = [];
          let paramIndex = 1;

          for (const ing of ingredients) {
            placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
            values.push(mealId, ing.name, ing.quantity, ing.measurementUnit, ing.optional, ing.notes || null);
            paramIndex += 6;
          }

          await client.query(
            `INSERT INTO ingredients (meal_id, name, quantity, measurement_unit, optional, notes) VALUES ${placeholders.join(", ")}`,
            values
          );
        }

        await client.query("COMMIT");

        return {
          content: [{ type: "text" as const, text: `Recipe "${name}" saved successfully with ${ingredients.length} ingredients! (ID: ${mealId})` }],
        };
      } catch (err) {
        await client.query("ROLLBACK");
        const message = err instanceof Error ? err.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `Failed to save recipe: ${message}` }],
          isError: true,
        };
      } finally {
        client.release();
      }
    }
  );

  return server;
}

export async function handleMcpPost(req: Request, res: Response) {
  const householdId = authenticateRequest(req);
  if (!householdId) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or missing API key / household ID" },
      id: null,
    });
    return;
  }

  const server = createMcpServer();
  (server as any)._householdId = householdId;

  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    console.error("MCP error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

export async function handleMcpGet(_req: Request, res: Response) {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
}

export async function handleMcpDelete(_req: Request, res: Response) {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
}
