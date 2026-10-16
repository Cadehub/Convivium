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
  name_fr: string;
  name_en: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name_fr: string;
  name_en: string | null;
  item_type: MenuItemType;
  price: number; // in XAF (integer)
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

export interface OrderItemSnapshot {
  id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  special_notes: string | null;
  image_url?: string | null;
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
  notes: string | null;
  preparation_status: PreparationStatus;
  payment_status: PaymentStatus;
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
}
