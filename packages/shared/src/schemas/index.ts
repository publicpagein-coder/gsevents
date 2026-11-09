import { z } from "zod";
import { EVENT_CATEGORIES, INDIAN_STATES } from "../constants/index";

// Auth schemas
export const SignupSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, "Phone must be a valid Indian mobile number (+91XXXXXXXXXX)"),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["ORGANIZER", "SPONSOR", "GENERAL_USER"]),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  otp: z.string().length(6).regex(/^\d{6}$/),
});

// Event schemas
export const CreateEventSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  city: z.string().min(2).max(100),
  state: z.enum(INDIAN_STATES),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  category: z.enum(EVENT_CATEGORIES),
  isPublic: z.boolean().default(true),
  ticketOption: z.enum(["NONE", "FREE", "PAID"]).default("NONE"),
  ticketPrice: z.number().positive().optional(),
  maxSeats: z.number().int().positive().optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  status: z.enum(["DRAFT", "PENDING_APPROVAL"]).optional(),
});

// Sponsorship package schemas
export const CreatePackageSchema = z.object({
  eventId: z.string().cuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  priceInr: z.number().positive().max(10_000_000),
  perks: z.array(z.string().min(1).max(200)).min(1).max(20),
  availableSlots: z.number().int().min(1).max(1000),
});

export const UpdatePackageSchema = CreatePackageSchema.omit({ eventId: true }).partial();

// Organizer profile schemas
export const CreateOrganizerProfileSchema = z.object({
  orgName: z.string().min(2).max(200),
  societyName: z.string().min(2).max(200).optional(),
  venueName: z.string().min(2).max(200).optional(),
  socialLink: z.string().url().optional(),
});

// Sponsor profile schemas
export const CreateSponsorProfileSchema = z.object({
  companyName: z.string().min(2).max(200),
});

// Pagination schema
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Event filter schema
export const EventFilterSchema = PaginationSchema.extend({
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "LIVE", "CANCELLED"]).optional(),
  search: z.string().optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type CreatePackageInput = z.infer<typeof CreatePackageSchema>;
export type UpdatePackageInput = z.infer<typeof UpdatePackageSchema>;
export type CreateOrganizerProfileInput = z.infer<typeof CreateOrganizerProfileSchema>;
export type CreateSponsorProfileInput = z.infer<typeof CreateSponsorProfileSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type EventFilterInput = z.infer<typeof EventFilterSchema>;
