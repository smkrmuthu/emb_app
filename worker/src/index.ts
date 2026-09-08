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
  taxableValue: z.number().nullable(),
  cgst: z.number().nullable(),
  sgst: z.number().nullable(),
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

const CreditCardSchema = z.object({
  bankName: z.string(),
  cardNumbers: z.array(z.string()).nullable(),
  statementPeriod: z.string().nullable(),
  statementDate: z.string().nullable(),
  paymentDueDate: z.string().nullable(),
  totalAmountDue: z.number(),
  minimumAmountDue: z.number().nullable(),
  creditLimit: z.number().nullable(),
  aprPercent: z.number().nullable()
});

// Bill types read directly from a photo (vision)
const IMAGE_SCHEMAS = {
  restaurant: RestaurantSchema,
  grocery: GrocerySchema,
  electricity: ElectricitySchema
} as const;

// Bill types read from extracted PDF text — no photo involved at all
const TEXT_SCHEMAS = {
  credit_card: CreditCardSchema
} as const;

const SCHEMAS = { ...IMAGE_SCHEMAS, ...TEXT_SCHEMAS } as const;

type ImageBillType = keyof typeof IMAGE_SCHEMAS;
type TextBillType = keyof typeof TEXT_SCHEMAS;
type SupportedBillType = keyof typeof SCHEMAS;

const IMAGE_PROMPTS: Record<ImageBillType, string> = {
  restaurant: `Read this photo of an Indian restaurant bill/receipt precisely and extract the fields in the given schema.
Rules:
- Read every number exactly as printed — never estimate, round, or invent a value you can't actually see.
- "items" is every food/drink line item with its printed quantity, rate, and amount (use null for qty/rate if only one number is printed for that line — put it in "amount").
- Do NOT include GST/tax rows, "Sub Total", "Round off", or "Total" rows as items.
- cgst/sgst/igst are the actual rupee tax amounts printed (not the percentage) — cgstRate/sgstRate are the percentages (e.g. 2.5 for "CGST@2.5%"). For a standalone restaurant, CGST and SGST are almost always equal (same rate applied to the same taxable subtotal) — if your two readings differ, re-check both against the printed digits before finalizing.
- subtotal must equal (or very closely match) the sum of the item amounts you extracted, and should match a printed "Sub Total"/"Total" (before tax) line if one exists. Re-check your item amounts if subtotal doesn't add up.
- serviceCharge: most Indian restaurant bills do NOT have one — only CGST and SGST. Set this to null/0 unless you see a line item distinctly labelled "Service Charge" (not CGST, not SGST, not a repeat of the tax amount). Do not invent a service charge, and never mistake a CGST or SGST amount for one — misreporting a legal tax line as an "illegal service charge" is a false accusation against the business, not a harmless rounding error.
- grandTotal is the final amount actually payable, exactly as printed (often bold/larger text, sometimes labelled "Grand Total", "Net Amount", "Total").
- If a field genuinely isn't printed on the bill or isn't legible, use null rather than guessing.`,

  grocery: `Read this photo of an Indian grocery/supermarket bill/receipt precisely and extract the fields in the given schema.
Rules:
- Read every number exactly as printed — never estimate, round, or invent a value you can't actually see.
- "items" is every purchased product line with its amount. Do NOT include tax, discount, round-off, weight, or item-count rows as items.
- discount and roundOff are 0/null if not printed.
- Most grocery receipts fold GST into the item price with no separate tax line — in that common case, leave taxableValue/cgst/sgst as null. But some "TAX BILL"/tax-invoice-style receipts do print an explicit breakdown (e.g. "Value Before Tax", "CGST @2.5%", "SGST @2.5%") — when that appears, read it: taxableValue is the pre-tax value, cgst/sgst are the actual rupee tax amounts (not the percentage).
- grandTotal is the final amount actually payable, exactly as printed — it may be labelled "Total", "Net Amount", "PAY:", or shown as a bare "₹X.XX"/"Rs.X.XX" with no label at all.
- If a field genuinely isn't printed on the bill or isn't legible, use null rather than guessing.`,

  electricity: `Read this photo/page of an Indian electricity (EB) bill precisely and extract the fields in the given schema.
Rules:
- Read every number exactly as printed — never estimate, round, or invent a value you can't actually see.
- consumedUnits is the single most important field — read it carefully. Most Indian EB bills print a meter-reading row/table with columns "Final Reading | Initial Reading | MF | Consumption". Read the Final Reading and Initial Reading digit-by-digit, then compute Final minus Initial yourself (times MF, if MF isn't 1) — use that computed value, and cross-check it against the printed "Consumption" column if one exists; if they disagree, trust your own Final-minus-Initial calculation over a printed column that may be harder to read. This is a bi-monthly bill, so consumedUnits is usually in the range of a few hundred to low thousands — a value under 50 is almost always a misread. Do NOT confuse this field with a connection/account/meter number (those are long ID strings, not consumption).
- energyCharges is the base energy charge amount (often has an HSN/SAC code like "2716 0000" printed right next to it — that code is NOT the amount; read the actual rupee figure, which is usually printed with two decimals).
- govtSubsidy is the subsidy amount subtracted (printed as a negative or under "Less:"), as a positive number.
- adjustments is any other deduction (e.g. "Adjustments", "Advance CC Adj", "Refund of SD" totals), as a positive number.
- grandTotal is the final "Net Payable"/"Bill Amount" actually due, exactly as printed.
- serviceConnectionNumber and consumerName come from the consumer details section. consumerName is a person's name only (e.g. "DINESH.R") — never include the address, plot/door number, or street name that follows it.
- If a field genuinely isn't printed on the bill or isn't legible, use null rather than guessing.`
};

