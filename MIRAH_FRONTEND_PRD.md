# PRD: Mirah Frontend App (React)

## 1) Purpose

Build the **Mirah customer + vendor frontend web app** in React, backed by the APIs in this repo.

- **Backend base path**: `/api/user/**` (see `src/app.ts`)
- **Swagger** (optional): `/api-docs` when `ENABLE_SWAGGER=true`

Auth screens (**signup/login/forgot password**) already exist in the frontend; this PRD specifies the remaining end-to-end product experience and how it maps to backend APIs.

## 2) Users & Roles

- **Customer**
  - Browse & buy products
  - Manage cart/checkout and orders
  - Create projects, run bidding, pick vendors, pay advance/final, track lifecycle
  - Chat with vendors
- **Vendor**
  - Complete KYC (required)
  - List/manage own products and submit for approval
  - Receive project assignments, accept/reject, execute work, update project status
  - Chat with customers

### 2.1 Vendor gating rules (must be reflected in UI)

Vendor “marketplace” capabilities are protected by:

- `authenticateToken`
- `requireVendor`
- `requireAcceptedKYC` (KYC must be accepted)
- `requireVendorSellingEnabled` (selling must be enabled)

This means in the UI:
- If vendor KYC is **not accepted**, show “Complete KYC” gate and link to KYC screen, and block:
  - vendor product management
  - vendor participation in project bidding
  - vendor assignment actions (accept/reject)
  - vendor project work status updates
  - vendor-customer chat
  - vendor order management (vendor order list/cancel)
- If vendor KYC is **not accepted**, still allow **admin support chat** (user↔admin) so the vendor can contact support.
- If vendor selling is disabled (`canSellProducts=false`), show “Selling disabled” gate and block the same “marketplace” actions above (but still allow **admin support chat**).
- Vendors can request enabling selling: use `POST /api/user/profile/selling-request` when `/api/user/auth/me` returns `canRaiseSellingRequest=true`. If the last request was rejected, vendors can raise again **after 24 hours from the previous request time**.

(See `src/routes/user/product/index.ts`.)

## 2.2 Logical user & data flows (implementation steps)

This section describes the **actual end-to-end sequences** the frontend must implement: which API is called when, what UI state changes, and what data is persisted on the backend.

### 2.2.1 App start / session hydration (all roles)

- **Trigger**: app load, hard refresh, tab reopen, after login/signup verification flow completes.
- **Call**: `GET /api/user/auth/me`
- **Backend returns**
  - Common: user profile (`id`, `userType`, `isActive`, etc.)
  - Vendor-only: `kyc` object, `canSellProducts`, `sellingRequest`, `canRaiseSellingRequest`
- **Frontend responsibilities**
  - If `401`: treat as logged out and route to auth screens.
  - If `isActive=false` or API returns `403`: show “Account disabled” blocking screen.
  - Route user into **Customer** or **Vendor** navigation based on `userType`.
  - Configure global “gates” from `/me`:
    - `kyc.status !== accepted` → show “Complete KYC” gate for marketplace sections
    - `canSellProducts=false` → show “Selling disabled” gate; keep **admin support chat** accessible
    - `canRaiseSellingRequest=true` → enable “Request selling enablement” CTA
  - For vendor-only feature flags from system config, call `GET /api/user/system/vendor-selling-enabled` and cache the returned boolean in app state.
  - For project onboarding video tutorials, call `GET /api/user/system/project-tutorial/seen` and store `hasSeen` in app state per user type.

### 2.2.2 Vendor onboarding: signup → verify → KYC → platform eligibility

Auth is already implemented in frontend, but these are the required logical steps:

- **Vendor signs up**
  - Call existing auth signup endpoint(s) (see Auth module)
  - UI shows email/phone verification screens until verified
- **Vendor verification completed**
  - Call `GET /api/user/auth/me` to confirm `userType=vendor` and hydrate flags
- **KYC: build the form from backend config**
  - Call `GET /api/user/kyc/fields` to fetch KYC field configs
  - UI renders sections/fields dynamically (text, select, file upload) based on config
- **KYC: persist draft progressively**
  - For file fields:
    - Upload via `POST /api/user/kyc/upload` (multipart) to get S3 URL / key (per backend contract)
    - Store returned URL/key in local form state for that field
  - Save section data via `POST /api/user/kyc/save` (or the applicable save endpoint in KYC module)
  - UI uses `GET /api/user/kyc/status` for “In progress / Submitted / In review / Accepted / Rejected”
- **KYC: submit**
  - Call `POST /api/user/kyc/submit`
  - UI locks editing and shows “Submitted / In review”
  - Vendor receives a notification “KYC submitted” in Notifications
- **Admin reviews KYC**
  - Admin actions happen in admin dashboard (accept/reject/request changes)
  - Vendor periodically refreshes (poll or refresh) `GET /api/user/auth/me` and/or `GET /api/user/kyc/status`
- **Vendor becomes eligible for marketplace**
  - When `/me.kyc.status === accepted`, backend allows vendor marketplace endpoints **only if selling is enabled** (next flow)

### 2.2.3 Vendor selling enablement: request → admin decision → can sell

Even after KYC is accepted, a vendor may have `canSellProducts=false`.

- **Gate state**
  - If `/me.canSellProducts=false`: block vendor marketplace modules (products, bidding, assignments, vendor orders, vendor↔customer chat)
  - Still allow:
    - profile update
    - KYC screens/status
    - **admin support chat**
    - raising a selling request (only when allowed)
- **Vendor raises request**
  - Precondition: `/me.canRaiseSellingRequest=true`
  - Call `POST /api/user/profile/selling-request`
  - Backend persists a `vendor_selling_requests` row (unique per vendor)
  - Backend creates an **admin notification** (so admin sees a queue/alert)
  - Frontend re-hydrates via `GET /api/user/auth/me` to show `sellingRequest.status=pending` and disable the CTA
- **Admin accepts**
  - Admin calls `POST /api/admin/vendor-selling-requests/:id/accept` (admin dashboard)
  - Backend sets request status `accepted` and updates vendor `canSellProducts=true`
  - Backend sends a **user notification** to the vendor about acceptance
  - Vendor UI updates on next:
    - notification refresh (`GET /api/user/notifications/unread-count` + list), and/or
    - `GET /api/user/auth/me` hydration (now `canSellProducts=true`)
- **Admin rejects**
  - Admin calls `POST /api/admin/vendor-selling-requests/:id/reject`
  - Backend sets request status `rejected`
  - Backend sends a **user notification** to the vendor about rejection
  - Vendor remains `canSellProducts=false` and stays gated

### 2.2.4 Vendor products: CRUD → media upload → submit for approval → customer visibility

- **Preconditions**
  - `/me.userType=vendor`
  - `/me.kyc.status=accepted`
  - `/me.canSellProducts=true`
- **Media upload**
  - Upload image/video via vendor upload endpoints (multipart) → receive URL → attach URL to product payload
- **Create/update product**
  - Call `POST /api/user/product/vendor` (create) or `PUT /api/user/product/vendor/:id` (update)
  - Backend persists product draft
- **Submit for approval**
  - Call `POST /api/user/product/vendor/:id/submit-for-approval`
  - Admin reviews via admin dashboard (approve/reject with notes)
  - Vendor receives user notifications for approve/reject (existing notifications module)
- **Customer marketplace visibility**
  - Customer catalog `GET /api/user/product/customer` only shows vendor products when:
    - product is approved
    - vendor KYC accepted
    - vendor `canSellProducts=true`
  - UI should treat catalog as source-of-truth (don’t infer visibility client-side)

### 2.2.5 Notifications UX loop (customers & vendors)

- **Unread badge**
  - On app start and periodically: call `GET /api/user/notifications/unread-count`
- **Notification list**
  - Call `GET /api/user/notifications?page&limit&unreadOnly=...`
  - Render a unified list (KYC/product/system/chat-related)
- **Mark read**
  - Call `PATCH /api/user/notifications/:id/read`
  - Refresh badge + list
- **Important notifications in this PRD**
  - Vendor selling request accepted/rejected (new)
  - Product approved/rejected
  - KYC approved/rejected
  - Order/project lifecycle notifications (existing backend behavior)

### 2.2.6 Customer commerce: browse → cart → checkout → order tracking

- **Browse**
  - Call `GET /api/user/product/customer` for listing
  - Call `GET /api/user/product/customer/:id` for product detail
  - UI only shows what backend returns (backend already filters out ineligible vendor products)
- **Cart**
  - Add/update/remove items using cart endpoints (see Cart module)
  - UI maintains cart state via server as source-of-truth (TanStack Query cache)
- **Address readiness**
  - Customer manages billing/shipping addresses via addresses endpoints
  - UI ensures a default billing + default shipping exists before allowing checkout
- **Checkout**
  - Call checkout endpoint (see Checkout module) with selected cart item IDs
  - If Razorpay: create order → open Razorpay → verify payment → show success/failure UI state
  - Backend creates `Order` + `OrderItem` rows and triggers downstream notifications
- **Order tracking**
  - Customer calls `GET /api/user/orders` and order detail endpoint(s)
  - Customer can download invoice via invoice endpoint (PDF)

### 2.2.7 Customer projects: create → bidding/assignment → payments → completion

- **Create project**
  - Customer uploads attachments via `POST /api/user/projects/attachments/upload` (if needed)
  - Customer creates/updates project via project create/update endpoint(s)
  - Backend stores project record; moderation may block content (frontend must show error message)
- **Start and open bidding**
  - Customer starts project (`/start`) and optionally starts a bid window (`/start-bid`)
  - Vendors with KYC accepted + selling enabled can bid (`POST /api/user/projects/:id/bid`)
- **Select/reassign winner**
  - Customer selects winner from bid OR direct assign to a vendor id:
    - Backend enforces vendor KYC accepted + selling enabled
    - Frontend must use `GET /api/user/users/search?type=vendor&search=...` to pick eligible vendors
- **Payments**
  - Customer pays advance/final using Razorpay endpoints (create order / verify)
  - Backend updates ledger + project state; UI reflects progress from project detail endpoints
