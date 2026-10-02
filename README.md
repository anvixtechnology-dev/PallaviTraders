# PALLAVI TRADERS

A small stock and customer management app for a shop that sells **Pipes, Sheets
and Hardware**.

Three pages, nothing else:

| Page        | What it does                                                              |
| ----------- | ------------------------------------------------------------------------- |
| **Stats**   | Shows the current stock, and lets the admin enter or correct the counts.  |
| **Form**    | Records a customer purchase. Totals, balance and payment status are worked out automatically, and saving reduces the stock. |
| **Customers** | Every saved customer record. Click a row to see the full details.       |

Built with React + TypeScript + Vite, Tailwind CSS and Firebase (Auth +
Firestore). Records are stored in the cloud, so they are permanent and visible
from any device, and the app keeps working through a dropped connection.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script               | What it does                                     |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Dev server with hot reload                       |
| `npm run build`      | Type-check (`tsc -b`) then build to `dist/`     |
| `npm run preview`    | Serve the production build locally               |
| `npm run lint`       | oxlint                                           |
| `npm test`           | Vitest unit tests for the money/stock logic      |
| `npm run test:watch` | Vitest in watch mode                             |

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

### 3. Deploy the security rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Until the rules are deployed every read and write is refused, because the app
is built to require a signed-in user. Do this before entering real data.

### 4. Deploy the web app

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` rewrites every path to `index.html`, so refreshing `/form` or
`/customers` still works.

## How the stock stays correct

Saving a purchase runs inside a Firestore transaction:

1. The current stock counters are re-read on the server.
2. If the shop does not have enough on hand, the save is **refused** and nothing
   is written.
3. Otherwise the counters are reduced and the customer record is written — both
   or neither.

So if Pipes stock is 100 and a customer buys 10, the new stock is 90. Two people
saving at the same moment can never oversell, because the check happens on the
server rather than in the browser.

## Rules the code enforces

- **Stock can never go negative** and a purchase that would oversell is refused.
- **Quantity × Price = Total** for every line, and the grand total is the sum of
  the lines.
- **Payment status must match the amount paid** — `Paid` means the amount covers
  the grand total, `Unpaid` means nothing was paid, anything between is
  `Partially Paid`. The form fills this in for you as you type.
- **The balance never goes below zero.**
- **Money is never calculated with raw floats.** All arithmetic runs in integer
  paise, so `0.1 + 0.2` problems cannot reach a customer's bill.
- **Saved records are never modified or removed by the app.** Each purchase stores
  a snapshot of the items, quantity and price as they were at the time.

## Project layout

```
src/
  components/    Layout (header + navigation), UI primitives, auth provider
  hooks/         useStock, usePurchases — live Firestore subscriptions
  lib/           pure calculations, zod validation, money/date helpers, errors
  pages/         StatsPage, FormPage, CustomersPage, LoginPage
  services/      Firestore services — every write goes through these
  types.ts       domain types
firestore.rules  rules deployed to the project
```

Pages never touch Firestore directly. All reads are live subscriptions, so the
stock counters update the moment a purchase is saved — including from another
device.
