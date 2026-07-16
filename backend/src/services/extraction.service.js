// The ONE place that calls the Gemini API for reading a product sticker photo.
// Both the take-out and add-stock (sticker) flows call this same function —
// see architecture.md §5 (shared extraction logic, not duplicated per flow).

const env = require('../config/env');

// Gemini REST endpoint — uses the generateContent API with vision support.
// gemini-2.0-flash is used deliberately over Pro: this is a small, structured
// extraction task (read a sticker, return JSON) that runs on every single scan,
// so keeping cost and latency low matters (see rules.md, token/cost efficiency).
const GEMINI_MODEL = 'gemini-2.0-flash';

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

function extractionError() {
  const err = new Error('Could not read the sticker clearly. Please try again or enter details manually.');
  err.status = 422;
  err.code = 'EXTRACTION_FAILED';
  err.expose = true;
  return err;
}

async function extractStickerFields({ imageBase64, mediaType, category }) {
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
            { text: buildPrompt(category) },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    // Log the real Gemini error to help diagnose API key / quota / model issues
    let errBody = '';
    try { errBody = await response.text(); } catch (_) { }
    console.error(`[extraction] Gemini API error ${response.status}: ${errBody}`);
    throw extractionError();
  }

  const data = await response.json();

  // Gemini response shape: data.candidates[0].content.parts[0].text
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('[extraction] Gemini returned no text block:', JSON.stringify(data));
    throw extractionError();
  }

  try {
    // Strip optional markdown fences the model sometimes adds despite the prompt
    const cleaned = text.trim().replace(/^```json\s*|```\s*$/g, '');
    const parsed = JSON.parse(cleaned);
    return {
      name: parsed.name || null,
      size: parsed.size || null,
      type: parsed.type || null,
      company: parsed.company || null,
    };
  } catch (e) {
    console.error('[extraction] Failed to parse Gemini JSON response:', text);
    throw extractionError();
  }
}

module.exports = { extractStickerFields };