- **Delivery & completion**
  - Vendor updates operational status (gated) via vendor status endpoint
  - Customer can cancel/complete when allowed; backend returns updated project object

### 2.2.8 Chat: discovery → conversation → messaging → moderation

- **Discovery**
  - Customer finds eligible vendors via `GET /api/user/users/search?type=vendor&search=...`
  - Vendor finds customers via `GET /api/user/users/search?type=customer&search=...` (requires KYC accepted + selling enabled)
- **Create conversation**
  - Call `POST /api/user/chat/conversations` with `recipientId`
  - Backend enforces role pairing + KYC + selling enabled rules
- **Messaging**
  - List conversations via `GET /api/user/chat/conversations`
  - Fetch messages via `GET /api/user/chat/conversations/:conversationId/messages`
  - Send messages via `POST /api/user/chat/conversations/:conversationId/messages` (text or attachment)
  - Backend performs moderation; suspicious content may be masked in responses
- **Read receipts**
  - Call `PUT /api/user/chat/conversations/:conversationId/messages/:messageId/read`
  - UI updates unread counts and message state

### 2.2.9 Admin support chat: user → admin, always available

- **Purpose**: allow customers/vendors to contact admin support even when marketplace is gated.
- **Call**: `POST /api/user/chat/admin/message` (text or attachment)
- **Vendor notes**
  - Vendors can use this endpoint even if `kyc.status != accepted`
  - Vendors can still use this endpoint even if `canSellProducts=false`

### 2.2.10 Vendor operational flows: assignments → project work → vendor orders

These are the “daily operations” flows for vendors after they are eligible.

- **Preconditions (for all vendor marketplace operations below)**
  - `/me.userType=vendor`
  - `/me.kyc.status=accepted`
  - `/me.canSellProducts=true`

#### Assignments (vendor)

- **List assignments**
  - Call `GET /api/user/assignments?page&limit&status&isActive`
  - UI shows status chips: `pending|accepted|rejected|reassigned|cancelled`
- **Accept / reject**
  - Call `POST /api/user/assignments/:id/accept` or `POST /api/user/assignments/:id/reject`
  - Backend updates assignment + may update project state and generate notifications
  - UI refreshes assignments list and the related project detail screen

#### Vendor project work (vendor)

- **View running projects**
  - Call `GET /api/user/projects/running?page&limit&status...` (vendor scope)
  - UI shows agreed amount/days, customer summary, and current operational status
- **Update project operational status**
  - Call `PATCH /api/user/projects/:id/status` with the next status
  - Backend enforces allowed transitions; UI must show server message if blocked
  - UI refreshes project detail and timeline after each update

#### Vendor bidding (vendor)

- **Place bid**
  - Call `POST /api/user/projects/:id/bid`
  - UI displays bid confirmation, and the latest bid in project detail
- **Withdraw latest bid / withdraw fully**
  - Call `DELETE /api/user/projects/:id/bid/latest` (latest bid)
  - Call `POST /api/user/projects/:id/withdraw` (withdraw participation)
  - UI refreshes project bid state

#### Vendor order management (vendor)

- **List vendor orders**
  - Call `GET /api/user/orders/vendor?page&limit&status...`
  - UI shows orders that contain the vendor’s products (not necessarily “vendor-owned” orders)
- **Vendor cancel**
  - Call `POST /api/user/orders/:id/vendor-cancel`
  - Backend validates vendor is part of order and sets status (may go to `refund_pending`)
  - UI refreshes order detail and list and shows refund messaging when applicable

## 3) Tech stack (frontend)

- **React + TypeScript**
- **Routing**: React Router
- **Data fetching/caching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **UI**: MUI or shadcn/ui (tables, dialogs, responsive layout)

## 4) Global UX requirements

- **Auth**
  - Store access token securely (recommended: HttpOnly cookie via frontend BFF; otherwise localStorage + refresh via `/api/user/auth/me`)
  - Auto-handle `401` by redirecting to login.
- **Pagination**: standard `page`/`limit` params across lists.
- **Errors**
  - Show server message from `{ success:false, message }`
  - Display actionable guidance for `403` gates (e.g., “KYC must be accepted”).
- **File downloads**: invoice endpoints return PDF; use `window.open` or stream download with correct filename.

## 4.1 Status dictionaries (what UI should display)

### Project

- **Core status** (`ProjectCoreStatus`)
  - `draft`: Draft (not listed to other users)
  - `running`: Running
  - `finished`: Finished
- **Operational status** (`ProjectOperationalStatus`)
  - `started`, `invoice`, `in_progress`, `qc`, `in_transit`, `paid`, `delivered`, `completed`, `cancelled`

(Source: `src/models/Project.ts`)

### Order

- **Payment method**: `razorpay | offline | partial`
- **Status** (examples): `pending_payment`, `paid`, `offline_due`, `partial_due`, `failed`, `cancelled`, `delivered`

UI rule: regardless of the internal status, the customer-facing invoice and order header should summarize as **Paid** when `amountDue <= 0`, otherwise **Unpaid**.

(Source: `src/models/Order.ts`)

## 5) Navigation / Information Architecture

### 5.1 Customer app navigation

- Home / Product Catalog
- Search & Filters
- Product Details
- Cart
- Checkout
- Orders
- Order Details (download invoice)
- Projects
- Project Details (bids, winner selection, payments, invoice)
- Chat
- Notifications
- Profile + Addresses

### 5.2 Vendor app navigation

- Dashboard (quick links: KYC status, approvals, assignments)
- KYC
- Products (list/create/edit/upload media/submit for approval)
- Assignments (project assignments list)
- Project Work (status updates)
- Chat
- Notifications
- Profile

## 6) Core modules (screens, journeys, APIs)

### 6.1 Authentication (already implemented)

All auth endpoints are under `/api/user/auth/*` (`src/routes/user/auth/**`):
- Signup, login, logout, resend OTP/email OTP, verify OTP/email OTP, forgot/reset password, `me`.

Frontend should:
- On app start, call `GET /api/user/auth/me` to hydrate session, role, and (for vendors) KYC status and `canSellProducts`.

### 6.2 Profile

Screens:
- Profile view/edit
- Change password

