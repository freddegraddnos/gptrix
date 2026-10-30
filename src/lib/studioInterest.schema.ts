import { z } from "zod";

export const studioInterestSchema = z.object({
  studioName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(40),
  website: z.string().max(0).optional(),
});