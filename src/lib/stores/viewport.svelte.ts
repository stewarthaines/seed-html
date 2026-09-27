/**
 * Viewport — is the app on a phone-sized screen? One media query, read
 * reactively as `viewport.phone`. The 720px line is the one the components'
 * own narrow-screen styles use (process/APP_MAKEOVER_LIBRARY.md, phase 5).
 */
export const PHONE_QUERY = '(max-width: 720px)';

class Viewport {
  phone = $state(false);

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(PHONE_QUERY);
    this.phone = query.matches;
    query.addEventListener('change', event => {
      this.phone = event.matches;
    });
  }
}

export const viewport = new Viewport();
