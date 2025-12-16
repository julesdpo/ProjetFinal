import { z } from 'zod';

export const ticketCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(5000),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['open', 'in_progress', 'closed']).optional()
});

export const ticketUpdateSchema = ticketCreateSchema.partial();
