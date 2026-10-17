import { supabase } from './supabase';

export type LiveSyncEventType =
  | 'order_created'
  | 'payment_declared'
  | 'order_updated'
  | 'catalog_updated';

export interface LiveSyncPayload {
  type: LiveSyncEventType;
  orderId?: string;
  publicReference?: string;
  timestamp: number;
}

type LiveSyncListener = (payload: LiveSyncPayload) => void;

const listeners = new Set<LiveSyncListener>();
let supabaseChannelSubscribed = false;
let broadcastChannel: BroadcastChannel | null = null;

// Initialize native BroadcastChannel for instant zero-latency same-browser tab sync
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('convivium_live_sync_v1');
    broadcastChannel.onmessage = (event: MessageEvent<LiveSyncPayload>) => {
      if (event?.data?.type) {
        listeners.forEach((cb) => {
          try {
            cb(event.data);
          } catch (e) {
            console.error('Error in live sync listener', e);
          }
        });
      }
    };
  }
} catch {
  // Ignore if BroadcastChannel is not supported
}

// Initialize shared Supabase Realtime broadcast channel for cross-device sync (including anon <-> staff)
const liveChannel = supabase.channel('convivium_global_live_sync', {
  config: {
    broadcast: { self: false },
  },
});

function ensureSupabaseChannel() {
  if (supabaseChannelSubscribed) return;
  supabaseChannelSubscribed = true;
  try {
    liveChannel
      .on('broadcast', { event: 'sync' }, (msg) => {
        const payload = msg?.payload as LiveSyncPayload | undefined;
        if (payload?.type) {
          listeners.forEach((cb) => {
            try {
              cb(payload);
            } catch (e) {
              console.error('Error in live sync broadcast listener', e);
            }
          });
        }
      })
      .subscribe();
  } catch {
    // Ignore in test environments where channel.on('broadcast') might not be mocked
  }
}

export function emitLiveSyncEvent(
  type: LiveSyncEventType,
  details?: { orderId?: string; publicReference?: string }
): void {
  ensureSupabaseChannel();
  const payload: LiveSyncPayload = {
    type,
    orderId: details?.orderId,
    publicReference: details?.publicReference,
    timestamp: Date.now(),
  };

  // 1. Notify other tabs in the same browser via BroadcastChannel
  try {
    broadcastChannel?.postMessage(payload);
  } catch {
    // Ignore
  }

  // 2. Notify other devices (Client phones, Kitchen tablets, Admin laptops) via Supabase Realtime Broadcast
  try {
    liveChannel.send({
      type: 'broadcast',
      event: 'sync',
      payload,
    });
  } catch {
    // Ignore
  }
}

export function subscribeToLiveSyncEvents(listener: LiveSyncListener): () => void {
  ensureSupabaseChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
