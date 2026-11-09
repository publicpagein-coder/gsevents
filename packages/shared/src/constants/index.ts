export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export const EVENT_CATEGORIES = [
  "NAVRATRI",
  "GARBA",
  "DIWALI_FAIR",
  "GANESH_UTSAV",
  "WEDDING_EXPO",
  "OTHER",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  NAVRATRI: "Navratri",
  GARBA: "Garba",
  DIWALI_FAIR: "Diwali Fair",
  GANESH_UTSAV: "Ganesh Utsav",
  WEDDING_EXPO: "Wedding Expo",
  OTHER: "Other",
};

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    name: "Basic",
    priceInr: 500,
    features: ["Browse events", "Express interest", "Basic contact sharing"],
  },
  PREMIUM: {
    name: "Premium",
    priceInr: 2000,
    features: [
      "All Basic features",
      "Priority placement",
      "Advanced analytics",
      "Verified sponsor badge",
      "Direct messaging",
    ],
  },
} as const;

export const COMMISSION_RATES = {
  sponsorshipDeal: 0.03, // 3% platform commission on confirmed deals
  ticketSale: 0.05,      // 5% on ticket sales
  minCommissionInr: 50,  // Minimum commission per transaction
} as const;

export const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const;
