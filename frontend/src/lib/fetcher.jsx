export const fetcher = (url, opts = {}) => fetch(url, { credentials: 'same-origin', ...opts });

export const api = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const useApi = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});