APIs:
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/profile/change-password`

(See `src/routes/user/profile/index.ts`.)

### 6.2.1 System (Vendor-only)

Screens/usage:
- Vendor app bootstrap / feature gates (read-only config fetch)

APIs:
- `GET /api/user/system/vendor-selling-enabled`

Response:
- `data.sellingForVendorEnabled: boolean`
- Backed by `system_config` key `selling_for_vendor_enabled`
- Default behavior: if not configured, treat as `false`

### 6.2.2 System (Project Tutorial Video)

Screens/usage:
- Show the correct project tutorial video (customer vs vendor) only once per user

APIs:
- `GET /api/user/system/project-tutorial/seen`
- `POST /api/user/system/project-tutorial/seen`

### 6.3 Notifications

Screens:
- Notifications list (unread filter)
- Unread badge
- Mark as read

APIs:
- `GET /api/user/notifications?page&limit&unreadOnly`
- `GET /api/user/notifications/unread-count`
- `PATCH /api/user/notifications/:id/read`

(See `src/routes/user/notification/index.ts`.)

### 6.3.1 FAQ (Customer + Vendor)

Screens:
- FAQ list (customer or vendor specific)

APIs:
- `GET /api/user/faq`

### 6.4 Product Catalog (Customer)

Screens:
- Product list (filters/sort/search)
- Product details

APIs:
- `GET /api/user/product/customer` (pagination + filters)
- `GET /api/user/product/customer/brands` (for filter dropdowns)
- `GET /api/user/product/customer/categories` (for filter dropdowns)
- `GET /api/user/product/customer/:id`
- `GET /api/user/reviews/product/:productId?page&limit` (product reviews, paginated)
- `POST /api/user/reviews` (customer submits/updates review after purchase)

(See `src/routes/user/product/customer/index.ts`.)

Visibility rule (important):
- Vendor products are shown only when the vendor has `canSellProducts=true` **and** vendor KYC is **accepted**.

Normalization (important for filters):
- `brands` and `categories` returned from the metadata endpoints are **normalized**: trimmed, multiple spaces collapsed to single space, and lowercased.
- `GET /api/user/product/customer` applies the **same normalization** when filtering by `brand` and `category` (case/whitespace-insensitive).

#### Product Reviews (Customer)

Rules:
- Only **customers** can submit reviews.
- Customer can review a product **only if purchased** (backend checks an `orders` record for that customer with status `paid` or `delivered` containing that `productId`).
- Rating is **1–5** stars. Comment is optional.
- Customer can choose to post the review as **anonymous** using `isAnonymous=true`.

APIs:
- `GET /api/user/reviews/product/:productId?page&limit`
- `POST /api/user/reviews`
- `GET /api/user/reviews/order/:orderId` (for “My reviews” per purchased order)

Example submit request:

```json
{
  "productId": 123,
  "rating": 5,
  "comment": "Great quality!",
  "isAnonymous": true
}
```

Success response:

```json
{
  "success": true,
  "message": "Review submitted",
  "data": {
    "review": {
      "id": 10,
      "productId": 123,
      "customerId": 55,
      "rating": 5,
      "comment": "Great quality!",
      "isAnonymous": true,
      "createdAt": "2026-03-10T10:00:00.000Z",
      "updatedAt": "2026-03-10T10:00:00.000Z"
    }
  }
}
```

Anonymous behavior (customer-facing lists):
- In `GET /api/user/reviews/product/:productId` (and vendor-facing `GET /api/user/reviews/vendor`), if a review has `isAnonymous=true`, backend returns the reviewer as:
  - `customer.firstName = "Anonymous"`, `customer.lastName = "User"`, `customer.id = null`, `profileImageUrl = null`

Get my reviews for an order:
- `GET /api/user/reviews/order/:orderId`
- Returns each unique product in the order with the customer’s review (or `null` if not reviewed yet).

Response example:

```json
{
  "success": true,
  "data": {
    "orderId": 500,
    "items": [
      {
        "product": { "id": 123, "name": "Test Product", "images": ["https://..."], "vendorId": 23, "isAdminProduct": false },
        "review": { "id": 10, "rating": 5, "comment": "Great", "isAnonymous": true, "createdAt": "2026-03-10T10:00:00.000Z", "updatedAt": "2026-03-10T10:00:00.000Z" }
      },
      {
        "product": { "id": 124, "name": "Another Product", "images": [], "vendorId": null, "isAdminProduct": true },
        "review": null
      }
    ]
  }
}
```

### 6.5 Cart + Checkout (Customer)

Screens:
- Cart page (list items, update qty, remove, clear)
- Checkout page:
  - select items to buy
  - pick/create billing/shipping address
  - select payment method (razorpay/offline/partial)
  - place order
  - verify payment (razorpay) + success screen

APIs (cart):
- `GET /api/user/cart`
- `POST /api/user/cart` (add item)
- `PUT /api/user/cart/:productId` (update qty)
- `DELETE /api/user/cart/:productId` (remove)
- `DELETE /api/user/cart` (clear)

Checkout & payment:
- `POST /api/user/cart/checkout` (creates order; for razorpay returns razorpay order info)
- `POST /api/user/cart/payment/verify` (verify razorpay payment)
- `POST /api/user/cart/orders/:orderId/cancel` (customer cancellation flow)

Important constraints (UI must enforce before calling checkout):
- Checkout requires explicit **`cartItemIds[]` (preferred)** or `productIds[]` (only valid when there is **at most one cart item per productId**).
- Selected items must belong to **one provider** only (all admin products OR all products from the same vendor).

(See `src/routes/user/cart/index.ts`.)

Product commission (internal):
- Vendor-product orders record a platform commission in the backend ledger at payment time (configurable by admins via `product_commission_percentage`).
- This is for accounting/payout calculations and is **not** a separate line item the customer must pay.

### 6.6 Orders (Customer + Vendor views)

Screens:
- Orders list with filters
- Order details
- Download invoice

APIs:
- `GET /api/user/orders` (customer own orders; vendor sees orders containing their products)
- `GET /api/user/orders/:id`
- `GET /api/user/orders/:id/invoice` (PDF download)

(See `src/routes/user/orders/index.ts`.)

Invoice UI requirements:
- Always show a simple payment label **Paid/Unpaid** (no online/offline wording).

### 6.7 Addresses (Customer)

Screens:
- Address book (billing/shipping)
- Add/edit/delete, set default

APIs:
- `GET /api/user/sales/addresses?type=billing|shipping`
- `POST /api/user/sales/addresses`
- `PUT /api/user/sales/addresses/:id`
- `DELETE /api/user/sales/addresses/:id`

(See `src/routes/user/sales/index.ts`.)

### 6.8 Chat (Customer + Vendor)

Screens:
- Conversations list
- Message thread (send text + attachments)
- Moderation UX (blocked messages show “**not allowed**” in last message preview)

APIs (high level):
- `GET /api/user/chat/conversations`
- `GET /api/user/chat/poll?lastConversationId&conversationId&lastMessageId` (poll for new conversations/messages)
- `GET /api/user/chat/conversations/:conversationId/messages?page&limit`
- `POST /api/user/chat/conversations/:conversationId/messages` (send message)
- `POST /api/user/chat/conversations` (create/find conversation by `recipientId`)
- (Additional endpoints exist for attachment uploads and admin-related chat; follow swagger in `src/routes/user/chat/index.ts`)

Discovery:
- Use `GET /api/user/users/search?type=vendor&search=...` to find a vendor `id` before creating a conversation.

Policy requirements:
- Messages are moderated to prevent contact sharing / off-platform coordination.
- If backend returns 400 with moderation reason, show a clear inline error.

Polling (recommended):
- Use `GET /api/user/chat/poll?lastConversationId=<number>` on an interval (e.g., every 3–10s) to know whether to refetch `GET /api/user/chat/conversations`.
- When inside an open conversation, also pass `conversationId=<id>&lastMessageId=<number>` to know whether to refetch messages for that conversation.
- When inside an open conversation, pass `conversationId=<id>` to know whether there are new (unread) messages in that conversation.
- Response flags:
  - `data.hasNewConversation === true` → refetch conversations list.
  - `data.hasAnyNewMessage === true` → some conversation has unread messages; refetch conversations list.
  - `data.hasNewMessage === true` → refetch messages for the provided conversation.

### 6.9 Vendor KYC

Screens:
- KYC status (in progress/submitted/in review/accepted/rejected)
- Dynamic KYC form driven by backend field config
- Upload documents per field
- Submit KYC

APIs:
- `GET /api/user/kyc/fields?country=...`
- `GET /api/user/kyc/status`
- `POST /api/user/kyc/upload` (multipart/form-data; includes `fieldName` and `section`)
- (Other KYC endpoints exist in `src/routes/user/kyc/index.ts` for submit/update; follow swagger there)

### 6.10 Vendor Product Management

Screens:
- Product list (vendor products)
- Create/edit product
- Upload image/video
- Submit for approval

APIs:
- `GET /api/user/product/vendor`
- `GET /api/user/product/vendor/:id`
- `POST /api/user/product/vendor/upload-image`
- `POST /api/user/product/vendor/upload-video`
- `POST /api/user/product/vendor` (create)
- `PUT /api/user/product/vendor/:id` (update)
- `DELETE /api/user/product/vendor/:id`
- `POST /api/user/product/vendor/:id/submit-for-approval`

(See `src/routes/user/product/vendor/index.ts`.)

UI notes:
- Expose `approvalStatus` and `approvalReviewNotes`.
- Clearly show states: Draft → Submitted → Approved/Rejected.
- Notifications:
  - When vendor submits a product for approval, vendor receives a notification ("Product submitted for approval").
  - When admin approves/rejects, vendor receives a notification ("Product approved"/"Product rejected").

### 6.11 Projects (Customer)

Screens:
- Project list
- Create/edit project
- Upload attachments (pdf/images)
- Start project / start bidding
- View bids
- Manual end bidding
- Select winner (by bidEntryId) OR assign vendor directly (vendorId)
- Payments: advance + final (Razorpay-based)
- Download project invoice

Key APIs:
- `POST /api/user/projects` (create; starts as draft)
- `POST /api/user/projects/review` (AI feasibility review; budget vs timeline)
- `GET /api/user/projects` (list projects for authenticated user; supports `page&limit&search`)
- `GET /api/user/projects/:id` (details)
- `PATCH /api/user/projects/:id` (edit; moderation enforced when running)
- `POST /api/user/projects/:id/start`
- `POST /api/user/projects/:id/cancel`
- `POST /api/user/projects/:id/start-bid`
- `GET /api/user/projects/:id/bids` (+ active bids variants)
- `POST /api/user/projects/:id/manual-end`
- `POST /api/user/projects/:id/select-winner`
- `POST /api/user/projects/:id/reassign-winner`
- `POST /api/user/projects/:id/complete`
- Vendor review (after completion):
  - `POST /api/user/vendor-reviews` (rate vendor out of 5 with optional comment; only after project is completed)
  - `GET /api/user/vendor-reviews/vendor/:vendorId?page&limit` (**customer-only**, view a vendor’s reviews)

Vendor details (customer):
- `GET /api/user/users/vendors/:vendorId/details` (full name, location, total projects, active bids, running assignments)

Payments:
- `POST /api/user/projects/:id/payments/razorpay/create-order`
- `POST /api/user/projects/:id/payments/razorpay/verify`
- Payment:
  - `POST /api/user/projects/:id/payments/razorpay/create-order` (advance/final)
  - `POST /api/user/projects/:id/payments/razorpay/verify`
- Invoice:
  - `GET /api/user/projects/:id/invoice`

Attachments:
- `POST /api/user/projects/attachments/upload` (PDF/images only)

Moderation requirements:
- Project **start**, **start-bid**, and **running updates** can be blocked by moderation (contact info in title/description/meta/attachments OCR and referenceImage OCR).
- UI must show the backend `reason` and prompt user to remove contact details before retrying.

(See `src/routes/user/projects/index.ts`.)

### 6.12 Projects (Vendor) + Assignments

Screens:
- Running projects list (bid windows with stats)
- Place bid / withdraw bid
- Assignments list (pending/accepted/etc)
- Accept/reject assignment
- Update project operational status (in_progress → qc)
- Reviews received (paginated list of customer reviews per project)

Key APIs:
- Vendor running projects:
  - `GET /api/user/projects/running`
  - `POST /api/user/projects/:id/bid`
  - `DELETE /api/user/projects/:id/bid/latest`
  - `POST /api/user/projects/:id/withdraw`
- View project details:
  - `GET /api/user/projects/:id`
- Assignments:
  - `GET /api/user/assignments`
  - `POST /api/user/assignments/:id/accept`
  - `POST /api/user/assignments/:id/reject`
- Status updates:
  - `PATCH /api/user/projects/:id/status` (vendor updates operational status)
- Vendor reviews received (paginated):
  - `GET /api/user/vendor-reviews/me?page&limit&projectId` (**vendor-only**)

(See `src/routes/user/projects/index.ts` + `src/routes/user/assignments/index.ts` + `src/routes/user/vendor-reviews/index.ts`.)

#### Vendor Reviews (Project-based)

Rules:
- Only **customers** can submit vendor reviews.
- Vendor can be reviewed **only after** project operational status is **`completed`**.
- Rating is **1–5** stars. Comment is optional.
- On submission/update, the reviewed vendor receives a user notification; admins receive an admin notification.
- Customers can submit vendor reviews as **anonymous** using `isAnonymous=true`.

**Vendor: list reviews received** — `GET /api/user/vendor-reviews/me`

- **Query**: `page` (default 1), `limit` (default 20, max 100), optional `projectId` to filter by project.
- **Response** `data.reviews[]` items include:
  - `id`, `projectId`, `projectTitle` (from project; nullable if missing), `customerName` (display string), `reviewedAt` (timestamp of the review; same event as `createdAt`), `rating`, `comment`, `isAnonymous`
  - `customer` — structured reviewer summary (same shape as before; use for avatars/details when not anonymous)
  - `createdAt`, `updatedAt`
- **Anonymous**: when `isAnonymous=true`, `customerName` is `"Anonymous"` and `customer` follows the anonymous shape below.

Anonymous behavior (customer-facing lists):
- In `GET /api/user/vendor-reviews/vendor/:vendorId`, if a review has `isAnonymous=true`, backend returns the reviewer as:
  - `customer.firstName = "Anonymous"`, `customer.lastName = "User"`, `customer.id = null`, `profileImageUrl = null`

## 7) Invoice UX (frontend)

### 7.1 Orders invoice

- Customer: `GET /api/user/orders/:id/invoice`
- Admin dashboard has its own invoice endpoints; not part of this app.

### 7.2 Projects invoice

- Customer: `GET /api/user/projects/:id/invoice`
- Invoice should display:
  - Overall Paid/Unpaid
  - **Advance** Paid/Unpaid + amount
  - **Final** Paid/Unpaid + amount

## 8) Release plan (frontend)

- **Phase 1 (MVP commerce)**: Catalog → Cart → Checkout → Orders → Invoice
- **Phase 2 (Vendor onboarding)**: Vendor KYC → Vendor products → Approvals visibility
- **Phase 3 (Projects marketplace)**: Customer projects + bidding + assignments + payments + invoice
- **Phase 4 (Chat + moderation polish)**: chat UX, attachment flows, moderation error states

## 9) Analytics / instrumentation (optional)

- Track funnel events:
  - add_to_cart, checkout_started, payment_verified, order_invoice_downloaded
  - project_created, bidding_started, winner_selected, advance_paid, final_paid, project_invoice_downloaded

## 10) Frontend route map (suggested)

### Customer

- `/` catalog
- `/products/:id`
- `/cart`
- `/checkout`
- `/orders` and `/orders/:id`
- `/orders/:id/invoice` (download action)
- `/projects` and `/projects/new`
- `/projects/:id` (tabs: overview, bids, payments, invoice, chat)
- `/chat`
- `/notifications`
- `/profile` and `/profile/addresses`

### Vendor

- `/vendor/dashboard`
- `/vendor/kyc`
- `/vendor/products` and `/vendor/products/new` and `/vendor/products/:id`
- `/vendor/assignments`
- `/vendor/projects/:id` (work/status tab)
- `/chat`
- `/notifications`
- `/profile`

## 11) Acceptance criteria (must-have)

- **Auth hydration**: after login refresh, app restores session using `GET /api/user/auth/me`.
- **Vendor gates**: vendor product pages are blocked until KYC is accepted and selling is enabled.
- **Checkout**: prevents multi-vendor mixed checkout; shows server error if attempted.
- **Payments**: razorpay verification failures transition to a visible “Payment failed” state and allow retry.
- **Moderation**: when project/chat moderation blocks content, show `reason` and do not lose the draft edits.
- **Invoices**: order and project invoice endpoints download a valid PDF; project invoice shows overall Paid/Unpaid plus Advance/Final statuses.

## 12) Detailed API contracts (frontend implementation spec)

### 12.1 Response envelope convention

Most JSON responses follow:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Errors typically:

```json
{
  "success": false,
  "message": "Reason"
}
```

### 12.2 Auth (complete)

#### `POST /api/user/auth/signup`

- **Purpose**: Create user and send phone+email OTP (account not verified initially).
- **Body (JSON)**:

```json
{
  "firstName": "A",
  "lastName": "B",
  "email": "a@example.com",
  "password": "secret123",
  "countryCode": "+91",
  "phone": "9999999999",
  "country": "India",
  "state": "KA",
  "city": "Bengaluru",
  "address": "Street...",
  "pinCode": "560001",
  "userType": "customer"
}
```

- **Rules**:
  - required: `firstName,lastName,email,password,countryCode,phone`
  - password min length: 6
  - `userType` in `customer|vendor` (default `customer`)
- **Success (201)**: user object + OTPs are sent (backend may include OTPs in response in non-prod; frontend should ignore).

#### `POST /api/user/auth/verify-otp` (phone verification)

- **Body**:

```json
{ "phone": "9999999999", "countryCode": "+91", "otp": "123456" }
```

- **Success (200)**:
   - user verification flags `isPhoneVerified` and maybe `isVerified` (true only when both phone+email verified)
   - if `data.user.isVerified === true` after this call, backend returns `data.token` (JWT) exactly like `/login`
   - if the user is only partially verified, backend does **not** return a token

#### `POST /api/user/auth/verify-email-otp` (email verification)

- **Body**:

```json
{ "email": "a@example.com", "otp": "123456" }
```

- **Success (200)**:
  - user verification flags `isEmailVerified` and maybe `isVerified` (true only when both phone+email verified)
  - if `data.user.isVerified === true` after this call, backend returns `data.token` (JWT) exactly like `/login`
  - if the user is only partially verified, backend does **not** return a token

#### `POST /api/user/auth/resend-otp`

- **Body**:

```json
{ "phone": "9999999999", "countryCode": "+91" }
```

#### `POST /api/user/auth/resend-email-otp`

- **Body**:

```json
{ "email": "a@example.com" }
```

#### `POST /api/user/auth/login`

- **Body (email login)**:

```json
{ "type": "email", "email": "a@example.com", "password": "secret123" }
```

- **Body (phone login)**:

```json
{ "type": "phone", "countryCode": "+91", "phone": "9999999999", "password": "secret123" }
```

- **Success (200)**:

```json
{
  "success": true,
  "data": { "token": "<jwt>", "user": { "id": 1, "userType": "customer", "isVerified": true } }
}
```

- **Not verified (401)**: backend triggers sending missing OTP(s) and returns verification details; frontend must route user to OTP screens:

```json
{
  "success": false,
  "message": "Your account is not fully verified. OTPs have been sent to your phone and email.",
  "data": {
    "phone": "9999999999",
    "countryCode": "91",
    "email": "a@example.com",
    "isEmailVerified": false,
    "isPhoneVerified": true
  }
}
```

- **Deactivated (403)**: show blocking screen + “contact support”.

#### `POST /api/user/auth/forgot-password`

- **Body**:

```json
{ "type": "email", "email": "a@example.com" }
```

or

```json
{ "type": "phone", "countryCode": "+91", "phone": "9999999999" }
```

- **Success (200)**: always returns success message to avoid account enumeration (OTP may be `null`).

#### `POST /api/user/auth/reset-password`

- **Body**:

```json
{
  "type": "email",
  "email": "a@example.com",
  "otp": "123456",
  "newPassword": "newsecret123"
}
```

#### `GET /api/user/auth/me`

- **Purpose**: hydrate session on app start and after refresh.
- **Success (200)**: includes user profile (including `profileImageUrl`) + for vendors: `kyc`, `canSellProducts`, `sellingRequest` and `canRaiseSellingRequest`.

Example (vendor, selling disabled, request pending):

```json
{
  "success": true,
  "data": {
    "id": 77,
    "firstName": "Vendor",
    "lastName": "One",
    "email": "vendor1@example.com",
    "countryCode": "91",
    "phone": "9000000000",
    "country": "India",
    "state": "Karnataka",
    "city": "Bengaluru",
    "address": "MG Road",
    "pinCode": "560001",
    "userType": "vendor",
    "isVerified": true,
    "isEmailVerified": true,
    "isPhoneVerified": true,
    "isActive": true,
    "canSellProducts": false,
    "createdAt": "2026-03-09T00:00:00.000Z",
    "updatedAt": "2026-03-09T00:00:00.000Z",
    "kyc": { "status": "accepted", "hasKYC": true, "country": "IN", "rejectionReason": null, "reviewedAt": "2026-03-09T00:00:00.000Z", "createdAt": "2026-03-09T00:00:00.000Z", "updatedAt": "2026-03-09T00:00:00.000Z" },
    "sellingRequest": { "hasRequest": true, "id": 1, "status": "pending", "createdAt": "2026-03-09T00:00:00.000Z", "reviewedAt": null },
    "canRaiseSellingRequest": false
  }
}
```

#### `POST /api/user/auth/logout`

- **Purpose**: invalidate token (blacklist).
- **UI**: always clear local auth state.

### 12.3 Profile

- `GET /api/user/profile`
- `PUT /api/user/profile` (partial update)
- `POST /api/user/profile/profile-picture` (multipart, field `file`) (customers + vendors)
- `POST /api/user/profile/selling-request` (vendor-only; requires **KYC accepted**; creates a selling request; if rejected, can be raised again after **24 hours**)
- `POST /api/user/profile/change-password` body:

#### Vendor selling request (`POST /api/user/profile/selling-request`)

- **Body**: none
- **Success (201)**:

```json
{
  "success": true,
  "message": "Selling request created",
  "data": {
    "sellingRequest": {
      "id": 1,
      "status": "pending",
      "createdAt": "2026-03-09T00:00:00.000Z",
      "reviewedAt": null
    }
  }
}
```

- **Failure (400)**: if already requested or selling already enabled.

Notifications:
- Admin receives an admin notification when the request is created.
- Vendor receives a user notification when the request is created and when it is accepted/rejected.

```json
{ "currentPassword": "old", "newPassword": "newsecret123" }
```

#### Profile picture upload (`POST /api/user/profile/profile-picture`)

- **Body**: `multipart/form-data` with field `file` (image)
- **Moderation**: backend may reject if the image contains disallowed contact info / URLs (OCR + policy check).
- **Success (200)**:

```json
{
  "success": true,
  "message": "Profile picture updated",
  "data": { "profileImageUrl": "https://<bucket>.s3.<region>.amazonaws.com/profile-pictures/..." }
}
```

### 12.4 Notifications

- `GET /api/user/notifications?page&limit&unreadOnly=true|false`
- `GET /api/user/notifications/unread-count`
- `PATCH /api/user/notifications/:id/read`
- `PATCH /api/user/notifications/read-all`

UI must keep an unread badge in navbar and refresh after marking read.

### 12.4.1 System (vendor-only config)

#### `GET /api/user/system/vendor-selling-enabled`

- **Purpose**: return whether vendor selling is globally enabled from system config.
- **Auth**: required (`bearerAuth`)
- **Role**: vendor-only (`requireVendor`)
- **Success (200)**:

```json
{
  "success": true,
  "data": {
    "sellingForVendorEnabled": false
  }
}
```

- **Default**: when `system_config.selling_for_vendor_enabled` is missing/invalid, backend returns `false`.

### 12.4.2 System (Project Tutorial Video)

#### `GET /api/user/system/project-tutorial/seen`

- **Purpose**: return whether the current user has already watched the project tutorial video.
- **Auth**: required (`bearerAuth`)
- **Success (200)**:

```json
{
  "success": true,
  "data": {
    "tutorialTarget": "customer|vendor",
    "videoUrl": "string",
    "hasSeen": false,
    "seenAt": null
  }
}
```

- **Source**: tutorial video URL comes from system config keys:
  - `project_tutorial_customer_video_url`
  - `project_tutorial_vendor_video_url`

#### `POST /api/user/system/project-tutorial/seen`

- **Purpose**: mark the tutorial video as seen for the current user.
- **Auth**: required (`bearerAuth`)
- **Success (200)**:

```json
{
  "success": true,
  "data": {
    "tutorialTarget": "customer|vendor",
    "videoUrl": "string",
    "hasSeen": true,
    "seenAt": "2026-03-20T10:00:00.000Z"
  }
}
```

- Mark behavior: if a view row already exists, backend updates `seenAt` to the current timestamp.

### 12.4.3 FAQ (Customer + Vendor)

#### `GET /api/user/faq`

- **Purpose**: fetch the FAQ entries for the authenticated user's `userType` (`customer` or `vendor`).
- **Auth**: required (`bearerAuth`)
- **Success (200)**:

```json
{
  "success": true,
  "data": {
    "target": "customer|vendor",
    "faqs": [
      {
        "id": 1,
        "question": "string",
        "answer": "string",
        "sortOrder": 0,
        "isActive": true,
        "createdAt": "2026-03-20T10:00:00.000Z",
        "updatedAt": "2026-03-20T10:00:00.000Z"
      }
    ]
  }
}
```

#### Admin FAQ management (Superadmin)

Endpoints:
- `GET /api/admin/faqs?target=customer|vendor`
- `POST /api/admin/faqs` (body: `target`, `question`, `answer`, `sortOrder?`, `isActive?`)
- `GET /api/admin/faqs/:id`
- `PUT /api/admin/faqs/:id` (updates any of `target`, `question`, `answer`, `sortOrder`, `isActive`)
- `DELETE /api/admin/faqs/:id`

### 12.5 Addresses (billing/shipping)

- `GET /api/user/sales/addresses?type=billing|shipping`
- `POST /api/user/sales/addresses`
- `PUT /api/user/sales/addresses/:id`
- `DELETE /api/user/sales/addresses/:id`

Important: checkout requires **default billing + default shipping**; provide a “Set as default” action during address creation/edit.

### 12.6 Products

#### Customer catalog

- `GET /api/user/product/customer`
  - query: `page,limit,category,brand,minPrice,maxPrice,featured,search,sortBy,sortOrder`
- `GET /api/user/product/customer/brands`
- `GET /api/user/product/customer/categories`
- `GET /api/user/product/customer/:id`
- `GET /api/user/reviews/product/:productId?page&limit`
- `POST /api/user/reviews`

Brand/category filter normalization:
- Use the exact string values returned by `/brands` and `/categories`.
- Filtering is case-insensitive and whitespace-normalized on the backend.

#### Vendor: view product reviews

- `GET /api/user/reviews/vendor?page&limit&productId`
  - Lists reviews for products owned by the vendor.

Vendor product visibility:
- A vendor product must be `approval_status=approved` and vendor must have:
  - `can_sell_products=true`
  - KYC accepted (`vendor_kyc.kyc_status='accepted'`)

#### Vendor product management (gated by KYC accepted + selling enabled)

- `GET /api/user/product/vendor`
- `GET /api/user/product/vendor/:id`
- `POST /api/user/product/vendor/upload-image` (multipart, field name per swagger)
- `POST /api/user/product/vendor/upload-video` (multipart)
- `POST /api/user/product/vendor` (create)
- `PUT /api/user/product/vendor/:id` (update)
- `DELETE /api/user/product/vendor/:id`
- `POST /api/user/product/vendor/:id/submit-for-approval`

UI must surface `approvalStatus` and `approvalReviewNotes`, and prevent editing when in a locked state if backend restricts it.

##### Vendor product create (`POST /api/user/product/vendor`) body (exact fields)

Backend accepts JSON where many fields are optional; **`name` and `price` are required**.

```json
{
  "name": "Carrara Marble Tile",
  "description": "Premium marble tile",
  "sku": "MARBLE-001",
  "price": 1999.99,
  "compareAtPrice": 2499.99,
  "stock": 10,
  "category": "Tiles",
  "brand": "Mirah",
  "unit": "sqft",
  "weight": 2.5,
  "weightUnit": "kg",
  "metalType": "Gold",
  "metalColour": "Yellow",
  "diamondType": "lab",
  "totalDiamondWeight": 1.25,
  "variants": [
    {
      "type": "necklace",
      "size": "Princess",
      "sizeDimensions": 18,
      "sizeDimensionsUnit": "\"",
      "price": 1999.99,
      "compareAtPrice": 2499.99,
      "quantity": 5
    },
    {
      "type": "necklace",
      "size": "Matinee",
      "sizeDimensions": 20,
      "sizeDimensionsUnit": "\"",
      "price": 2049.99,
      "compareAtPrice": 2549.99,
      "quantity": 3
    }
  ],
  "images": ["https://.../img1.jpg"],
  "extraFields": { "finish": "polished" },
  "status": "draft",
  "isFeatured": false,
  "isActive": true,
  "metaTitle": "Carrara Marble Tile",
  "metaDescription": "Buy Carrara marble tile"
}
```

Rules:
- `status` **cannot** be `active` directly (must submit for approval)
- `images` can be an array (preferred). Backend also tolerates JSON-stringified arrays.

Success response (201) example:

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 501,
    "name": "Carrara Marble Tile",
    "description": "Premium marble tile",
    "sku": "MARBLE-001",
    "price": 1999.99,
    "compareAtPrice": 2499.99,
    "stock": 10,
    "category": "Tiles",
    "brand": "Mirah",
    "unit": "sqft",
    "weight": 2.5,
    "weightUnit": "kg",
    "metalType": "Gold",
    "metalColour": "Yellow",
    "diamondType": "lab",
    "totalDiamondWeight": 1.25,
    "variants": [
      {
        "type": "necklace",
        "size": "Princess",
        "sizeDimensions": 18,
        "sizeDimensionsUnit": "\"",
        "price": 1999.99,
        "compareAtPrice": 2499.99,
        "quantity": 5
      },
      {
        "type": "necklace",
        "size": "Matinee",
        "sizeDimensions": 20,
        "sizeDimensionsUnit": "\"",
        "price": 2049.99,
        "compareAtPrice": 2549.99,
        "quantity": 3
      }
    ],
    "images": ["https://.../img1.jpg"],
    "extraFields": { "finish": "polished" },
    "status": "draft",
    "approvalStatus": "not_submitted",
    "approvalReviewNotes": null,
    "isFeatured": false,
    "isActive": true,
    "metaTitle": "Carrara Marble Tile",
    "metaDescription": "Buy Carrara marble tile",
    "vendorId": 77,
    "createdAt": "2026-03-09T00:00:00.000Z",
    "updatedAt": "2026-03-09T00:00:00.000Z"
  }
}
```

