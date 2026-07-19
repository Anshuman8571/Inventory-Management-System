// The ONE place that calls the Gemini API for reading a product sticker or bill photo.
// Both the take-out/add-stock sticker flow and the bill flow call through here —
// see architecture.md §5 (shared extraction logic, not duplicated per flow).

const env = require('../config/env');

const GEMINI_MODEL = 'gemini-flash-lite-latest';

function getApiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.geminiApiKey}`;
}

function buildPrompt(category) {
  return `You are extracting product details from a photo of a manufacturer's product sticker, for a shop that stocks ${category} items.
Return ONLY a JSON object, no other text, in exactly this shape:
{"name": string, "size": string or null, "type": string or null, "company": string or null}
- "name" should be a concise product name combining what's visible (e.g. "CPVC Elbow 3/4 inch").
- If a field is not clearly visible or legible, use null for it rather than guessing.
Return nothing except the JSON object — no markdown formatting, no explanation.`;
}

// Refined against real supplier invoices (Nerolac paint distributor, a CPVC/PVC fittings
// wholesaler, and a PPR pipe supplier) — these vary a lot in column layout, so the
// instructions below are deliberately about *what matters*, not one fixed table shape.
function buildBillPrompt() {
  return `You are extracting product line items from a photo of a supplier invoice/bill for a hardware and paint shop. Real invoices from different suppliers use very different table layouts — read the actual content, don't assume one fixed column order.

Return ONLY a JSON object, no other text, in exactly this shape:
{
  "supplierName": string or null,
  "items": [
    {
      "name": string,
      "size": string or null,
      "type": string or null,
      "company": string or null,
      "brand": string or null,
      "materialCode": string or null,
      "hsnCode": string or null,
      "qty": number,
      "unit": string or null,
      "unitPrice": number or null,
      "tradeDiscount": number or null,
      "schemeDiscount": number or null,
      "gstPercent": number or null,
      "netAmount": number or null
    }
  ]
}

Important guidance based on real invoice formats you will encounter:
- Product descriptions are sometimes split across two lines (a short item code/size line, then a fuller description line below it, or vice versa) — combine them into one clear "name".
- QUANTITY: some invoices show BOTH a countable pack/carton/piece count (e.g. "No of Packs: 36", "Qty: 100 NOS") AND a separate volume or weight figure (e.g. "Qty Ltr/Kgs: 36.00"). When both exist, "qty" MUST be the countable pack/piece/carton count — that's what physically gets counted on a shop shelf — NOT the volume/weight figure. Put the unit label you used (e.g. "pcs", "NOS", "cartons", "L", "kg") in the "unit" field so this choice is visible and can be corrected by a human if needed.
- "unitPrice" must be the rate per the SAME unit you used for "qty" (e.g. if qty is in pieces, unitPrice is price per piece — not a per-liter or per-kg rate, even if that's also printed on the invoice).
- Discount structures vary: some invoices show one combined "Disc %" column, others split into Trade Discount and Scheme Discount separately, others show a Cash Discount too. Map whatever is shown into tradeDiscount/schemeDiscount as best fits; if there's only one combined discount percentage, put it in tradeDiscount and leave schemeDiscount null. Don't guess a split that isn't printed.
- "gstPercent" is the tax rate. If CGST and SGST are shown separately (e.g. 9% + 9%), add them together and report the combined rate (18%). If IGST is shown alone, use that rate directly.
- "netAmount" is the final line total for that item (after discounts, before or after tax — use whatever "Amount" or "Total" column is printed for that row).
- Do NOT include the invoice's summary/total row (grand total, tax summary, package summary) as an item — only actual product line items.
- Ignore handwritten marks, ticks, circles, or annotations on the page — extract only the printed invoice content.
- If a field isn't clearly legible, use null rather than guessing a value.

Return nothing except the JSON object — no markdown formatting, no explanation.`;
}

function extractionError() {
  const err = new Error('Could not read the image clearly. Please try again or enter details manually.');
  err.status = 422;
  err.code = 'EXTRACTION_FAILED';
  err.expose = true;
  return err;
}

async function callGemini(imageBase64, mediaType, promptText, maxOutputTokens) {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mediaType,
                data: imageBase64,
              },
            },
            { text: promptText },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    let errBody = '';
    try { errBody = await response.text(); } catch (_) { }
    console.error(`[extraction] Gemini API error ${response.status}: ${errBody}`);
    throw extractionError();
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    console.error('[extraction] Gemini returned no text block:', JSON.stringify(data));
    throw extractionError();
  }

  // finishReason 'MAX_TOKENS' means the response was cut off mid-way — this is the
  // exact failure seen with the old 4096 limit on multi-item bills. Logging it
  // explicitly (rather than just failing JSON.parse below) makes this specific
  // failure mode immediately obvious in the logs if it ever happens again, instead
  // of looking like a generic parse error.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    console.error(
      `[extraction] Gemini response was truncated (hit maxOutputTokens=${maxOutputTokens}). ` +
      `This bill likely has more line items than the token budget allows — consider raising maxOutputTokens further.`
    );
  }

  try {
    const cleaned = text.trim().replace(/^```json\s*|```\s*$/g, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[extraction] Failed to parse Gemini JSON response:', text);
    throw extractionError();
  }
}

async function extractStickerFields({ imageBase64, mediaType, category }) {
  // Small, fixed-shape response (4 fields) — 512 tokens is generous for this.
  const parsed = await callGemini(imageBase64, mediaType, buildPrompt(category), 512);
  return {
    name: parsed.name || null,
    size: parsed.size || null,
    type: parsed.type || null,
    company: parsed.company || null,
  };
}

async function extractBillLineItems({ imageBase64, mediaType }) {
  // Bills can have many line items, each with ~13 fields — this needs real headroom.
  // 8192 comfortably covers bills with 15-20+ line items; if a genuinely huge bill
  // still gets truncated, the finishReason logging above will make that obvious,
  // and this ceiling can be raised further at that point.
  const parsed = await callGemini(imageBase64, mediaType, buildBillPrompt(), 8192);
  return {
    supplierName: parsed.supplierName || null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

module.exports = { extractStickerFields, extractBillLineItems };