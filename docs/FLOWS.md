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

## 8. Inventory

```
Admin adjust (IN / OUT / SET) + reason ─► StockMovement row ─► variant.stock updated (transaction)
Order placed ─► SALE (−qty)    Cancel/Return ─► RETURN (+qty)
Low stock = variant.stock <= variant.lowStockThreshold ─► dashboard alert + inventory filter
```
