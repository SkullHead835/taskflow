const { z } = require('zod');

/**
 * Schema for creating a new task.
 * Title is required, trimmed, min 1 char, max 120 chars.
 * Description is optional, trimmed, max 1000 chars.
 * Completed is an optional boolean.
 */
const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty or whitespace-only')
    .max(120, 'Title must not exceed 120 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional()
    .nullable(),
  completed: z
    .boolean({ invalid_type_error: 'Completed must be a boolean' })
    .optional(),
  category_id: z.coerce
    .number({ invalid_type_error: 'Category ID must be a number' })
    .int('Category ID must be an integer')
    .positive('Category ID must be a positive integer')
    .nullable()
    .optional()
});

/**
 * Schema for updating an existing task.
 * At least one editable field (title, description, completed) must be present.
 * Same length constraints apply as creation.
 */
const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty or whitespace-only')
      .max(120, 'Title must not exceed 120 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description must not exceed 1000 characters')
      .optional()
      .nullable(),
    completed: z
      .boolean({ invalid_type_error: 'Completed must be a boolean' })
      .optional(),
    category_id: z.coerce
      .number({ invalid_type_error: 'Category ID must be a number' })
      .int('Category ID must be an integer')
      .positive('Category ID must be a positive integer')
      .nullable()
      .optional()
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.completed !== undefined ||
      data.category_id !== undefined,
    {
      message: 'Update request must contain at least one valid editable field (title, description, completed, category_id)'
    }
  );

/**
 * Schema for query filters when listing tasks.
 * Accepts boolean or boolean string query parameter ('true', 'false', '1', '0').
 */
const filterTasksSchema = z.object({
  completed: z
    .union([
      z.boolean(),
      z.enum(['true', 'false', '1', '0']).transform((val) => val === 'true' || val === '1')
    ])
    .optional(),
  category_id: z.coerce
    .number({ invalid_type_error: 'Category ID must be a number' })
    .int('Category ID must be an integer')
    .positive('Category ID must be a positive integer')
    .optional()
});

/**
 * Schema for task ID route parameters.
 * Validates that ID coerces into a positive integer.
 */
const taskIdParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'ID must be a number' })
    .int('ID must be an integer')
    .positive('ID must be a positive integer')
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  filterTasksSchema,
  taskIdParamSchema
};
