/**
 * Consumes the aggregated login-config request started by the inline script
 * in index.html. That request begins while the app bundle is still
 * downloading, so by the time the login screen mounts the response is
 * usually already here and the page paints without waiting on another
 * round trip.
 *
 * Each field is consumed at most once; afterwards (and whenever the
 * prefetch failed or never ran, e.g. in Electron or the dev server) callers
 * fall back to their normal per-endpoint API requests.
 */
interface LoginConfigResponse {
  setup_required: boolean;
  registration_allowed: boolean;
  password_login_allowed: boolean;
  password_reset_allowed: boolean;
  oidc_silent_login_default: { enabled: boolean; locked?: boolean };
  sso_providers: Array<{
    id: number;
    name: string;
    type: string;
    displayOrder: number;
  }>;
}

declare global {
  interface Window {
    __TERMIX_LOGIN_CONFIG__?: Promise<LoginConfigResponse> | null;
  }
}

const consumedFields = new Set<keyof LoginConfigResponse>();

export function consumeLoginConfigField<K extends keyof LoginConfigResponse>(
  field: K,
): Promise<LoginConfigResponse[K]> | null {
  if (typeof window === "undefined") return null;
  const promise = window.__TERMIX_LOGIN_CONFIG__;
  if (!promise || consumedFields.has(field)) return null;
  consumedFields.add(field);
  return promise.then((config) => {
    if (!config || config[field] === undefined) {
      throw new Error("login-config field missing");
    }
    return config[field];
  });
}
