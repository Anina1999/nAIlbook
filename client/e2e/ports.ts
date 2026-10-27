// The E2E server and client run on their own ports, so a running dev server
// (3000 and 5173, with dev.db) is never reused.
export const API_PORT = 3100;
export const CLIENT_PORT = 5180;
export const API_URL = `http://localhost:${API_PORT}/api`;
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;
