export const environment = {
  production: false,
  apiBaseUrl: '/api',
  apiUrl: '/api',
  useMockData: false,
  // Matches environment.prod.ts, so development sees the same catalogue production does: the real
  // one, from the API. Left on `true`, the storefront read eight invented products from
  // assets/data/products.json and never called the API at all, which made a product added in the
  // dashboard look as though it had not been saved. Set it back to `true` only to work on the
  // storefront with no backend running — and expect the catalogue to be fiction while you do.
  useMockProducts: false,
  storagePrefix: 'lk-',
  enableLogging: true,
};