##### Vendor product update (`PUT /api/user/product/vendor/:id`) body

Same fields as create, all optional. Backend performs:
- SKU uniqueness check per vendor when changed
- `status` cannot be set to `active`
- `images`/`extraFields` may be passed as objects/arrays or JSON strings

Success response (200) example:

```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": 501,
    "name": "Carrara Marble Tile (Updated)",
    "description": "Premium marble tile",
    "sku": "MARBLE-001",
    "price": 1899.99,
    "compareAtPrice": 2499.99,
    "stock": 8,
    "category": "Tiles",
    "brand": "Mirah",
    "unit": "sqft",
    "weight": 2.5,
    "weightUnit": "kg",
    "metalType": "Gold",
    "metalColour": "Yellow",
    "diamondType": "lab",
    "totalDiamondWeight": 1.25,
    "variants": [
      {
        "type": "necklace",
        "size": "Princess",
        "sizeDimensions": 18,
        "sizeDimensionsUnit": "\"",
        "price": 1899.99,
        "compareAtPrice": 2399.99,
        "quantity": 5
      }
    ],
    "images": ["https://.../img1.jpg", "https://.../img2.jpg"],
    "extraFields": { "finish": "polished" },
    "status": "draft",
    "approvalStatus": "not_submitted",
    "approvalReviewNotes": null,
    "isFeatured": false,
    "isActive": true,
    "metaTitle": "Carrara Marble Tile",
    "metaDescription": "Buy Carrara marble tile",
    "vendorId": 77,
    "createdAt": "2026-03-09T00:00:00.000Z",
    "updatedAt": "2026-03-09T01:23:45.000Z"
  }
}
```

