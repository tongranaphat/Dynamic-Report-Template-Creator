const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse(req.body);
        req.body = parsed;
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
    })
    .passthrough();

const TemplateSchema = z.object({
    name: z.string().min(1).max(100),
    background: z.string().nullable().optional(),
    pages: z.array(z.any()).default([]),
    userId: z.string().uuid().optional().nullable()
});

const UpdateTemplateSchema = TemplateSchema.partial();

module.exports = {
    validate,
    Schemas: {
        Variable: VariableSchema,
        Template: TemplateSchema,
        UpdateTemplate: UpdateTemplateSchema
    }
};
