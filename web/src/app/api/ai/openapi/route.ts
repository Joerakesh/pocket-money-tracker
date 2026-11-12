import { NextResponse } from "next/server";

export const dynamic = "force-static";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Pocket Personal Finance API",
    version: "1.0.0",
    description: "Read-only API for querying the authenticated user's Pocket finance data. All amounts are in INR. Transactions are returned in rupees; Pocket stores money internally as integer paise.",
  },
  servers: [{ url: "https://money.joerakesh.tech/api/ai/v1" }],
  components: {
    securitySchemes: {
      PocketBearer: { type: "http", scheme: "bearer", bearerFormat: "Pocket API key" },
    },
    schemas: {
      Error: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
    },
  },
  security: [{ PocketBearer: [] }],
  paths: {
    "/overview": {
      get: {
        operationId: "get_financial_overview",
        summary: "Get current account balances and this month's income and expenses",
        responses: { "200": { description: "Financial overview" }, "401": { description: "Invalid, expired or revoked key" } },
      },
    },
    "/transactions": {
      get: {
        operationId: "get_transactions",
        summary: "List transactions with optional filters",
        parameters: [
          { name: "month", in: "query", schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" }, description: "Month in YYYY-MM format" },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        ],
        responses: { "200": { description: "Matching transactions" } },
      },
    },
    "/budgets": { get: { operationId: "get_budgets", summary: "List category budgets", responses: { "200": { description: "Budgets" } } } },
    "/goals": { get: { operationId: "get_savings_goals", summary: "List savings goals and progress", responses: { "200": { description: "Savings goals" } } } },
    "/recurring": { get: { operationId: "get_recurring_expenses", summary: "List recurring expenses and reminders", responses: { "200": { description: "Recurring items" } } } },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
