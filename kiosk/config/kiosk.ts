export const kioskConfig = {
  // Polling fallback when websockets are down
  pollingIntervalMs: 30000, 
  
  // UI related configurations
  theme: {
    colors: {
      available: '#22c55e', // Green 500
      ongoing: '#ef4444',   // Red 500
      upcoming: '#eab308',  // Yellow 500
    }
  },

  // Feature flags
  features: {
    enableBooking: true,
    enableAIIndicators: true, // Mocked for now
    showWeeklyView: true,
  }
};
