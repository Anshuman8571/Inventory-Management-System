// The ONE place that calls the Gemini API for reading a product sticker photo.
// Both the take-out and add-stock (sticker) flows call this same function —
// see architecture.md §5 (shared extraction logic, not duplicated per flow).

const env = require('../config/env');

// Gemini REST endpoint — uses the generateContent API with vision support.
// gemini-2.0-flash is used deliberately over Pro: this is a small, structured
// extraction task (read a sticker, return JSON) that runs on every single scan,
// so keeping cost and latency low matters (see rules.md, token/cost efficiency).
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

function buildBillPrompt() {
  return `You are extracting product line items from a photo of a supplier invoice or bill for a hardware shop.
Return ONLY a JSON object, no other text, in exactly this shape:
{
  "supplierName": string or null,
  "items": [
    {
      "name": string,
      "size": string or null,
      "type": string or null,
      "company": string or null,
      "qty": number,
      "price": number or null
    }
  ]
}
- "name" should be a concise product name combining what's visible (e.g. "CPVC Elbow 3/4 inch").
- "qty" is the total quantity of the item purchased on this bill.
- "price" is the total price or unit price (if clearly marked). If multiple prices exist, prefer unit price.
- If a field is not clearly visible or legible, use null for it rather than guessing.
Return nothing except the JSON object — no markdown formatting, no explanation.`;
}

function extractionError() {
  const err = new Error('Could not read the image clearly. Please try again or enter details manually.');
  err.status = 422;
  err.code = 'EXTRACTION_FAILED';
  err.expose = true;
  return err;
}

async function callGemini(imageBase64, mediaType, promptText) {
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
        maxOutputTokens: 1000,
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
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('[extraction] Gemini returned no text block:', JSON.stringify(data));
    throw extractionError();
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
  const parsed = await callGemini(imageBase64, mediaType, buildPrompt(category));
  return {
    name: parsed.name || null,
    size: parsed.size || null,
    type: parsed.type || null,
    company: parsed.company || null,
  };
}

async function extractBillLineItems({ imageBase64, mediaType }) {
  const parsed = await callGemini(imageBase64, mediaType, buildBillPrompt());
  return {
    supplierName: parsed.supplierName || null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

module.exports = { extractStickerFields, extractBillLineItems };
