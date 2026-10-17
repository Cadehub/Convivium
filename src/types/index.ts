export type UserRole = 'admin' | 'cuisine';

export type OrderMode = 'dine_in' | 'room_service' | 'takeaway' | 'delivery';

export type PaymentStatus =
  | 'awaiting_payment'
  | 'payment_declared'
  | 'paid'
  | 'payment_rejected'
  | 'payment_review_required';

export type PreparationStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type MobileOperator = 'mtn' | 'orange';

export type MenuItemType = 'dish' | 'drink' | 'other';

export interface MenuCategory {
  id: string;
  parent_id?: string | null;
  name_fr: string;
  name_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  subcategories?: MenuCategory[];
}

export interface MenuItemVariant {
  id: string;
  menu_item_id: string;
  name_fr: string;
  name_en: string | null;
  price: number | null; // in XAF, null if inheriting item base price
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface MenuComplement {
  id: string;
  name_fr: string;
  name_en: string | null;
  price: number; // in XAF (mandatory, can be 0)
  is_active: boolean;
  is_all_categories: boolean;
  sort_order: number;
  category_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name_fr: string;
  name_en: string | null;
  description_fr?: string | null;
  description_en?: string | null;
  item_type: MenuItemType;
  price: number | null; // in XAF (integer, optional if item has variants)
  has_variants?: boolean;
  variants?: MenuItemVariant[];
  image_url: string | null;
  is_available: boolean;
  preparation_time_minutes?: number | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartComplementSelection {
  complement: MenuComplement;
  quantity: number;
}

export interface CartItem {
  item: MenuItem;
  variant?: MenuItemVariant | null;
  selectedComplements?: CartComplementSelection[];
  quantity: number;
  notes?: string;
}

export interface OrderItemSnapshot {
  id: string;
  item_name: string;
  variant_id?: string | null;
  variant_name?: string | null;
  selected_complements?: Array<{
    complement_id: string;
    name: string;
    unit_price: number;
    quantity: number;
    subtotal: number;
  }>;
  unit_price: number;
  quantity: number;
  subtotal: number;
  special_notes: string | null;
  image_url?: string | null;
  preparation_time_minutes?: number | null;
}

export interface Order {
  id: string;
  public_reference: string;
  order_mode: OrderMode;
  order_origin: 'public_client' | 'staff_manual';
  customer_name: string;
  customer_phone: string | null;
  room_number: string | null;
  table_number: string | null;
  delivery_address: string | null;
  delivery_schedule_type?: 'instant' | 'scheduled' | null;
  scheduled_delivery_time?: string | null;
  notes: string | null;
  preparation_status: PreparationStatus;
  payment_status: PaymentStatus;
  delivery_fee?: number;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  items?: OrderItemSnapshot[];
  order_items?: OrderItemSnapshot[];
  payment_declarations?: PaymentDeclaration[];
  payment_verifications?: PaymentVerification[];
}

export interface PaymentDeclaration {
  id: string;
  order_id: string;
  operator: MobileOperator;
  declared_reference: string | null;
  raw_sms_text: string | null;
  payer_phone: string | null;
  customer_note: string | null;
  created_at: string;
}

export interface PaymentVerification {
  id: string;
  order_id: string;
  verified_by: string;
  status: 'confirmed' | 'rejected' | 'review_required';
  verified_reference: string | null;
  internal_notes: string | null;
  created_at: string;
}

export interface PaymentMethodSetting {
  id: MobileOperator;
  is_active: boolean;
  merchant_code: string;
  phone_number?: string | null;
  account_name: string;
  ussd_mode: 'full' | 'guided';
  instructions_fr: string | null;
  instructions_en: string | null;
  is_tested_on_device: boolean;
  updated_at?: string;
}

export interface RestaurantSettings {
  id: string;
  hotel_name: string;
  hotel_address: string;
  hotel_phone: string | null;
  currency: string;
  modes_active: {
    dine_in: boolean;
    room_service: boolean;
    takeaway?: boolean;
    delivery: boolean;
  };
  delivery_fee?: number | null;
  updated_at?: string;
}

export interface StaffProfile {
  id: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at?: string;
  email?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  target_entity: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  profiles?: {
    full_name?: string;
    role?: string;
  } | null;
}
