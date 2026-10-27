"use client";

import { useEffect } from "react";

/**
 * Scrolls to the element with `id` when the URL's hash names it. A target inside a Suspense
 * boundary streams in after the browser's own jump to the hash, so it would be missed.
 */
export function ScrollToHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash === `#${id}`) {
      document.getElementById(id)?.scrollIntoView();
    }
  }, [id]);
  return null;
}
