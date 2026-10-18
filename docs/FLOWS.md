# User & System Flows

## 1. App launch

```
Splash (logo on yellow) ─► first launch? ─yes─► Onboarding (3 slides) ─► Home (guest)
                               └─no──► restore session from SecureStore
                                         ├─ valid refresh token ─► Home (signed in)
                                         └─ none / expired ─────► Home (guest)
```

## 2. Guest gate

A guest can browse: Home, Categories, Listing, Search and Product detail.

```
Guest taps (Add to cart | Buy now | Wishlist | Write review | Cart tab | Orders)
   ─► LoginSheet ("Login to continue")
        ├─ Login ─► success ─► pending action resumes automatically
        └─ Sign up ─► success ─► pending action resumes automatically
```

## 3. Sign up / login / reset

```
Sign up: name, email, phone, password ─► POST /auth/register ─► tokens ─► store ─► resume
Login:   email|phone + password ─► POST /auth/login
Forgot:  email ─► POST /auth/password/forgot (6-digit OTP by email, 10 min)
         ─► OTP + new password ─► POST /auth/password/reset ─► login
```

## 4. Purchase

```
Product ─► choose variant ─► Add to cart ─► Cart
Cart ─► (optional) apply coupon ─► (optional) use coins ─► Place order
       └─ server recomputes price on every cart change (GET /cart)
Checkout ─► select address (or add) ─► payment: COD / UPI on delivery
        ─► POST /orders  (body: addressId, paymentMethod, couponCode?, useCoins)
             server transaction:
               1. lock + validate stock for every cart line
               2. re-price (pricing engine), validate coupon & coin balance
               3. create Order + OrderItems (price snapshot)
               4. decrement stock, write StockMovement(SALE)
               5. CouponRedemption, CoinTxn(REDEEM)
               6. clear cart, history(PLACED)
             after commit: email order confirmation + in-app notification + admin alert
        ─► Success screen (order number, payable, coins to be earned)
```

Buy now is the same flow, but it uses a one-item checkout (`POST /orders` with `items`) and leaves the cart untouched.

## 5. Fulfilment and rider assignment (admin)

```
New order (PLACED) ─► Confirm ─► Pack ─► Assign rider
   Assign rider dialog: pick from active registered riders (search by name/phone)
   PATCH /admin/orders/:id/assign-rider { riderId }
      ─► order.riderId set, status RIDER_ASSIGNED, history row
      ─► notifications (after commit):
           customer: email + WhatsApp + in-app  → "Order HT… will be delivered by <rider> (<phone>)"
           rider:    email + WhatsApp           → order no, customer, phone, address, items, amount to collect
           admin:    email + WhatsApp           → assignment summary
   ─► Out for delivery ─► Delivered (coins credited) 
```

- The rider must already exist under Riders with phone, WhatsApp, email and vehicle details. Unregistered riders cannot be assigned.
- If WhatsApp is not configured, the order page shows "Send via WhatsApp" buttons (`wa.me` links with pre-filled text) for the customer, the rider and the admin.
- **Resend notifications** re-triggers the same messages, for example after correcting a phone number.

## 6. Cancel and return

```
Customer cancel (PLACED|CONFIRMED|PACKED) ─► reason ─► CANCELLED
   ─► restock (StockMovement RETURN), refund redeemed coins, coupon redemption released
Admin cancel (any state before DELIVERED) ─► same side effects, customer notified
Return (DELIVERED, within returnWindowDays) ─► RETURN_REQUESTED ─► admin approve ─► RETURNED
   ─► restock, reverse earned coins, refund redeemed coins
   └► admin reject ─► RETURN_REJECTED
```

## 7. Coins

```
Order DELIVERED ─► earn = floor(payable/100) * earnRatePer100 ─► CoinTxn(EARN)
Checkout useCoins ─► redeem = min(balance, floor(afterCoupon * maxRedeemPercent/100)) ─► CoinTxn(REDEEM)
Cancel ─► CoinTxn(REFUND) for redeemed
Return ─► CoinTxn(REVERSE) for earned, CoinTxn(REFUND) for redeemed
Admin ─► CoinTxn(ADJUST) ± with note
```

## 8. Shop stock

Stock belongs to a shop's listing (`BranchVariantStock`), not the catalog variant. Every change goes
through `branch-stock.service.ts` and writes a `BranchStockMovement` in the same transaction.

