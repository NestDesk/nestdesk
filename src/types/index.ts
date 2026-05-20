export type UserRole = "owner" | "tenant";
export type PropertyType = "pg" | "hostel" | "coliving" | "rental";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface Owner {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  kyc_address_verified: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hostel {
  id: string;
  owner_id: string;
  name: string;
  property_type: PropertyType;
  address: string;
  city: string;
  state: string;
  pincode: string;
  total_rooms: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LoginActivity {
  id: string;
  user_id: string | null;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}
