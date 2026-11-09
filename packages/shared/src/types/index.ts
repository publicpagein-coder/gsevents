// Mirrors Prisma model shapes for use across web and mobile

export type Role = "ORGANIZER" | "SPONSOR" | "GENERAL_USER" | "ADMIN";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SubscriptionPlan = "BASIC" | "PREMIUM";
export type EventStatus = "DRAFT" | "PENDING_APPROVAL" | "LIVE" | "REJECTED" | "CANCELLED";
export type TicketOption = "NONE" | "FREE" | "PAID";
export type InterestStatus = "INTERESTED" | "CONTACTED" | "DEAL_DONE";

export interface User {
  id: string;
  phone: string;
  role: Role;
  name: string | null;
  createdAt: string;
}

export interface OrganizerProfile {
  id: string;
  userId: string;
  orgName: string;
  societyName: string | null;
  venueName: string | null;
  socialLink: string | null;
  verificationStatus: VerificationStatus;
  adminNotes: string | null;
}

export interface SponsorProfile {
  id: string;
  userId: string;
  companyName: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: string | null;
}

export interface Event {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  city: string;
  state: string;
  startDate: string;
  endDate: string;
  category: string;
  isPublic: boolean;
  ticketOption: TicketOption;
  ticketPrice: number | null;
  maxSeats: number | null;
  status: EventStatus;
  rejectionReason: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface SponsorshipPackage {
  id: string;
  eventId: string;
  title: string;
  description: string;
  priceInr: number;
  perks: string[];
  availableSlots: number;
}

export interface SponsorInterest {
  id: string;
  sponsorId: string;
  packageId: string;
  status: InterestStatus;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  eventId: string | null;
  content: string;
  createdAt: string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// API response wrappers
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code: string;
}
