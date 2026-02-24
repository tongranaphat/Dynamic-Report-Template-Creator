const { z } = require('zod');

// Middleware factory for validation
const validate = (schema) => (req, res, next) => {
    try {
        // Parse request body/query/params against schema
        // We focus on req.body for now, but can expand to query/params
        const parsed = schema.parse(req.body);
        req.body = parsed; // Replace body with parsed/typed data
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: error.errors
            });
        }
        next(error);
    }
};

// --- Schemas ---

const VariableSchema = z.object({
    key: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, 'Key must be alphanumeric with underscores'),
    label: z.string().min(1).max(100),
    value: z.string().optional()
});

const PageObjectSchema = z
    .object({
        type: z.string()
        // Allow other fabric.js properties but ensure they are safe types if needed
        // For now, we use pascal/camel case check or just allow as unknown/any for flexibility
        // but strictly validating structure is better.
        // Keeping it loose for Fabric object dump compatibility, but could be tightened.
    })
    .passthrough(); // Allow unknown keys for fabric objects

const TemplateSchema = z.object({
    name: z.string().min(1).max(100),
    background: z.string().nullable().optional(),
    pages: z.array(z.any()).default([]), // Validate pages structure if possible, else any
    userId: z.string().uuid().optional().nullable() // Optional owner
});

const UpdateTemplateSchema = TemplateSchema.partial(); // Allow partial updates

module.exports = {
    validate,
    Schemas: {
        Variable: VariableSchema,
        Template: TemplateSchema,
        UpdateTemplate: UpdateTemplateSchema
    }
};