const TEXT_PROMPTS: Record<TextBillType, string> = {
  credit_card: `Below is the full extracted text of an Indian credit card statement PDF (every page included, in order). Extract the fields in the given schema.
Rules:
- Read every number exactly as it appears in the text — never estimate or invent a value that isn't there.
- bankName is the issuing bank (e.g. "IDFC FIRST Bank", "HDFC Bank"), not the cardholder's name.
- cardNumbers is every masked card number mentioned (e.g. "XXXX 5323") — a consolidated statement can cover more than one card; list them all. Null if none is legible.
- totalAmountDue is the full "Total Amount Due" for the statement — this is required.
- minimumAmountDue is the "Minimum Amount Due"/"Min Amount Due".
- creditLimit is the total credit limit (not "Available Credit Limit" — the full sanctioned limit).
- aprPercent is the actual stated "Annual Percentage Rate (APR)" or interest rate percentage if the statement prints one (e.g. 28.00 for "28.00%") — this is often stated explicitly; only use null if genuinely not mentioned anywhere in the text, never guess a typical/generic rate.
- statementPeriod is the billing cycle dates (e.g. "18/Jul/2026 - 17/Aug/2026"). statementDate is when the statement was generated, if separately stated. paymentDueDate is the due date for payment.
- If a field genuinely isn't present in the text, use null rather than guessing.`
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

    let body: { imageBase64?: string; mediaType?: string; billType?: string; pdfText?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    const { imageBase64, mediaType, billType, pdfText } = body;
    if (!billType) {
      return json({ error: 'billType is required' }, 400, origin);
    }

    const schema = SCHEMAS[billType as SupportedBillType];
    if (!schema) {
      return json({ error: `Unsupported billType "${billType}" — this endpoint currently handles: ${Object.keys(SCHEMAS).join(', ')}` }, 400, origin);
    }

    const isTextType = billType in TEXT_SCHEMAS;

    let content: Anthropic.Messages.ContentBlockParam[];
    if (isTextType) {
      if (!pdfText || pdfText.trim().length < 50) {
        return json({ error: 'pdfText is required for this bill type (upload the PDF statement, not a photo)' }, 400, origin);
      }
      content = [{ type: 'text', text: `${TEXT_PROMPTS[billType as TextBillType]}\n\n--- STATEMENT TEXT (all pages) ---\n\n${pdfText}` }];
      // Page 1 is usually the visual "summary" page (Total Due, Min Due, Credit
      // Limit, Due Date) laid out as dashboard tiles — text extraction linearizes
      // that layout and can pair the wrong label with the wrong value, since
      // reading order doesn't reliably follow visual position for a tile grid.
      // Including the rendered image too lets the model cross-check those specific
      // headline numbers against their actual visual layout.
      if (imageBase64 && mediaType && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
        content.push(
          { type: 'text', text: 'Here is an image of page 1 of the same statement — cross-check the summary numbers (Total Amount Due, Minimum Amount Due, Credit Limit, Payment Due Date) against it, since their exact label-value pairing is clearer visually than in the linearized text above.' },
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 } }
        );
      }
    } else {
      if (!imageBase64 || !mediaType) {
        return json({ error: 'imageBase64 and mediaType are required for this bill type' }, 400, origin);
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
        return json({ error: `Unsupported mediaType "${mediaType}"` }, 400, origin);
      }
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 } },
        { type: 'text', text: IMAGE_PROMPTS[billType as ImageBillType] }
      ];
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Server misconfigured: ANTHROPIC_API_KEY not set' }, 500, origin);
    }

    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

      const response = await client.messages.parse({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
        output_config: { format: zodOutputFormat(schema) }
      });

      if (!response.parsed_output) {
        return json({ error: 'Could not extract a usable result — it may be too unclear or an unrecognized format.' }, 422, origin);
      }

      return json(response.parsed_output, 200, origin);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Unknown error calling the model' }, 502, origin);
    }
  }
} satisfies ExportedHandler<Env>;
