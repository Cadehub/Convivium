import { supabase } from '../lib/supabase';
import { generateClientAccessToken, generateIdempotencyKey, storeClientOrderToken } from '../lib/security';
import { emitLiveSyncEvent } from '../lib/realtime';
import type {
  Order,
  OrderMode,
  PaymentMethodSetting,
  PaymentStatus,
  PreparationStatus,
  MobileOperator,
  OrderItemSnapshot,
} from '../types';

export interface CreateOrderPayload {
  customerName: string;
  customerPhone?: string;
  orderMode: OrderMode;
  locationDetail?: string; // room number, table number, or delivery address
  serviceLocationId?: string | null;
  deliveryScheduleType?: 'instant' | 'scheduled';
  scheduledDeliveryTime?: string | null;
  notes?: string;
  items: Array<{
    item_id: string;
    variant_id?: string | null;
    complements?: Array<{
      complement_id: string;
      quantity: number;
    }>;
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
  delivery_fee?: number;
  delivery_schedule_type?: 'instant' | 'scheduled' | null;
  scheduled_delivery_time?: string | null;
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
      variant_id: i.variant_id || null,
      complements: (i.complements || []).map((c) => ({
        complement_id: c.complement_id,
        quantity: Math.max(1, Math.min(20, Math.round(Number(c.quantity) || 1))),
      })),
      quantity: Math.max(1, Math.min(50, Math.round(Number(i.quantity) || 1))),
      notes: i.notes ? i.notes.trim() : '',
    }));

    const { data, error } = await supabase.rpc('create_order_with_schedule', {
      p_customer_name: payload.customerName.trim(),
      p_customer_phone: payload.customerPhone ? payload.customerPhone.trim() : '',
      p_order_mode: payload.orderMode,
      p_location_detail: payload.locationDetail ? payload.locationDetail.trim() : '',
      p_notes: payload.notes ? payload.notes.trim() : '',
      p_items: formattedItems,
      p_idempotency_key: idempotencyKey,
      p_raw_token: rawToken,
      p_delivery_schedule_type: payload.deliveryScheduleType || 'instant',
      p_scheduled_delivery_time: payload.scheduledDeliveryTime
        ? payload.scheduledDeliveryTime.trim()
        : null,
      p_service_location_id: payload.serviceLocationId || null,
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
      delivery_fee?: number;
      delivery_schedule_type?: 'instant' | 'scheduled' | null;
      scheduled_delivery_time?: string | null;
      payment_status: PaymentStatus;
      preparation_status: PreparationStatus;
      is_replayed?: boolean;
    };

    if (!res || !res.success) {
      throw new Error('Échec de la validation serveur de la commande.');
    }

    // Persist token in client browser
    storeClientOrderToken(res.public_reference, rawToken);
    emitLiveSyncEvent('order_created', {
      orderId: res.id,
      publicReference: res.public_reference,
    });

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

    emitLiveSyncEvent('payment_declared', {
      publicReference: declaration.publicReference.trim(),
    });

    return res;
  },

  // Public: Cancel order by customer if not yet paid/completed
  async cancelOrderClient(
    publicReference: string,
    rawToken: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> {
    const { data, error } = await supabase.rpc('cancel_order_client', {
      p_public_reference: publicReference.trim(),
      p_raw_token: rawToken.trim(),
      p_reason: reason ? reason.trim() : '',
    });

    if (error) {
      throw new Error(error.message || 'Impossible d’annuler la commande.');
    }

    const res = data as unknown as { success: boolean; error?: string; message?: string };
    if (!res?.success) {
      throw new Error(res?.error || 'Échec de l’annulation de la commande.');
    }

    emitLiveSyncEvent('order_updated', {
      publicReference: publicReference.trim(),
    });

    return res;
  },

  // Public: Get configured active Mobile Money payment options
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
        service_location_id,
        service_location_snapshot,
        delivery_address,
        delivery_schedule_type,
        scheduled_delivery_time,
        notes,
        preparation_status,
        payment_status,
        delivery_fee,
        total_amount,
        created_at,
        updated_at,
        order_items (
          id,
          item_name,
          variant_id,
          variant_name,
          selected_complements,
          unit_price,
          quantity,
          subtotal,
          special_notes,
          menu_items (
            image_url,
            preparation_time_minutes
          )
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

    // Map order_items to items with image_url and preparation_time_minutes
    interface RawOrderItem extends OrderItemSnapshot {
      menu_items?: {
        image_url?: string | null;
        preparation_time_minutes?: number | null;
      } | null;
    }

    type DbOrderRow = Omit<Order, 'items' | 'order_items'> & {
      order_items?: RawOrderItem[];
    };

    return ((data || []) as unknown as DbOrderRow[]).map((o) => ({
      ...o,
      items: (o.order_items || []).map((it) => ({
        id: it.id,
        item_name: it.item_name,
        variant_id: it.variant_id || null,
        variant_name: it.variant_name || null,
        selected_complements: it.selected_complements || [],
        unit_price: it.unit_price,
        quantity: it.quantity,
        subtotal: it.subtotal,
        special_notes: it.special_notes,
        image_url: it.image_url || it.menu_items?.image_url || null,
        preparation_time_minutes:
          it.preparation_time_minutes ?? it.menu_items?.preparation_time_minutes ?? null,
      })),
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

    emitLiveSyncEvent('order_updated', { orderId });
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

    emitLiveSyncEvent('order_updated', { orderId });
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

    emitLiveSyncEvent('order_updated', { orderId });
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

    emitLiveSyncEvent('order_updated', { orderId });
  },

  // Staff (Cuisine / Admin): Clear orders history (all or completed/cancelled/rejected)
  async clearOrdersHistory(scope: 'all' | 'completed' = 'all'): Promise<number> {
    const { data, error } = await supabase.rpc('clear_orders_history', {
      p_scope: scope,
    });

    if (error) {
      throw new Error(error.message || 'Impossible de vider l’historique des commandes.');
    }

    const res = data as unknown as { success: boolean; deleted_count?: number };
    if (!res?.success) {
      throw new Error('Échec de la suppression de l’historique.');
    }

    emitLiveSyncEvent('order_updated');
    return res.deleted_count ?? 0;
  },
};
