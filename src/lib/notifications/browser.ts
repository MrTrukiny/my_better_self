/** Browser-side push helpers. Everything here no-ops where push isn't supported. */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Stops this browser's push subscription; returns its endpoint, or null if there was none. */
export async function unsubscribeDevice(): Promise<string | null> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) {
      return null;
    }
    await subscription.unsubscribe();
    return subscription.endpoint;
  } catch {
    return null;
  }
}

/** The VAPID public key (base64url) as the bytes `PushManager.subscribe` expects. */
export function applicationServerKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = (publicKey + "=".repeat((4 - (publicKey.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
