# PALLAVI IRON TRADERS

A small sales-ledger and quotation app for a shop that deals in **Pipes, Sheets
and Hardware**.

Two pages, nothing else:

| Page          | What it does                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Form**      | Two tabs. **Sale** records a sale and reduces stock atomically. **Quotation** builds a printable A4 quotation.     |
| **Customers** | The sales ledger (newest first), searchable by customer name, DS number or item. Click a row for the full details. |

There is deliberately **no stock-editing screen**: stock items are maintained
directly in the Firebase console, and the app only reads them (a sale deducts
from them). There is no dashboard or stats page.

Built with React + TypeScript + Vite, Tailwind CSS and Firebase (Auth +
Firestore). Records are stored in the cloud, so they are permanent and visible
from any device, and the app keeps working through a dropped connection.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                   |
| `npm run build`      | Type-check (`tsc -b`) then build to `dist/`  |
| `npm run preview`    | Serve the production build locally           |
| `npm run lint`       | oxlint                                       |
| `npm test`           | Vitest unit tests for the pure business logic |
| `npm run test:watch` | Vitest in watch mode                         |

## Firebase setup (one-time)

The app points at the `pallavitraders` Firebase project by default
(`src/services/firebase.ts`). To use a different project, copy `.env.example` to
`.env.local` and fill in the values.

### 1. Enable Cloud Firestore

If the app shows *"Cloud Firestore is not switched on for this project yet"*,
the database does not exist yet. Enable it once:

- Open
  [the Firestore API page for this project](https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=pallavitraders)
  and click **Enable**.
- In the Firebase console go to **Build → Firestore Database → Create database**.
  Pick a region close to the shop (`asia-south1` for India) and choose
  **Production mode**.

### 2. Enable Email/Password sign-in and create the admin account

- **Authentication → Sign-in method → Email/Password → Enable**.
- **Authentication → Users → Add user** with an email and password.

There is no sign-up screen, so that account is the only way into the app.

### 3. Add stock items

Create documents in the **`stock`** collection, one per item:

| Field      | Type   | Example                  |
| ---------- | ------ | ------------------------ |
| `category` | string | `pipes` / `sheets` / `hardware` |
| `name`     | string | `GI Pipe 2 inch`         |
| `quantity` | number | `120`                    |
| `price`    | number | `80`                     |

The app reads these and shows the available quantity, but never edits them.

### 4. Deploy the security rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 5. Deploy the app

```bash
npm run build
firebase deploy --only hosting
```

## Collections

| Collection    | Purpose                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `stock`       | One document per item (`category`, `name`, `quantity`, `price`).        |
| `customers`   | One aggregate document per customer (keyed by normalised name), updated by the sale transaction. |
| `sales`       | One document per sale, with a snapshot of the items and sale-time prices. |
| `quotations`  | Saved quotations (used to suggest the next number). Quotations never touch stock. |

## How a sale works

Saving a sale runs inside a Firestore transaction:

1. Every requested stock item and the customer document are read first.
2. If any item is short, the whole save is refused (`InsufficientStockError`)
   with the exact item and quantity that is not available.
3. Otherwise the sale is written, each stock item is decremented, and the
   customer's aggregate is updated — all or nothing.

## Rules the code enforces

- **Stock can never go negative** and a sale that would oversell is refused,
  even when two devices submit at once (the check runs on the server).
- **Quantity × Price = Total** per line; the grand total is the sum of the lines.
- **Payment status must match the amount paid** — `Paid` means the amount covers
  the grand total, `Unpaid` means nothing was paid, anything between is
  `Partially Paid`. The form fills this in automatically, with a manual override.
- **The balance never goes below zero.**
- **Money is never calculated with raw floats.** Arithmetic runs in integer
  paise, so `0.1 + 0.2` problems cannot reach a customer's bill.
- **Saved records are never modified or removed by the app.** Each sale stores a
  snapshot of the items, quantity and price as they were at the time.
- **Quotations never change stock.**

## Quotation PDF

The quotation is a real A4 sheet rendered in the browser. There is **no PDF
library** — use the browser's **Print → Save as PDF** (the *Print / Save as PDF*
button does this). The letterhead, GSTIN and styling are fixed:

- **PALLAVI IRON TRADERS** · Sales & Purchase · 99635 22888 · Proprietor: Merugu Srinivas
- D.No. 4-2-9A, Bypass Road, Near B.V. Raju Statue, BHIMAVARAM - 534 202, W.G. Dist., (A.P.)
- GSTIN `37BPXPS5746G1ZY` (read-only)

The **Send on WhatsApp** button opens WhatsApp with a pre-filled message
(quotation number, customer name, grand total). It does **not** attach the PDF —
save the PDF and attach it yourself.

## Project layout

```
src/
  components/    Layout (header + nav), UI primitives, SaleForm, QuotationForm, QuotationPreview
  hooks/         useStockItems, useSales, useQuotations — live Firestore subscriptions
  lib/           pure calculations, validation, money/date/words helpers, errors
  pages/         FormPage, CustomersPage, LoginPage
  services/      Firestore services — every write goes through these
  types.ts       domain types
firestore.rules  rules deployed to the project
```

Pages never touch Firestore directly. All reads are live subscriptions, so the
stock shown on the sale form updates the moment a sale is saved — including from
another device.