### 12.7 Cart + Checkout + Payment (commerce)

#### Cart CRUD

- `GET /api/user/cart`
- `POST /api/user/cart` (add item)
- `PUT /api/user/cart/:productId` (update quantity)
- `DELETE /api/user/cart/:productId`
- `DELETE /api/user/cart`

Cart variants support:
- Cart items can optionally store a `variants` object: `{ type, size, sizeDimensions, sizeDimensionsUnit }`.
- Cart does **not** store variant price. Backend always resolves the unit price from `product.variants[]` using the selected variant fields.
- If the same product is added multiple times with **different `variants`**, backend stores **separate cart rows**.
- `PUT /api/user/cart/:productId` and `DELETE /api/user/cart/:productId` accept an optional `variants` object in the body to target the correct cart row.

#### Checkout

`POST /api/user/cart/checkout`

- **Body**:

```json
{
  "paymentMethod": "razorpay",
  "currency": "INR",
  "cartItemIds": [201, 202]
}
```

- **Hard rules**:
  - `cartItemIds` (preferred) must be present in cart
  - if using `productIds`, it works only when there is **at most one cart item per productId** (no multiple variants of the same product in cart)
  - all items must be from a **single provider** (all admin products OR all from same vendor)
  - default billing+shipping must exist
- **Offline method**:
  - returns `status: "offline_due"` and creates order (no `/payment/verify`)

