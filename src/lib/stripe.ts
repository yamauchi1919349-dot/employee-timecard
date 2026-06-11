import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getAppUrl(request?: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const origin = request?.headers.get("origin");
  const forwardedProto = request?.headers.get("x-forwarded-proto");
  const host = request?.headers.get("host");
  const forwardedUrl = forwardedProto && host ? `${forwardedProto}://${host}` : null;
  const baseUrl = appUrl || origin || forwardedUrl;

  if (!baseUrl) {
    throw new Error("Application URL is not set. Set NEXT_PUBLIC_APP_URL or send origin/host headers.");
  }

  return normalizeAbsoluteUrl(baseUrl);
}

function normalizeAbsoluteUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Application URL must be an absolute http or https URL.");
  }
  return url;
}
