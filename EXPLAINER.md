# PlotTwin explainer (read this before the demo)

## 1. The problem
HoABL sells land 100% digitally. Buyers never visit the site, so the screen *is* the site visit. Three things have to feel right:
1. **Seeing the land.** Where is my plot, what's next to it, and is it near the lake or clubhouse?
2. **Trusting inventory.** If the screen says a plot is available, it really is. When a launch gets 45,000 conversations and sells out many times over, lots of people click the same plot in the same second.
3. **Understanding the money.** ₹999 to register, 9.9% at booking, 10% after a month, then 1% a month. Buyers need to see what that means for *their* cash flow.

PlotTwin is a working prototype of all three for a **fictional** 20-acre township, "Aranya Alibaug" (156 plots, ₹2.7 to 5.2 Cr).

## 2. What it does (feature map)
| Area | What you show |
|---|---|
| 3D site plan | react-three-fiber scene with 156 plots, roads, clubhouse with pool, lake, orchard, gate and trees. Plots are colour-coded (green available, amber held and pulsing, red booked with a villa on it). Hover a plot for its card, click it to fly the camera to it. |
| Find a plot | Filters for budget, size, facing, status, corner, park-facing and lake-facing. Non-matching plots dim in 3D. "Recommend me a plot" is a 4-question quiz that scores live availability and returns the top 3. |
| Booking flow | Hold (10-minute lease with a countdown ring), then mock KYC, then a mock ₹999 UPI payment (marked DEMO, no gateway), then BOOKED. It ends with a timeline and a document vault of 4 PDFs generated in the browser, all watermarked DEMO. |
| Payment studio | Compares the 1%-a-month Growth plan, a development-linked plan and upfront payment: cumulative cash-flow chart, total paid vs present value, and a full schedule. |
| Admin | Sell-through, revenue booked, live holds, hold-to-book conversion, status donut, sell-through by block, a 2D heatmap (by status or price), a live activity feed, **Race test (8 bots)**, hold length (10 min / 2 min / 30 s) and **Reset demo**. |

## 3. Architecture
```
React UI (Vite + TS + Tailwind, framer-motion, recharts, jsPDF)
        │  useSyncExternalStore
        ▼
PlotStore  ── pure merge rule (sync/merge.ts) ── one versioned record per plot
   │                     │
   │ same browser        │ cross-device (pluggable Transport interface)
   ▼                     ▼
localStorage + Web Lock  ntfy.sh relay (free public pub/sub, HTTPS + SSE, no key)
+ BroadcastChannel       replays the last ~12h of messages on connect
```
It's all static (GitHub Pages / Vercel). There's no server of my own and no secrets.

## 4. Real-time sync and concurrency (the showpiece)
- **Each plot is one record:** `{plotId, status, by, at, exp, ver, epoch}`. Every change bumps `ver`. This is optimistic concurrency, the same idea as `UPDATE ... WHERE ver = 7`.
- **Same browser (two windows):** each write runs inside a **Web Lock** (`navigator.locks`), so read-check-write is atomic across windows, which gives true first-writer-wins. The other windows are told over **BroadcastChannel** in a few milliseconds.
- **Across devices:** each change is also published to a relay. Every client merges incoming records with one **deterministic rule**: a newer epoch (after a reset) wins, then a higher version wins. If two writers raced from the same version, the **earliest claim wins**, and on a tie the lower client id wins. All clients apply the same rule, so they all converge on the same answer. The loser gets a red "you lost the race" message.
- **Holds are leases:** a hold stores `exp`. Expiry is checked whenever someone *reads* the record, so a hold frees itself even if the holder closes the laptop. No cron is needed. The holder's tab also writes an explicit release for the activity log.
- **Business rules:** you can't hold a booked plot, you can't hold a plot someone else holds, each buyer gets **one live hold at a time** (so nobody can hoard plots), and you can only book a plot you hold while the hold is still live.
- **Race test:** 8 bots try to hold the same plot at the same instant. Exactly 1 wins and 7 are rejected.

**Honest limits:** the relay is a public best-effort service, and the cross-device tie-break trusts client clocks. That's fine for a demo but not for money, so production needs an authoritative server (next section). If the relay is down, same-browser sync still works fully. `?relay=off` turns it off, and `?room=xyz` gives a private room.

## 5. How it would scale in production
- **Source of truth:** Postgres `plots(id, status, holder, hold_expires_at, version)`. A hold is `UPDATE plots SET status='held', holder=$u, hold_expires_at=now()+'10 min', version=version+1 WHERE id=$p AND (status='available' OR hold_expires_at < now()) RETURNING *`. Zero rows returned means you lost. The single conditional update *is* the lock, with no read-then-write gap. Use `SELECT ... FOR UPDATE SKIP LOCKED` for "give me any good plot" flows.
- **Hot launches:** put holds in **Redis** (`SET plot:{id} {user} NX PX 600000`), which is atomic, gives TTL expiry for free and handles ~100k ops/s. Write the result through to Postgres, and the booking itself stays a Postgres transaction.
- **Fan-out:** the API publishes a change event (Redis pub/sub, NATS or Kafka). A stateless **WebSocket/SSE gateway** tier pushes it to browsers subscribed to `project:{id}`. Scale it horizontally behind a load balancer, and clients resync with `since=version` after a reconnect.
- **Idempotency:** payment webhooks and "book" calls carry an idempotency key, so retries never double-book. An outbox pattern keeps the DB and events consistent.
- **Waiting room:** for a Naigaon-style launch, add a virtual queue in front of the hold API, rate limits per user/IP, and bot protection.
- **Audit:** an append-only event log (who held what and when) feeds the admin dashboard and the CRM.

