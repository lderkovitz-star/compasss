'use client';

/**
 * Module D: Web Bluetooth Heart Rate Monitor Integration
 * Uses standard BLE Heart Rate Service (UUID 0x180D)
 * Falls back to simulated telemetry when Bluetooth is unavailable (non-Chrome browsers, iOS, testing)
 */

export type BPMReading = {
  bpm: number;
  recordedAt: number; // epoch ms as number (will be cast to BigInt on server)
  deviceId: string;
};

type HRCallback = (reading: BPMReading) => void;

let simulationInterval: NodeJS.Timeout | null = null;

function simulateHeartRate(callback: HRCallback, stressPhase: boolean = false) {
  const baseBPM = 72;
  let tick = 0;
  simulationInterval = setInterval(() => {
    tick++;
    // Simulate stress spikes every ~8 readings
    const spike = stressPhase && tick % 8 === 0;
    const noise = Math.round((Math.random() - 0.5) * 8);
    const bpm = spike
      ? Math.round(100 + Math.random() * 30)
      : Math.max(55, Math.min(115, baseBPM + noise + Math.round(Math.sin(tick / 5) * 6)));

    callback({
      bpm,
      recordedAt: Date.now(),
      deviceId: 'SIMULATED-HRM',
    });
  }, 3000); // every 3 seconds
}

export async function startHeartRateMonitor(
  callback: HRCallback,
  stressPhase: boolean = false
): Promise<{ mode: 'bluetooth' | 'simulated'; stop: () => void }> {
  // Check Web Bluetooth availability
  if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service'],
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');

      await characteristic.startNotifications();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const target = event.target as any;
        const value: DataView = target.value;
        const flags = value.getUint8(0);
        const bpm = flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1);
        callback({ bpm, recordedAt: Date.now(), deviceId: device.id || 'BLE-HRM' });
      });

      return {
        mode: 'bluetooth',
        stop: () => {
          characteristic.stopNotifications().catch(() => {});
          device.gatt!.disconnect();
        },
      };
    } catch {
      // User denied permission or device not found — fall through to simulation
    }
  }

  // Simulation fallback
  simulateHeartRate(callback, stressPhase);
  return {
    mode: 'simulated',
    stop: () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
    },
  };
}

export async function postBiometrics(
  sessionId: string,
  scenarioId: string | null,
  readings: BPMReading[]
) {
  if (readings.length === 0) return;
  try {
    await fetch('/api/biometrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        readings.map((r) => ({
          sessionId,
          scenarioId,
          bpm: r.bpm,
          recordedAt: r.recordedAt,
          deviceId: r.deviceId,
        }))
      ),
    });
  } catch {
    // Silently fail — biometric data is supplemental, not blocking
  }
}
