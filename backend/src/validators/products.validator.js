const { z } = require('zod');

// Every field optional — this is a partial update (PATCH), not a full replace.
// At least one field must be present, or there's nothing to do.
const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    company: z.string().trim().max(80).optional(),
    unit: z.string().trim().max(20).optional(),
    lowStockAt: z.number().int().min(0).max(1000000).optional(),
    // Freeform, matching the existing `attributes` JSONB column (size, type, etc.) —
    // shallow-merged into the product's existing attributes, not replaced wholesale.
    attributes: z.record(z.any()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update.',
  });

module.exports = { productUpdateSchema };