## 6. How it maps to HoABL / Xanadu
- GIS plot maps and virtual tours become the 3D twin, with plot facts that come from data rather than brochures.
- "Book a plot in 10 minutes" (the Zepto tie-up) becomes the 10-minute hold lease plus a 3-step KYC and payment flow.
- The Growth Investment Plan (₹999 + 9.9% + 10% + 1% a month) is modelled exactly, with the cash-flow comparison buyers ask about.
- Digital documents become the document vault and the auto-generated cost sheet and receipt.
- Sales and CRM: the admin dashboard, hold-to-book conversion and the activity feed are the same signals an AI sales agent (like Priya) could use, e.g. "buyer held a plot and let it expire, so call them".

## 7. Two-minute demo script (two windows side by side)
1. *(0:00)* "This is PlotTwin, a real-time digital twin for plotted developments. The project is fictional." Orbit the 3D map, then point out the lake, clubhouse and orchard.
2. *(0:20)* Click **Recommend me a plot**, answer 4 taps, then click a result. The camera flies to it and the card shows size, facing, premiums and distance to the clubhouse.
3. *(0:40)* Click **Open 2nd window** and put the two windows side by side. In the left window, click **Hold**. The plot turns amber in the right window within about a second, with a toast and a ripple.
4. *(1:00)* In the right window, open the same plot. It says "Held by Buyer X, frees in 9:5x" and the Hold button is gone. "First writer wins."
5. *(1:15)* Back in the left window, complete the mock KYC, then **Simulate ₹999 payment (DEMO)**. The plot turns red with a villa in both windows. Show the timeline and download a PDF.
6. *(1:35)* Open **Admin**: sell-through and revenue update live. Click **Race test (8 bots)**: 1 wins and 7 are rejected.
7. *(1:50)* Open **Payment plans**: "The 1% plan keeps about ₹1.7 Cr more in the buyer's pocket in year one than paying upfront."
Before the meeting, click **Reset demo** in Admin.

## 8. Likely CTO questions
1. **"What happens if two people click the same plot at the same millisecond?"** In the same browser, a Web Lock serialises them, so exactly one wins. Across devices, both clients apply the same merge rule (the earliest claim at the same version wins), so they converge and the loser is told. In production a single conditional `UPDATE ... WHERE status='available'` or Redis `SET NX` makes that atomic on the server.
2. **"Why not just use websockets?"** Because I wanted zero paid infrastructure on static hosting. The `Transport` interface is one file, so swapping the ntfy relay for a WebSocket gateway, Supabase Realtime or Ably is a drop-in change. The merge logic doesn't change.
3. **"How do holds expire if the buyer closes the tab?"** A hold is a lease with `exp`, and every reader treats an expired hold as available, so nothing has to "run" at expiry. On the server, Redis TTL or a `hold_expires_at < now()` condition does the same thing.
4. **"What about clock skew between devices?"** It only matters for the cross-device tie-break in this demo. In production, the server assigns the order (DB transaction or Redis), so client clocks don't matter.
5. **"How would this hold up on launch day with 45,000 buyers?"** Put a virtual waiting room and rate limits in front, holds in Redis, bookings in Postgres, and fan out through a horizontally scaled WebSocket tier subscribed per project. Reads (the map) come from a CDN-cached snapshot plus a delta stream.
6. **"How do you stop someone hoarding plots?"** One live hold per buyer (enforced in the lock), short TTLs, KYC before payment, and per-user rate limits on the server.
7. **"How do you prevent double booking on payment retries?"** Booking requires a live hold you own, and is idempotent on a booking/payment key. The gateway webhook confirms it, and the outbox publishes the event once.
8. **"Is the 3D fast enough on phones?"** 156 plots are simple meshes, trees are instanced (one draw call), and there are no heavy textures. For 5,000+ plots I'd instance all plots and colour them per instance, or switch to a GIS vector-tile map with 3D only on zoom.
9. **"Where does the plot data come from in real life?"** From a GIS layout (DXF/GeoJSON from the architect) loaded into PostGIS. Facing, corner, park/lake adjacency and distances are computed by spatial queries rather than typed in, which is exactly what `layout.ts` does procedurally here.
10. **"What did you test?"** Playwright with headless Chromium on the live site: two pages in one context, hold in A and see it held in B, B can't hold, book in A and B sees booked, the 8-bot race, a 30-second expiry, and zero console errors.

## 9. Files to know
`src/sync/merge.ts` (the conflict rule), `src/sync/store.ts` (locks, holds, booking, relay ingest), `src/sync/relay.ts` (swappable transport), `src/data/layout.ts` (procedural plots and pricing), `src/lib/plans.ts` (payment maths), `src/components/Scene.tsx` (3D).
