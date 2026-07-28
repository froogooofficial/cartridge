// Shared device profile: the judging surface. 393x852, mid-tier Android.
export const VIEWPORT = { width: 393, height: 852 };
export const DPR = 3;

// Mid-tier Android profile (Moto G Power class), matching Lighthouse mobile defaults.
export const CPU_THROTTLE = 4;
export const NETWORK = {
  // Lighthouse "Slow 4G" simulated throttling values.
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

export const UA =
  'Mozilla/5.0 (Linux; Android 13; moto g power (2022)) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export const contextOptions = (extra = {}) => ({
  viewport: VIEWPORT,
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
  userAgent: UA,
  ...extra,
});

export const EXECUTABLE = process.env.PW_CHROMIUM || undefined;
