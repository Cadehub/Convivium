import { supabase } from '../lib/supabase';
import { generateClientAccessToken, generateIdempotencyKey, storeClientOrderToken } from '../lib/security';
import type {
  Order,
  OrderMode,
  PaymentMethodSetting,
  PaymentStatus,
  PreparationStatus,
  MobileOperator,
} from '../types';

export interface CreateOrderPayload {
  customerName: string;
  customerPhone?: string;
  orderMode: OrderMode;
  locationDetail?: string; // room number, table number, or delivery address
  notes?: string;
  items: Array<{
    item_id: string;
    quantity: number;
    notes?: string;
  }>;
  existingIdempotencyKey?: string;
  existingRawToken?: string;
}

export interface CreateOrderResult {
  success: boolean;
  id: string;
  public_reference: string;
  total_amount: number;
  payment_status: PaymentStatus;
  preparation_status: PreparationStatus;
  raw_token: string;
  is_replayed?: boolean;
}

export const ordersService = {
  // Public: Create a new order with idempotency & server-side total validation
  async createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
    const rawToken = payload.existingRawToken || generateClientAccessToken();
    const idempotencyKey = payload.existingIdempotencyKey || generateIdempotencyKey();

    const formattedItems = payload.items.map((i) => ({
      item_id: i.item_id,
      quantity: Math.max(1, Math.min(50, Math.round(Number(i.quantity) || 1))),
      notes: i.notes ? i.notes.trim() : '',
    }));

    const { data, error } = await supabase.rpc('create_order', {
      p_customer_name: payload.customerName.trim(),
      p_customer_phone: payload.customerPhone ? payload.customerPhone.trim() : '',
      p_order_mode: payload.orderMode,
      p_location_detail: payload.locationDetail ? payload.locationDetail.trim() : '',
      p_notes: payload.notes ? payload.notes.trim() : '',
      p_items: formattedItems,
      p_idempotency_key: idempotencyKey,
      p_raw_token: rawToken,
    });

    if (error) {
      console.error('Error creating order in Supabase', error);
      throw new Error(error.message || 'Impossible de créer la commande.');
    }

    const res = data as unknown as {
      success: boolean;
      id: string;
      public_reference: string;
      total_amount: number;
      payment_status: PaymentStatus;
      preparation_status: PreparationStatus;
      is_replayed?: boolean;
    };

    if (!res || !res.success) {
      throw new Error('Échec de la validation serveur de la commande.');
    }

    // Persist token in client browser
    storeClientOrderToken(res.public_reference, rawToken);

    return {
      ...res,
      raw_token: rawToken,
    };
  },

  // Public: Lookup order status using cryptographic access token
  async getClientOrder(publicReference: string, rawToken: string): Promise<Order> {
    const { data, error } = await supabase.rpc('get_client_order', {
      p_public_reference: publicReference.trim(),
      p_raw_token: rawToken.trim(),
    });

    if (error) {
      console.error('Error retrieving client order', error);
      throw new Error(error.message);
    }

    const res = data as unknown as { success: boolean; order?: Order; error?: string };
    if (!res || !res.success || !res.order) {
      throw new Error(res?.error || 'Commande introuvable ou accès refusé.');
    }

    return res.order;
  },

  // Public: Submit customer payment declaration
  async submitPaymentDeclaration(declaration: {
    publicReference: string;
    rawToken: string;
    operator: MobileOperator;
    declaredReference?: string;
    rawSms?: string;
    payerPhone?: string;
    note?: string;
  }): Promise<{ success: boolean; payment_status: PaymentStatus; message?: string }> {
    const { data, error } = await supabase.rpc('submit_payment_declaration', {
      p_public_reference: declaration.publicReference.trim(),
      p_raw_token: declaration.rawToken.trim(),
      p_operator: declaration.operator,
      p_declared_ref: declaration.declaredReference ? declaration.declaredReference.trim() : '',
      p_raw_sms: declaration.rawSms ? declaration.rawSms.trim() : '',
      p_payer_phone: declaration.payerPhone ? declaration.payerPhone.trim() : '',
      p_note: declaration.note ? declaration.note.trim() : '',
    });

    if (error) {
      throw new Error(error.message || 'Échec de l’envoi de la déclaration.');
    }

    const res = data as unknown as {
      success: boolean;
      payment_status: PaymentStatus;
      message?: string;
    };

    return res;
  },

  // Public: Get configured active Mobile Money payment methods
  async getPublicPaymentOptions(): Promise<PaymentMethodSetting[]> {
    const { data, error } = await supabase.rpc('get_public_payment_options');
    if (error) {
      console.error('Error fetching public payment options', error);
      return [];
    }
    return ((data as unknown) as PaymentMethodSetting[]) || [];
  },

  // Staff: Fetch orders with items, declarations, and verifications
  async getStaffOrders(filters?: {
    payment_status?: PaymentStatus;
    preparation_status?: PreparationStatus;
    search?: string;
    limit?: number;
  }): Promise<Order[]> {
    let query = supabase
      .from('orders')
      .select(`
        id,
        public_reference,
        order_mode,
        order_origin,
        customer_name,
        customer_phone,
        room_number,
        table_number,
        delivery_address,
        notes,
        preparation_status,
        payment_status,
        total_amount,
        created_at,
        updated_at,
        order_items (
          id,
          item_name,
          unit_price,
          quantity,
          subtotal,
          special_notes
        ),
        payment_declarations (
          id,
          operator,
          declared_reference,
          raw_sms_text,
          payer_phone,
          customer_note,
          created_at
        ),
        payment_verifications (
          id,
          status,
          verified_reference,
          internal_notes,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }
    if (filters?.preparation_status) {
      query = query.eq('preparation_status', filters.preparation_status);
    }
    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`public_reference.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching staff orders', error);
      throw error;
    }

    // Map order_items to items
    return ((data || []) as unknown as Array<Order & { order_items: Order['items'] }>).map((o) => ({
      ...o,
      items: o.order_items || [],
    }));
  },

  // Cuisine-Only: Confirm customer payment
  async confirmPaymentByCuisine(orderId: string, verifiedReference: string, internalNotes?: string): Promise<void> {
    const { data, error } = await supabase.rpc('confirm_payment', {
      p_order_id: orderId,
      p_verified_reference: verifiedReference.trim(),
      p_internal_notes: internalNotes ? internalNotes.trim() : '',
    });

    if (error) {
      throw new Error(error.message || 'Impossible de confirmer le paiement.');
    }

    const res = data as unknown as { success: boolean };
    if (!res?.success) {
      throw new Error('Échec de la confirmation du paiement.');
    }
  },

  // Cuisine-Only: Reject customer payment
  async rejectPaymentByCuisine(orderId: string, reason: string): Promise<void> {
    const { data, error } = await supabase.rpc('reject_payment', {
      p_order_id: orderId,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new Error(error.message || 'Impossible de rejeter le paiement.');
    }

    const res = data as unknown as { success: boolean };
    if (!res?.success) {
      throw new Error('Échec du rejet du paiement.');
    }
  },

  // Cuisine-Only: Request payment review (flag ambiguous transaction)
  async requestReviewByCuisine(orderId: string, internalNotes: string): Promise<void> {
    const { data, error } = await supabase.rpc('request_payment_review', {
      p_order_id: orderId,
      p_internal_notes: internalNotes.trim(),
    });

    if (error) {
      throw new Error(error.message || 'Impossible de marquer pour vérification.');
    }

    const res = data as unknown as { success: boolean };
    if (!res?.success) {
      throw new Error('Échec du signalement de vérification.');
    }
  },

  // Staff (Admin / Cuisine): Update order preparation status
  async updatePreparationStatus(orderId: string, newStatus: PreparationStatus): Promise<void> {
    const { data, error } = await supabase.rpc('update_order_preparation_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
    });

    if (error) {
      throw new Error(error.message || 'Transition de statut refusée.');
    }

    const res = data as unknown as { success: boolean };
    if (!res?.success) {
      throw new Error('Échec du changement de statut.');
    }
  },
};