#### Partial payment calculator (before checkout)

`POST /api/user/cart/partial-payment/calculate`

- **Purpose**: Given selected `cartItemIds` (preferred) or `productIds` from cart, return the exact system-calculated partial split (online/offline) without creating an order.
- **Body**:

```json
{
  "currency": "INR",
  "cartItemIds": [201, 202]
}
```

- **Response 200**:

```json
{
  "success": true,
  "data": {
    "cartItemIds": [201, 202],
    "productIds": [101, 102],
    "currency": "INR",
    "total": 12999,
    "onlineAmount": 7999,
    "offlineAmount": 5000,
    "rules": { "offlinePct": 0.5, "offlineCap": 200000 }
  }
}
```

**Response shapes (200)**

1) `paymentMethod="offline"`:

```json
{
  "success": true,
  "message": "Checkout initiated (offline payment)",
  "data": {
    "paymentMethod": "offline",
    "cartItemIds": [201, 202],
    "productIds": [101, 102],
    "amount": 12999,
    "currency": "INR",
    "status": "offline_due",
    "localOrderId": 503,
    "orderCode": "ORD-1A2B3C4D5E"
  }
}
```

2) `paymentMethod="razorpay"` (full online):

```json
{
  "success": true,
  "message": "Checkout initiated",
  "data": {
    "paymentMethod": "razorpay",
    "cartItemIds": [201, 202],
    "productIds": [101, 102],
    "gateway": "razorpay",
    "keyId": "rzp_test_...",
    "amount": 12999,
    "amountInMinor": 1299900,
    "currency": "INR",
    "orderId": "order_...",
    "receipt": "cart-22-1773...",
    "localOrderId": 501,
    "orderCode": "ORD-1A2B3C4D5E"
  }
}
```

3) `paymentMethod="partial"` (online + offline):
- `amount`/`amountInMinor` are for the **online** component only.
- Backend stores `offlineAmount` in the created order; after `/payment/verify`, the order typically becomes `offline_due` until the offline component is paid.

```json
{
  "success": true,
  "message": "Checkout initiated",
  "data": {
    "paymentMethod": "partial",
    "cartItemIds": [201, 202],
    "productIds": [101, 102],
    "gateway": "razorpay",
    "keyId": "rzp_test_...",
    "amount": 7999,
    "amountInMinor": 799900,
    "currency": "INR",
    "orderId": "order_...",
    "receipt": "cart-22-1773...",
    "localOrderId": 502,
    "orderCode": "ORD-1A2B3C4D5E"
  }
}
```

#### Razorpay verify (commerce)

`POST /api/user/cart/payment/verify`

- **Body**:

```json
{
  "localOrderId": 123,
  "razorpayPaymentId": "pay_...",
  "razorpayOrderId": "order_...",
  "razorpaySignature": "..."
}
```

- **Idempotency**: if the order already has `razorpayPaymentId`, backend returns success (or fails if mismatched payment id).

- **Response 200** (payment verified / idempotent):

```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "localOrderId": 123,
    "orderCode": "ORD-1A2B3C4D5E",
    "status": "paid"
  }
}
```

### 12.8 Orders (customer + vendor)

#### Customer/combined list

- `GET /api/user/orders` (authenticated)
- `GET /api/user/orders/:id`
- `GET /api/user/orders/:id/invoice` → PDF

Important:
- This invoice download endpoint is **customer-only** (`requireCustomer`). Vendor order screens should **not** show an invoice download action unless a vendor invoice endpoint is added.

#### Vendor order list + cancel

- `GET /api/user/orders/vendor?page&limit&status&from&to&productName&orderId`
- `POST /api/user/orders/:id/vendor-cancel`

Vendor payout fields (computed from `order_payment_entries`):
- `adminCommissionAmount`: total commission recorded for the order (sum of `type=commission`, `status=success`)
- `totalPayableToVendorAfterDeduction`: net payable amount to vendor = (sum of `type=payment`, `status=success`) − `adminCommissionAmount` (floored at 0)

These fields are present in:
- `GET /api/user/orders/vendor` (each order)
- `GET /api/user/orders/:id` when the caller is a vendor (and only vendor items are included)

### 12.9 Vendor KYC (complete)

#### `GET /api/user/kyc/fields?country=...`

- Returns `fieldsBySection` and `allFields`.
- Frontend must render sections dynamically and respect `required`, `validation`, and `order`.

#### `GET /api/user/kyc/status`

- Returns `hasKYC`, `status`, `data`, and `rejectionReason`.

#### `POST /api/user/kyc/upload` (multipart)

- **Fields**:
  - `file` (binary)
  - `fieldName` (string)
  - `section` (string)

#### `POST /api/user/kyc/save`

- **Body**:

```json
{
  "section": "bank_details",
  "data": {
    "bank_name": "HDFC Bank",
    "account_number": "1234567890",
    "ifsc_code": "HDFC0001234"
  },
  "country": "IN"
}
```

- Backend validates required fields for that section using config; show returned `missingFields` to user if present.

#### `POST /api/user/kyc/submit`

- Submits KYC for review; backend re-validates all required fields across all sections.
- UI should lock editing and show “Submitted / In review” state until admin review updates status.
- Vendor notifications:
  - On submit: vendor receives “KYC submitted”
  - When admin moves to in-review: vendor receives “KYC in review”
  - When admin requests changes (moves back to in-progress): vendor receives “KYC changes requested”

### 12.10 Chat (customer↔vendor) + Admin support chat (user↔admin)

#### Conversations list

- `GET /api/user/chat/conversations`
- Response contains each conversation with:
  - `otherUser` (customer↔vendor chat)
  - optional `admin` (when conversation is with admin)
  - `otherUser.isOnline` (boolean): computed from Redis presence TTL (5 min, best-effort)
  - `admin.isOnline` (boolean): always `true` (treat admin as always online)
  - `unreadCount`, `lastMessage`, timestamps

#### Create/find customer↔vendor conversation

`POST /api/user/chat/conversations`

- **Body**:

```json
{ "recipientId": 55 }
```

- Rules:
  - customer can only chat with vendor and vendor must have accepted KYC and `canSellProducts=true`
  - vendor can only chat with customer and vendor’s own KYC must be accepted and `canSellProducts=true`
  - if vendor `canSellProducts=false`, vendor can still use **admin support chat** (`POST /api/user/chat/admin/message`) but cannot chat with customers

How to get `recipientId`:
- Customers: call `GET /api/user/users/search?type=vendor&search=...`
- Vendors: call `GET /api/user/users/search?type=customer&search=...` (requires vendor KYC accepted)

Important:
- In search results, `id` is the **numeric user id** to use as `recipientId`.

### 12.10.1 User search (for chat + project assignment)

`GET /api/user/users/search`

- **Query**
  - `type`: `vendor | customer` (required)
  - `search`: string (optional, matches **firstName/lastName only**)
  - `page`, `limit`
- **Rules**
  - Customer can only search `type=vendor` and results include only vendors with **KYC accepted**.
  - Vendor can only search `type=customer` and vendor must have **KYC accepted** to call this endpoint.
