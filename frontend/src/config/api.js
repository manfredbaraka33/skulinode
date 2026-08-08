/**
 * Single source of truth for API base URLs.
 * Auto-detects local vs production by checking the current hostname —
 * no .env files, no build-time config, just runtime JS.
 */
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const NECTA_API = isLocal
  ? 'http://127.0.0.1:8000/api/public/necta'
  : 'https://skulinode.co.tz/api/public/necta';

export const API = isLocal
  ? 'http://127.0.0.1:8000/api/v1'
  : 'https://skulinode.co.tz/api/v1';



export const TCU_API = isLocal
  ? 'http://127.0.0.1:8000/api/tcu'
  : 'https://skulinode.co.tz/api/tcu';


