# Fresh Mart — Online Grocery & General Store (Karachi)

Bilingual (English + Urdu RTL) online grocery and general store serving Karachi, Pakistan with PKR Cash on Delivery, distance-based delivery pricing (PKR 50/km via Google Maps Routes API), official WhatsApp Business Cloud API notifications, and an admin management dashboard.

## Store Defaults
- **Store Name:** Fresh Mart (`فریش مارٹ`)
- **Origin Address:** House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan
- **WhatsApp:** `03233469424`
- **Delivery Rate:** PKR 50 per kilometer (actual road driving distance)

## Architecture & Setup

### 1. Database (PostgreSQL + Drizzle ORM)
Schema is defined in `src/db/schema.ts` and seeded idempotently via `src/db/seed.ts` (`ensureSeedData()`).
- Tables: `users`, `categories`, `products`, `delivery_areas`, `store_settings`, `orders`, `order_items`, `order_status_history`, `whatsapp_logs`.
- Connection configuration (`src/db/index.ts` & `src/db/drizzle.config.ts`) uses `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_ADMIN_USER`/`SQL_ADMIN_PASSWORD`.

### 2. Google Maps Platform (Distance-Based Delivery)
- Uses **Google Maps Routes API v2** (`computeRoutes`), **Geocoding API v4**, **Maps JavaScript API**, and **Places API (New)** (`@vis.gl/react-google-maps`).
- Road driving distance in kilometers × `deliveryRatePerKm` (`50`) computes the verified delivery fee.
- Unverified addresses or API errors transition safely to `pending_manual` (`Rs. 0` estimated until confirmed by the store owner) rather than guessing fees.
- Configure `GOOGLE_MAPS_API_KEY` (and optional `VITE_GOOGLE_MAPS_API_KEY`) in environment secrets or set a key inside **Admin Dashboard → Store & API Settings**.

### 3. WhatsApp Business Cloud API
- Server-side integration (`src/services/whatsapp.ts`) sends notifications via Meta Graph API (`v21.0`) without ever exposing the access token to the browser.
- Configure via environment variables or **Admin Dashboard → Store & API Settings**:
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_CUSTOMER_TEMPLATE` (optional approved template name, e.g., `fresh_mart_order_confirmation`)
  - `WHATSAPP_OWNER_TEMPLATE` (optional approved template name, e.g., `fresh_mart_owner_alert`)
  - `WHATSAPP_TEMPLATE_LANG` (default `en_US`)
- All attempts are recorded in `whatsapp_logs` (`sent`, `failed`, or `not_configured`) with one-click retry in the Admin Orders modal.

### 4. Admin Access
- Sign in with Google via Firebase Authentication inside the **Admin** view.
- Set `ADMIN_EMAILS` (comma-separated) in environment variables to grant admin permissions to specific Google accounts.

### 5. Scripts
- `npm run dev` — Starts Express + Vite middleware on port `3000`
- `npm run build` — Builds production frontend bundle (`dist/`)
- `npm run lint` — Runs TypeScript type checking (`tsc --noEmit`)
- `npm run start` — Starts production server on port `3000`