- **Response 200**:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 77,
        "firstName": "Vendor",
        "lastName": "One",
        "userType": "vendor",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "canSellProducts": true,
        "isActive": true,
        "kyc": { "status": "accepted" }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
  }
}
```

#### Fetch messages (pagination)

- `GET /api/user/chat/conversations/:conversationId/messages?page=1&limit=50`

Response also includes `data.conversation` with `otherUser.isOnline` (Redis TTL-based) and `admin.isOnline=true` when admin is present.

Response `message` object shape (as returned by backend):

```json
{
  "id": 1,
  "content": "Hello",
  "messageType": "text",
  "attachmentUrl": null,
  "senderType": "user",
  "senderId": 123,
  "sender": { "id": 123, "firstName": "A", "lastName": "B" },
  "isRead": true,
  "readAt": "2026-03-09T00:00:00.000Z",
  "createdAt": "2026-03-09T00:00:00.000Z"
}
```

Notes:
- If `isSuspicious=true` on backend, `content` is replaced with `**not allowed**`.
- For admin messages: `senderType` is `admin` and `sender` contains admin fields (includes `email` in the messages list response).

#### Send message (text or attachment)

`POST /api/user/chat/conversations/:conversationId/messages`

- JSON text body:

```json
{ "content": "Hello", "messageType": "text" }
```

- multipart body:
  - `content` (string, optional for attachments; required for `messageType=text`)
  - `messageType`: `image | file`
  - `file`:
    - images allowed: `image/jpeg|jpg|png|webp` (and some endpoints allow gif)
    - file allowed: `application/pdf` only

Moderation:
- If backend flags content, it may store message as suspicious; UI should show backend error message and/or display “not allowed” placeholder where applicable.

Send-message success response contains `data.message` with a similar shape:
- includes `attachmentUrl` (if any)
- includes `isRead` and `createdAt`

#### Mark message read

- `PUT /api/user/chat/conversations/:conversationId/messages/:messageId/read`

#### Admin support message (user→admin)

`POST /api/user/chat/admin/message`

- Purpose: create/find an admin-user conversation and send a message.
- Body rules match normal send-message (JSON or multipart). For attachments, `content` is optional.
- Vendors can message admin even if KYC is not accepted (admin support chat is always available).

Frontend UX requirement:
- Provide a **“Support”** entry in chat. If no existing admin conversation is found, first message should call this endpoint; after that, the conversation appears in the normal conversations list and the thread uses the standard messages endpoints.

### 12.11 Projects (customer + vendor) including bidding + payments + invoices

#### Attachments upload (customer)

`POST /api/user/projects/attachments/upload` (multipart)

- field: `files` (array) (max 10)
- allowed: `application/pdf` or `image/*`
- response:

```json
{ "success": true, "data": { "urls": ["https://..."] } }
```

#### List projects (customer/vendor)

`GET /api/user/projects?page&limit`

- customer: own projects
- vendor: projects where vendor has an active assignment

Response notes (per project item):

- `latestBidWindowId`: latest bid window id for this project if any, else `null`
- `hasVendorReview`: boolean (customer: whether the customer has submitted a vendor review for this project)
- `vendorReview`: object|null (customer: the full review model for this project, used to prefill update form)
- `referenceImage`: string|null (optional reference image URL)
- `bidModel`:
  - `latestBidWindowId`: same value as `latestBidWindowId`
  - `bidWindows[]`: **all** bid windows for the project (latest first). Each window includes:
    - `id`, `projectId`, `customerId`
    - `noOfDays`
    - `isActive`
    - `createdAt`, `updatedAt`
    - `finishingTimestamp` (canonical) + `finishingAt` (alias)
    - `finishedAt` (nullable)
    - `startedAt` (alias of `createdAt`)

Example (200):

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 123,
        "customerId": 10,
        "title": "Need marble installation",
        "status": "running",
        "projectStatus": "started",
        "latestBidWindowId": 55,
        "bidModel": {
          "latestBidWindowId": 55,
          "bidWindows": [
            {
              "id": 55,
              "projectId": 123,
              "customerId": 10,
              "noOfDays": 3,
              "isActive": true,
              "startedAt": "2026-03-10T10:00:00.000Z",
              "finishingAt": "2026-03-13T10:00:00.000Z",
              "finishingTimestamp": "2026-03-13T10:00:00.000Z",
              "finishedAt": null,
              "createdAt": "2026-03-10T10:00:00.000Z",
              "updatedAt": "2026-03-10T10:00:00.000Z"
            }
          ]
        },
        "createdAt": "2026-03-10T09:00:00.000Z",
        "updatedAt": "2026-03-10T10:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
  }
}
```

#### Create project (customer)

`POST /api/user/projects`

```json
{
  "title": "Need marble installation",
  "description": "Tiles for living room",
  "attachments": ["https://.../file.pdf"],
  "referenceImage": "https://.../reference.jpg",
  "meta": { "city": "Bengaluru" },
  "minAmount": 10000,
  "maxAmount": 20000,
  "timelineExpected": 7
}
```

Notes:
- created with `status: "draft"`
- `attachments` must be public `http/https` URLs (usually from the upload endpoint)
- `referenceImage` (optional) must be a valid public `http/https` URL

#### Review project feasibility (budget vs timeline)

`POST /api/user/projects/review`

- Accepts the same payload as `POST /api/user/projects` (title/description/attachments/meta/min-max+timeline).
- `attachments` and `referenceImage` are ignored by the AI feasibility check (backend still validates URL format if provided).

Response (200):

```json
{
  "success": true,
  "message": "Project feasibility review completed",
  "data": {
    "goodToGo": false,
    "estimatedGoldWeightGrams": 7.5,
    "goldRateUsed": 5400,
    "effectiveGoldRate": 6048,
    "breakdown": {
      "metalCost": 45360,
      "stoneCost": 0,
      "baseCost": 45360,
      "markup": 11340,
      "labourAndShipping": 5000,
      "estimatedCostPerPiece": 61700,
      "discountedPricePerPiece": 58615,
      "totalOrderCost": 586150,
      "discountMultiplier": 0.95
    },
    "timelineFeasible": true,
    "minimumProductionDays": 10,
    "pricingAnomaly": null,
    "tiersApplied": ["Tier 1 — Purity downgrade"],
    "suggestions": ["Switching from 18kt to 14kt reduces metal cost by ~₹10,000 per piece, making the piece feasible."]
  }
}
```

Notes:
- `estimatedGoldWeightGrams`, `goldRateUsed`, `effectiveGoldRate`, `minimumProductionDays`, `pricingAnomaly`, and numeric fields inside `breakdown` can be `null` if the AI response is missing/invalid (frontend should handle gracefully).
- If `goodToGo === true`, backend normalizes `suggestions` and `tiersApplied` to empty arrays.

#### Update project (customer)

`PATCH /api/user/projects/:id`

- draft: can update title/description/attachments/meta/referenceImage/amountRange/timelineExpected
- running: limited edit but **moderation is enforced** (contact sharing blocked)

Moderation failure (400):

```json
{
  "success": false,
  "message": "Project content violates platform policy",
  "data": { "reason": "…", "urls": [] }
}
```

#### Delete project (customer; only if not started)

`DELETE /api/user/projects/:id`

Rules:
- Allowed only when:
  - `project.status === "draft"` AND `project.projectStatus === "started"`
  - no bid windows, no assignments, and no successful payments exist for the project

Success (200):

```json
{ "success": true, "message": "Project deleted", "data": { "id": 123 } }
```

#### Start project (no bidding)

`POST /api/user/projects/:id/start`

- sets core status to `running`
- moderation enforced

Success (200):

```json
{
  "success": true,
  "data": { "projectId": 1, "status": "running", "projectStatus": "started" }
}
```

Moderation failure returns `400` with `data.reason` and `data.urls` (see update-project section).

#### Cancel project (customer)

`POST /api/user/projects/:id/cancel`

Rules:
- Allowed only if **no assignment exists** and **no successful advance/final payments** exist.
- If a bid window is active, it is closed and vendors are notified.

Success (200) returns the updated project with:
- `projectStatus: "cancelled"`
- `status: "finished"`
- `isFinished: true`

Success response (200) example:

```json
{
  "success": true,
  "message": "Project cancelled",
  "data": {
    "id": 123,
    "customerId": 10,
    "title": "Need marble installation",
    "description": "Tiles for living room",
    "attachments": ["https://.../file.pdf"],
    "referenceImage": "https://.../reference.jpg",
    "meta": { "city": "Bengaluru" },
    "amountRange": { "min": 10000, "max": 20000 },
    "timelineExpected": 7,
    "status": "finished",
    "projectStatus": "cancelled",
    "isFinished": true,
    "finishedAt": "2026-03-09T02:00:00.000Z",
    "createdAt": "2026-03-08T12:00:00.000Z",
    "updatedAt": "2026-03-09T02:00:00.000Z",
    "deletedAt": null
  }
}
```

#### Complete project (customer)

`POST /api/user/projects/:id/complete`

Rule:
- Allowed only when `project.projectStatus === "delivered"`.

Success (200) returns updated project with:
- `projectStatus: "completed"`
- `status: "finished"`
- `isFinished: true`

Success response (200) example:

```json
{
  "success": true,
  "message": "Project completed",
  "data": {
    "id": 123,
    "customerId": 10,
    "title": "Need marble installation",
    "description": "Tiles for living room",
    "attachments": ["https://.../file.pdf"],
    "referenceImage": "https://.../reference.jpg",
    "meta": { "city": "Bengaluru" },
    "amountRange": { "min": 10000, "max": 20000 },
    "timelineExpected": 7,
    "status": "finished",
    "projectStatus": "completed",
    "isFinished": true,
    "finishedAt": "2026-03-09T03:00:00.000Z",
    "createdAt": "2026-03-08T12:00:00.000Z",
    "updatedAt": "2026-03-09T03:00:00.000Z",
    "deletedAt": null
  }
}
```

#### Start bidding

`POST /api/user/projects/:id/start-bid`

- creates an active bid window until `now + bidCloseDuration days`
- moderation enforced

Notes:
- This endpoint no longer accepts `finishingTimestamp` / `endsAt` from the client.
- Backend stores `noOfDays` and `finishingTimestamp` based on system config `bid_close_duration` (days).

#### Get bid duration (customer)

`GET /api/user/projects/bid-close-duration`

Response (200):

```json
{
  "success": true,
  "data": { "bidCloseDuration": 3 }
}
```

#### View bids

- `GET /api/user/projects/:id/bids` (latest per vendor for the latest window)
- `GET /api/user/projects/:id/bids/active` (customer; latest active bid per vendor across windows)

Bid item fields include:
- `vendorId`, `vendor`, `vendorName`
- `vendorOverallProjectRating`: `{ averageRating: number|null, totalReviews: number }` (computed from project vendor reviews)

#### Manual end bid window

`POST /api/user/projects/:id/manual-end`

Body (optional):

```json
{ "endWithAutoWinner": true }
```

Notes:
- `endWithAutoWinner` defaults to `true` if omitted.
- If `endWithAutoWinner === true`: ends the active bid window **and** auto-picks winner (creates an assignment request).
- If `endWithAutoWinner === false`: only ends the active bid window (no auto winner selection, no assignment request created). Customer can use `POST /api/user/projects/:id/select-winner` to pick a winner later.

#### Select winner (customer)

`POST /api/user/projects/:id/select-winner`

```json
{ "bidEntryId": 999, "amount": 50000, "noOfDays": 10 }
```

or direct assignment (project must already be `running`):

```json
{ "vendorId": 77, "amount": 50000, "noOfDays": 10 }
```

Restriction:
- Vendor must have **KYC accepted**; otherwise assignment is rejected.

#### Reassign winner (customer)

`POST /api/user/projects/:id/reassign-winner` with same body shape as select-winner.

Rule:
- Allowed even if current assignment is accepted, **as long as no successful advance/final payments exist**. If any payment is successful, reassignment is blocked.

#### Vendor running projects list (bidding marketplace)

`GET /api/user/projects/running?page&limit`

- response includes:
  - `project` (includes `project.customer.firstName` + `project.customer.lastName`)
  - `customerName` (convenience field)
  - `bidWindow`
  - bidding stats (total bids, lowest price, best timeline).

#### Vendor bid participation list (projects where vendor has bid)

`GET /api/user/projects/bid-participation?page&limit`

- **Vendor only** (requires accepted KYC). Returns a **paginated** list of all projects where the vendor has participated in at least one bid (any bid window).
- Each list item includes:
  - **`hasActiveBidWindow`** (boolean): `true` if the project currently has an active bid window.
  - **`bidParticipationStatus`**: `"active"` only when:
    - the project has an active bid window **AND**
    - the authenticated vendor currently has at least one **non-withdrawn** bid in that effective bid window  
    Otherwise `"ended"` (even if the project has an active bid window but this vendor withdrew all bids).
  - **`totalBids`** (number): total **unique vendors** who have placed at least one active bid for the project’s **effective bid window**:
    - if there is an active bid window → count bids in that window
    - else → count bids in the latest bid window
    - counting logic: `deletedAt IS NULL` and `isWithdrawn = false`
  - **`isCurrentlyWinning`** (boolean): for **active** bid window projects only — `true` if the authenticated vendor is currently the winning vendor in the effective bid window (computed from latest non-withdrawn bid per vendor + winner selection rule).
  - **`winner`** (object): assignment/winner state
    - `isWinnerSelected` (boolean): `true` if an active assignment exists (winner already selected)
    - `isWinnerVendor` (boolean): `true` if the active assignment’s `vendorId` is the authenticated vendor
    - `assignmentStatus` (string|null): the active assignment status (e.g. `pending|accepted|rejected|...`)
  - The **same payload as the single project view** for a vendor (`GET /api/user/projects/:id`):
    - `project` (with customer summary)
    - `activeBidWindow`
    - `ledger` (only for projects where the vendor is the currently assigned & accepted vendor)
    - `advancePayment`, `finalPayment`
    - `statusModel` (coreStatus, projectStatus, isFinished, finishedAt, timeline)
    - `vendorContext` (hasBidEntries, latestBidEntry, assignmentRequests, etc.)
      - `vendorContext.latestBidEntry` in this endpoint returns the vendor’s latest **ACTIVE** bid (non-withdrawn) in the effective window; if the vendor withdrew all bids, it is `null`.
- Response shape:
  - `data.projects[]`: array of the above items (ordered by most recent bid participation first).
  - `data.pagination`: `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`.

#### Vendor bid actions

- `POST /api/user/projects/:id/bid`

```json
{ "price": 50000, "daysToComplete": 10 }
```

- `DELETE /api/user/projects/:id/bid/latest` (withdraw latest bid)
- `POST /api/user/projects/:id/withdraw` (withdraw all bids in current window)

#### Vendor project operational status updates

`PATCH /api/user/projects/:id/status`

```json
{ "projectStatus": "in_progress" }
```

- allowed transitions:
  - `started → in_progress`
  - `in_progress → qc`

#### Project details (customer owner or any vendor)

`GET /api/user/projects/:id`

- Access rules:
  - customer: only the project owner
  - vendor: can view **any** project details

- response includes:
  - `project` (with customer summary)
  - `activeBidWindow`
  - `ledger` (recent payment ledger entries) — returned only for:
    - customer owner, or
    - the **currently assigned & accepted** vendor
  - `advancePayment` and `finalPayment` status blocks:
    - `status`: `due|paid|not_applicable`
    - `suggestedAmount` (when applicable)
  - `statusModel`:
    - `coreStatus`, `projectStatus`, `isFinished`, `finishedAt`
    - `timeline[]` from project status logs (from/to status, changedBy, meta, timestamps)
  - `qcModel`:
    - `logs[]`: latest QC logs for this project (up to 20)
      - `status`: `passed|failed`
      - `remarks`: string or `null`
      - `createdAt`: QC review timestamp
  - `vendorContext` (only when requester is a vendor):
    - `isRelated` (true if vendor has bids/requests/active assignment on this project)
    - `hasBidEntries`
    - `latestBidEntry` (the vendor’s most recent bid on this project; may be `null`)
    - `assignmentRequests[]` (the vendor’s assignment/requests on this project)

#### Project payments (Razorpay)

Create order:

- `POST /api/user/projects/:id/payments/razorpay/create-order`

```json
{ "type": "advance" }
```

Verify:

- `POST /api/user/projects/:id/payments/razorpay/verify`

```json
{
  "type": "advance",
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "..."
}
```

Rules:
- advance requires accepted assignment
- final requires advance already paid

Deprecated endpoints (must not be used by frontend):
- `POST /api/user/projects/:id/pay-advance` → **410**
- `POST /api/user/projects/:id/pay-final` → **410**

#### Project invoice PDF

- `GET /api/user/projects/:id/invoice` → PDF download (filename generated by backend; frontend should just download)

#### Vendor project payment details

`GET /api/user/projects/:id/payment-details`

- **Auth**: vendor (requires accepted KYC + selling enabled)
- **Access rule**: only when the vendor has an **active accepted assignment** on that project.
- Returns:
  - `projectId`
  - `vendorId`
  - `totalAmount`: agreed project amount (from assignment `agreedPrice` or winning bid if not set)
  - `totalCommission`: total commission recorded in `project_ledger` (sum of `type = "commission"` & `status = "success"`)
  - `totalPayableToVendor`: `max(totalAmount - totalCommission, 0)` (or `null` if `totalAmount` is unknown)
  - `vendorSettlementDone`: boolean flag from project (`vendorSettlementDone`) indicating whether admin has marked vendor settlement as done (and created a settlement ledger entry)
  - `settlementMarkedAt`: ISO timestamp string when settlement was marked (from settlement ledger `reference.recordedAt` or ledger `createdAt`), otherwise `null`

### 12.12 Assignments (vendor)

- `GET /api/user/assignments?page&limit&status&isActive`

Response:

```json
{
  "success": true,
  "data": {
    "assignments": [
      {
        "id": 1,
        "projectId": 4,
        "vendorId": 23,
        "bidEntryId": 19,
        "assignedByType": "customer",
        "status": "accepted",
        "isActive": true,
        "assignedAt": "2026-03-11T13:40:00.000Z",
        "acceptedAt": "2026-03-11T13:45:00.000Z",
        "rejectedAt": null,
        "replacedById": null,
        "agreedAmount": 5000,
        "agreedDaysToComplete": 6,
        "createdAt": "2026-03-11T13:40:00.000Z",
        "updatedAt": "2026-03-11T13:45:00.000Z",
        "project": {
          "id": 4,
          "customerId": 22,
          "title": "heelo world",
          "description": "helow world hah haha ha ah",
          "attachments": [
            "https://.../projects/22/attachment/file.png"
          ],
          "meta": {
            "schema": {
              "place": { "type": "text", "label": "Place" },
              "format": { "type": "text", "label": "Format" }
            },
            "values": {
              "place": "Bhubaneswar",
              "format": "MP4"
            }
          },
          "amountRange": { "min": 5000, "max": 7500 },
          "timelineExpected": 7,
          "status": "running",
          "projectStatus": "started",
          "isFinished": false,
          "finishedAt": null,
          "createdAt": "2026-03-11T13:30:42.390Z",
          "updatedAt": "2026-03-11T17:00:59.871Z",
          "customer": {
            "id": 22,
            "firstName": "from admin",
            "lastName": "from admin",
            "userType": "customer"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```
- `POST /api/user/assignments/:id/accept`
- `POST /api/user/assignments/:id/reject`

### 12.13 Assignments (customer)

#### Customer projects with assignments (paginated)

`GET /api/user/projects/assignments?page&limit&status&isActive`

- **Auth**: customer
- **Filters**:
  - `status` (optional): `pending|accepted|rejected|reassigned|cancelled`
  - `isActive` (optional): `true|false`
- Returns the customer’s projects that have assignments, with an `assignments[]` array per project.

Response:

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 4,
        "customerId": 22,
        "title": "heelo world",
        "description": "helow world hah haha ha ah",
        "attachments": [
          "https://.../projects/22/attachment/file.png"
        ],
        "meta": {
          "schema": {
            "place": { "type": "text", "label": "Place" },
            "format": { "type": "text", "label": "Format" }
          },
          "values": {
            "place": "Bhubaneswar",
            "format": "MP4"
          }
        },
        "amountRange": { "min": 5000, "max": 7500 },
        "timelineExpected": 7,
        "status": "running",
        "projectStatus": "started",
        "isFinished": false,
        "finishedAt": null,
        "createdAt": "2026-03-11T13:30:42.390Z",
        "updatedAt": "2026-03-11T17:00:59.871Z",
        "customer": {
          "id": 22,
          "firstName": "from admin",
          "lastName": "from admin",
          "userType": "customer"
        },
        "assignments": [
          {
            "id": 1,
            "projectId": 4,
            "vendorId": 23,
            "vendor": {
              "id": 23,
              "firstName": "Vendor",
              "lastName": "Name"
            },
            "bidEntryId": 19,
            "assignedByType": "customer",
            "status": "accepted",
            "isActive": true,
            "agreedAmount": 5000,
            "agreedDaysToComplete": 6,
            "assignedAt": "2026-03-11T13:40:00.000Z",
            "acceptedAt": "2026-03-11T13:45:00.000Z",
            "rejectedAt": null,
            "replacedById": null,
            "createdAt": "2026-03-11T13:40:00.000Z",
            "updatedAt": "2026-03-11T13:45:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

Important UX note: after vendor accepts, project enters `invoice` operational status until customer pays **advance**.

## 13) Public helper endpoints (optional for frontend)

These are mounted at `/api/public` (see `src/app.ts`).

### 13.1 Country codes

- `GET /api/public/country-codes`

Returns:

```json
{
  "success": true,
  "data": [
    { "countryCode": "IN", "countryName": "India", "phoneCode": "+91" }
  ]
}
```

### 13.2 Razorpay test pages / webhook (not for production frontend UI)

- `GET /api/public/payments/razorpay/test` (HTML test page; gated by env)
- `GET /api/public/payments/razorpay/test-products` (HTML test page; gated by env)
- `POST /api/public/payments/razorpay/webhook` (server-to-server Razorpay webhook)

Frontend should **not** depend on these except possibly in internal QA tooling.
