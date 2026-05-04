const rawApiUrl = 'https://agi-meeting-room1.onrender.com/api';

export const environment = {
  production: true,
  /** Replace rawApiUrl with your Render service URL before shipping an APK. */
  apiUrl: rawApiUrl.replace(/\/+$/, ''),
};