```
Vendor adjust (IN / OUT / SET) + reason ─► movement ─► listing.stock
Order placed ─► SALE (−qty)         Cancel ─► CANCEL (+qty)    Return ─► RETURN (+qty)
Counter bill ─► COUNTER_SALE (−qty) Subscription drop delivered ─► SUBSCRIPTION (−qty)
Crossing the low-stock line ─► email to the shop (after commit)
Admin ─► /inventory shows every shop's stock read-only
```

## 9. Marketplace: becoming a shop

```
/vendor/signup (public) ─► Vendor PENDING + owner user ─► admin email
Admin /vendors/:id ─► Approve (sets commission) ─► owner can sign in to /vendor
                   └─ Reject / Suspend ─► suspended shops are read-only (tradingForWrites)
Vendor ─► Shop settings: branches (point, radius, ₹/km, minimum and free-above), hours,
          open/closed switch with a message, staff
Vendor ─► Stock: list catalog variants at their own price and stock (or create a product)
```

## 10. Marketplace: buying from the nearest shop

```
App location (GPS | area | pincode) ─► X-Location on every request
Product ─► offers from every shop, nearest open in-stock shop first
Add to cart ─► cart takes that shop
   └─ item from another shop ─► 409 CART_SHOP_CONFLICT ─► "Replace cart?" ─► replaceCart
Cart ─► "Other shops" (GET /cart/shops) ─► switch the whole cart to another shop
Checkout ─► quote for the address (distance fee from pricing/delivery.ts)
   └─ shop closed / out of range ─► 409 SHOP_UNAVAILABLE ─► pick another shop
Order ─► vendor fulfils (confirm, pack, own rider, deliver) ─► commission fixed on the order
        └─ system chat message to the shop with the order number
```

## 11. Subscriptions

```
Vendor ─► Plan: one listing, quantity per drop, slots, weekly and/or monthly price + delivery fee
Customer ─► Daily essentials ─► plan ─► days of the week, quantity, slot, start (≥ tomorrow),
            optional skip dates, payment plan (upfront | two instalments | end of period)
        ─► POST /subscriptions/quote ─► every date, goods, delivery, total, instalments
        ─► POST /subscriptions ─► drops created, instalments computed ─► shop + customer notified
Customer, until 8 pm the evening before a drop:
   skip / restore a day · pause a range (and resume) · cancel (future drops cancelled)
   └─ every change recomputes instalments to match what will actually be delivered
Vendor ─► assign a rider ─► rider gets a private link /r/<token> (email + WhatsApp link)
Morning ─► vendor "Today" board (what to load) or the rider page ─► mark delivered
        ─► stock taken once per drop (repeat marks are no-ops); future drops are refused
Vendor ─► record payment / refund ─► receipt RCPT-… ─► ledger: charged, paid, balance, due now
Daily cron 18:00 IST ─► tomorrow's reminders, instalment reminders, stock warnings,
                        completes subscriptions whose period ended
Renew ─► same plan, days and slot, starting the day after the period ends
```

## 12. Support tickets

```
Customer ─► category + subject + message (+ the order or subscription it is about)
   ORDER_ISSUE | SUBSCRIPTION_ISSUE ─► MINOR ─► the shop handles it (vendor portal)
   everything else ─────────────────► MAJOR ─► the platform handles it (admin)
Staff reply ─► OPEN → IN_PROGRESS ─► customer gets an in-app notice + email
Staff ─► RESOLVED ─► customer replies ─► back to OPEN
Customer ─► CLOSED (customers can only close) ─► no further replies
Admin ─► escalate MINOR → MAJOR (the shop loses access) or hand back to the shop
Shop and admin see the context: customer history, the order or subscription, recent drops
```

## 13. Payouts

```
Customers pay the shop's rider, so the shop already holds the money.
Per period (IST whole days):
   gross      = orders (items + delivery) + delivered subscription drops
   commission = order commission (fixed at order time) + commission on drop goods
   net        = vendor earning − collected by vendor
               (> 0 platform pays the shop, < 0 the shop pays the platform)
Admin /payouts ─► preview ─► Create ─► PAY-… links each order and drop (settled exactly once)
              ─► Mark paid + reference ─► shop emailed
Vendor /vendor/payouts ─► upcoming (unsettled) and statements, read-only, PDF and Excel
```
