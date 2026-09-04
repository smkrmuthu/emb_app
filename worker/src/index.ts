/**
 * Explain My Bill — LLM scanning backend.
 *
 * Takes a bill photo/PDF page, asks Claude (vision) to read it directly into a
 * strict JSON shape, and returns that JSON. This replaces only the "photo -> raw
 * text" step of the app's pipeline — the frontend still runs its own GST/slab/
 * legality checks against whatever numbers come back, exactly as it does for the
 * existing OCR path.
 *
 * The Anthropic API key never reaches the browser: it's a Worker secret
 * (`wrangler secret put ANTHROPIC_API_KEY`), used only server-side here.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

const ItemSchema = z.object({
  label: z.string(),
  qty: z.number().nullable(),
  rate: z.number().nullable(),
  amount: z.number()
});

const RestaurantSchema = z.object({
  billerName: z.string(),
  billNumber: z.string().nullable(),
  billDate: z.string().nullable(),
  gstin: z.string().nullable(),
  items: z.array(ItemSchema),
  subtotal: z.number().nullable(),
  cgst: z.number().nullable(),
  cgstRate: z.number().nullable(),
  sgst: z.number().nullable(),
  sgstRate: z.number().nullable(),
  igst: z.number().nullable(),
  serviceCharge: z.number().nullable(),
  grandTotal: z.number()
});

const GrocerySchema = z.object({
  billerName: z.string(),
  billNumber: z.string().nullable(),
  billDate: z.string().nullable(),
  items: z.array(z.object({ label: z.string(), amount: z.number() })),
  discount: z.number().nullable(),
  roundOff: z.number().nullable(),
  grandTotal: z.number()
});

const ElectricitySchema = z.object({
  billerName: z.string(),
  discomName: z.string().nullable(),
  serviceConnectionNumber: z.string().nullable(),
  consumerName: z.string().nullable(),
  meterNumber: z.string().nullable(),
  consumedUnits: z.number().nullable(),
  energyCharges: z.number().nullable(),
  govtSubsidy: z.number().nullable(),
  adjustments: z.number().nullable(),
  roundOff: z.number().nullable(),
  dueDate: z.string().nullable(),
  billPeriod: z.string().nullable(),
  grandTotal: z.number()
});

const SCHEMAS = {
  restaurant: RestaurantSchema,
  grocery: GrocerySchema,
  electricity: ElectricitySchema
} as const;

type SupportedBillType = keyof typeof SCHEMAS;

const PROMPTS: Record<SupportedBillType, string> = {
  restaurant: `Read this photo of an Indian restaurant bill/receipt precisely and extract the fields in the given schema.
Rules:
- Read every number exactly as printed — never estimate, round, or invent a value you can't actually see.
- "items" is every food/drink line item with its printed quantity, rate, and amount (use null for qty/rate if only one number is printed for that line — put it in "amount").
- Do NOT include GST/tax rows, "Sub Total", "Round off", or "Total" rows as items.
- cgst/sgst/igst are the actual rupee tax amounts printed (not the percentage) — cgstRate/sgstRate are the percentages (e.g. 2.5 for "CGST@2.5%").
- serviceCharge is any separately-listed "Service Charge" line (0/null if none is printed — do not assume one exists).
- grandTotal is the final amount actually payable, exactly as printed (often bold/larger text, sometimes labelled "Grand Total", "Net Amount", "Total").
- If a field genuinely isn't printed on the bill or isn't legible, use null rather than guessing.`,

  grocery: `Read this photo of an Indian grocery/supermarket bill/receipt precisely and extract the fields in the given schema.
Rules:
- Read every number exactly as printed — never estimate, round, or invent a value you can't actually see.
- "items" is every purchased product line with its amount. Do NOT include tax, discount, round-off, weight, or item-count rows as items.
- discount and roundOff are 0/null if not printed.
- grandTotal is the final amount actually payable, exactly as printed — it may be labelled "Total", "Net Amount", "PAY:", or shown as a bare "₹X.XX"/"Rs.X.XX" with no label at all.
- If a field genuinely isn't printed on the bill or isn't legible, use null rather than guessing.`,

  electricity: `Read this photo/page of an Indian electricity (EB) bill precisely and extract the fields in the given schema.
Rules:
- Read every number exactly as printed — never estimate, round, or invent a value you can't actually see.
- consumedUnits is the actual electricity units consumed this billing cycle. Most Indian EB bills print a meter-reading row/table with columns like "Final Reading | Initial Reading | MF | Consumption" — the Consumption column (or Final minus Initial, multiplied by MF if MF isn't 1) is consumedUnits. Do NOT confuse this with a connection/account/meter number.
- energyCharges is the base energy charge amount (often has an HSN/SAC code like "2716 0000" printed right next to it — that code is NOT the amount; read the actual rupee figure, which is usually printed with two decimals).
- govtSubsidy is the subsidy amount subtracted (printed as a negative or under "Less:"), as a positive number.
- adjustments is any other deduction (e.g. "Adjustments", "Advance CC Adj", "Refund of SD" totals), as a positive number.
- grandTotal is the final "Net Payable"/"Bill Amount" actually due, exactly as printed.
- serviceConnectionNumber and consumerName come from the consumer details section (the actual customer's name, not the utility company's name).
- If a field genuinely isn't printed on the bill or isn't legible, use null rather than guessing.`
};

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    let body: { imageBase64?: string; mediaType?: string; billType?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    const { imageBase64, mediaType, billType } = body;
    if (!imageBase64 || !mediaType || !billType) {
      return json({ error: 'imageBase64, mediaType, and billType are required' }, 400, origin);
    }

    const schema = SCHEMAS[billType as SupportedBillType];
    if (!schema) {
      return json({ error: `Unsupported billType "${billType}" — this endpoint currently handles: ${Object.keys(SCHEMAS).join(', ')}` }, 400, origin);
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
      return json({ error: `Unsupported mediaType "${mediaType}"` }, 400, origin);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Server misconfigured: ANTHROPIC_API_KEY not set' }, 500, origin);
    }

    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

      const response = await client.messages.parse({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 }
            },
            { type: 'text', text: PROMPTS[billType as SupportedBillType] }
          ]
        }],
        output_config: { format: zodOutputFormat(schema) }
      });

      if (!response.parsed_output) {
        return json({ error: 'Could not extract a usable result from this photo — it may be too unclear.' }, 422, origin);
      }

      return json(response.parsed_output, 200, origin);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Unknown error calling the model' }, 502, origin);
    }
  }
} satisfies ExportedHandler<Env>;
