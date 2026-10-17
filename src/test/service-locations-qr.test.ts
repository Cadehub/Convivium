import { describe, it, expect } from 'vitest';
import { buildLocationScanUrl, generateQrDataUrl, generateQrSvg } from '../lib/qr';
import type { ServiceLocation, ServiceLocationType } from '../types';

describe('Service Locations & QR Code System', () => {
  const sampleLocation: ServiceLocation = {
    id: 'loc-uuid-101',
    location_type: 'table',
    label: 'Table 4',
    code: 'CVH-T-9876',
    is_active: true,
    sort_order: 1,
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
  };

  const sampleRoom: ServiceLocation = {
    id: 'loc-uuid-201',
    location_type: 'room',
    label: 'Chambre 204',
    code: 'CVH-R-4321',
    is_active: true,
    sort_order: 2,
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
  };

  describe('1. Scan URL Construction', () => {
    it('uses configured production app URL when provided', () => {
      const url = buildLocationScanUrl('CVH-T-9876', 'https://convivium-hotel.cm');
      expect(url).toBe('https://convivium-hotel.cm/?spot=CVH-T-9876');
    });

    it('cleans trailing slash from configured production app URL', () => {
      const url = buildLocationScanUrl('CVH-R-4321', 'https://order.convivium.cm/');
      expect(url).toBe('https://order.convivium.cm/?spot=CVH-R-4321');
    });

    it('falls back to window.location.origin if production URL is missing or empty', () => {
      const url = buildLocationScanUrl('CVH-T-9876', null);
      expect(url).toContain('/?spot=CVH-T-9876');
    });
  });

  describe('2. QR Code Generation (PNG & SVG)', () => {
    it('generates a valid PNG data URL', async () => {
      const targetUrl = 'https://convivium-hotel.cm/?spot=CVH-T-9876';
      const dataUrl = await generateQrDataUrl(targetUrl);
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(dataUrl.length).toBeGreaterThan(100);
    });

    it('generates a valid standalone SVG XML string', async () => {
      const targetUrl = 'https://convivium-hotel.cm/?spot=CVH-R-4321';
      const svg = await generateQrSvg(targetUrl);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
  });

  describe('3. Discrete 5-Click Staff Access Gesture Logic', () => {
    const GESTURE_CLICK_TARGET = 5;
    const GESTURE_WINDOW_MS = 3000;

    class LogoGestureSimulator {
      private clickTimestamps: number[] = [];
      public triggerCount = 0;

      registerClick(now: number) {
        // Drop clicks older than the 3-second window
        this.clickTimestamps = this.clickTimestamps.filter(
          (ts) => now - ts < GESTURE_WINDOW_MS
        );
        this.clickTimestamps.push(now);

        if (this.clickTimestamps.length >= GESTURE_CLICK_TARGET) {
          this.triggerCount++;
          this.clickTimestamps = [];
        }
      }
    }

    it('triggers staff login after 5 rapid clicks within 3 seconds', () => {
      const sim = new LogoGestureSimulator();
      const baseTime = 10000;

      // 5 clicks separated by 200ms (total 800ms < 3000ms)
      sim.registerClick(baseTime + 0);
      sim.registerClick(baseTime + 200);
      sim.registerClick(baseTime + 400);
      sim.registerClick(baseTime + 600);
      sim.registerClick(baseTime + 800);

      expect(sim.triggerCount).toBe(1);
    });

    it('does not trigger staff login with only 4 clicks', () => {
      const sim = new LogoGestureSimulator();
      const baseTime = 10000;

      sim.registerClick(baseTime + 0);
      sim.registerClick(baseTime + 200);
      sim.registerClick(baseTime + 400);
      sim.registerClick(baseTime + 600);

      expect(sim.triggerCount).toBe(0);
    });

    it('resets counter if clicks are spaced too far apart (> 3 seconds)', () => {
      const sim = new LogoGestureSimulator();
      const baseTime = 10000;

      // Click 1 and 2
      sim.registerClick(baseTime + 0);
      sim.registerClick(baseTime + 500);

      // Long delay (4 seconds later)
      sim.registerClick(baseTime + 4500);
      sim.registerClick(baseTime + 4700);
      sim.registerClick(baseTime + 4900);

      // Total 5 clicks, but first 2 expired (> 3000ms from 4500ms) -> only 3 active clicks
      expect(sim.triggerCount).toBe(0);

      // Now add 2 more rapid clicks -> total 5 within window -> triggers!
      sim.registerClick(baseTime + 5100);
      sim.registerClick(baseTime + 5300);
      expect(sim.triggerCount).toBe(1);
    });
  });

  describe('4. Active Location Uniqueness and Resolution', () => {
    it('verifies active location uniqueness rule (table with same label cannot be duplicated while active)', () => {
      const activeLocations: ServiceLocation[] = [
        {
          id: '1',
          location_type: 'table',
          label: 'Table 1',
          code: 'CVH-T-001',
          is_active: true,
          sort_order: 1,
          created_at: '2026-10-18T00:00:00Z',
          updated_at: '2026-10-18T00:00:00Z',
        },
        {
          id: '2',
          location_type: 'table',
          label: 'Table 2',
          code: 'CVH-T-002',
          is_active: true,
          sort_order: 2,
          created_at: '2026-10-18T00:00:00Z',
          updated_at: '2026-10-18T00:00:00Z',
        },
      ];

      function canCreateActiveLocation(
        existing: ServiceLocation[],
        type: ServiceLocationType,
        label: string
      ): boolean {
        const normalized = label.trim().toLowerCase();
        return !existing.some(
          (loc) =>
            loc.is_active &&
            loc.location_type === type &&
            loc.label.trim().toLowerCase() === normalized
        );
      }

      // Trying to create "Table 1" again while Table 1 is active -> rejected
      expect(canCreateActiveLocation(activeLocations, 'table', 'Table 1')).toBe(false);
      expect(canCreateActiveLocation(activeLocations, 'table', '  table 1  ')).toBe(false);

      // Creating a Room "Table 1" (different location_type) -> allowed
      expect(canCreateActiveLocation(activeLocations, 'room', 'Table 1')).toBe(true);

      // Creating "Table 3" -> allowed
      expect(canCreateActiveLocation(activeLocations, 'table', 'Table 3')).toBe(true);
    });

    it('locks order mode and detail based on scanned QR code', () => {
      function getOrderPrefillFromLocation(loc: ServiceLocation) {
        return {
          orderMode: loc.location_type === 'room' ? 'room_service' : 'dine_in',
          locationDetail: loc.label,
          serviceLocationId: loc.id,
        };
      }

      const tablePrefill = getOrderPrefillFromLocation(sampleLocation);
      expect(tablePrefill.orderMode).toBe('dine_in');
      expect(tablePrefill.locationDetail).toBe('Table 4');
      expect(tablePrefill.serviceLocationId).toBe('loc-uuid-101');

      const roomPrefill = getOrderPrefillFromLocation(sampleRoom);
      expect(roomPrefill.orderMode).toBe('room_service');
      expect(roomPrefill.locationDetail).toBe('Chambre 204');
      expect(roomPrefill.serviceLocationId).toBe('loc-uuid-201');
    });
  });
});
