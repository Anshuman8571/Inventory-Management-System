const { z } = require('zod');

const CATEGORIES = ['CPVC', 'PVC', 'Paint'];

const scanRequestSchema = z
  .object({
    category: z.enum(CATEGORIES),
    imageBase64: z.string().optional(),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
    flowType: z.enum(['take_out', 'add_stock']).default('take_out'),
    isManual: z.boolean().optional().default(false),
  })
  .refine((data) => data.isManual || (data.imageBase64 && data.imageBase64.length > 0), {
    message: 'Photo is required for automatic scanning',
    path: ['imageBase64'],
  });

const scanConfirmSchema = z
  .object({
    qty: z.number().int().positive('Quantity must be a positive number'),
    isNewProduct: z.boolean().default(false),
    // Lets the confirm step target an existing product directly — used when manual
    // entry (or a failed/incorrect match) should update a real product's stock instead
    // of always creating a new one (see memory.md: manual entry duplicate-product fix).
    selectedProductId: z.number().int().positive().optional(),
    newProductDetails: z
      .object({
        name: z.string().min(1),
        company: z.string().optional(),
        unit: z.string().optional(),
        attributes: z.record(z.any()).optional(),
      })
      .optional(),
    correctedFields: z.record(z.any()).optional(),
  })
  .refine((data) => !data.isNewProduct || !!data.newProductDetails, {
    message: 'Product details are required when adding a new product.',
    path: ['newProductDetails'],
  });

module.exports = { scanRequestSchema, scanConfirmSchema, CATEGORIES };