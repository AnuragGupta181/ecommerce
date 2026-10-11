import { formatINR } from "../../lib/money.js";

export type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type NotifyOrder = {
  orderNumber: string;
  payable: number;
  paymentMethod: "COD" | "UPI_ON_DELIVERY";
  shippingAddress: ShippingAddress;
  items: { productName: string; variantLabel: string; quantity: number; lineTotal: number }[];
  user: { name: string; email: string; phone: string | null };
};

export type NotifyRider = {
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  vehicleType: string;
  vehicleNumber: string | null;
};

export type Rendered = { subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function formatAddress(a: ShippingAddress): string {
  return [a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : null, `${a.city}, ${a.state} - ${a.pincode}`]
    .filter(Boolean)
    .join(", ");
}

function itemsText(order: NotifyOrder): string {
  return order.items
    .map((item) => `• ${item.productName}${item.variantLabel !== "Default" ? ` (${item.variantLabel})` : ""} × ${item.quantity}`)
    .join("\n");
}

function amountLine(order: NotifyOrder): string {
  const method = order.paymentMethod === "COD" ? "Cash on Delivery" : "UPI on Delivery";
  return `${formatINR(order.payable)} (${method})`;
}

/** Wraps plain text lines in the branded email shell. */
function layout(storeName: string, heading: string, lines: string[]): string {
  const body = lines
    .map((line) => `<p style="margin:0 0 12px;white-space:pre-line">${escapeHtml(line)}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#FAF8F3;font-family:Arial,Helvetica,sans-serif;color:#1C1A14">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ECE8DC;border-radius:14px;overflow:hidden">
<tr><td style="background:#FFC727;padding:18px 24px;font-size:20px;font-weight:800">${escapeHtml(storeName)}</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:18px;margin:0 0 16px">${escapeHtml(heading)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #ECE8DC;font-size:12px;color:#7A7465">This is an automated message from ${escapeHtml(storeName)}.</td></tr>
</table></td></tr></table></body></html>`;
}

function render(storeName: string, subject: string, heading: string, lines: string[]): Rendered {
  return { subject, text: [heading, ...lines].join("\n\n"), html: layout(storeName, heading, lines) };
}

export const templates = {
  orderPlacedCustomer(store: string, order: NotifyOrder): Rendered {
    return render(store, `Order ${order.orderNumber} placed`, `Thanks for your order, ${order.user.name}!`, [
      `Order ID: ${order.orderNumber}`,
      itemsText(order),
      `Amount: ${amountLine(order)}`,
      `Delivering to: ${formatAddress(order.shippingAddress)}`,
      "We'll message you with your delivery partner's name and number once the order is on its way.",
    ]);
  },

  orderPlacedAdmin(store: string, order: NotifyOrder): Rendered {
    return render(store, `New order ${order.orderNumber}`, `New order ${order.orderNumber}`, [
      `Customer: ${order.user.name} (${order.shippingAddress.phone})`,
      itemsText(order),
      `Amount: ${amountLine(order)}`,
      `Address: ${formatAddress(order.shippingAddress)}`,
    ]);
  },

  riderAssignedCustomer(store: string, order: NotifyOrder, rider: NotifyRider): Rendered {
    return render(
      store,
      `Delivery partner assigned for ${order.orderNumber}`,
      `Your order ${order.orderNumber} has a delivery partner`,
      [
        `Delivery partner: ${rider.name}`,
        `Phone: ${rider.phone}`,
        `Amount to pay at delivery: ${amountLine(order)}`,
        "You can call or WhatsApp your delivery partner directly for any delivery questions.",
      ],
    );
  },

  riderAssignedRider(store: string, order: NotifyOrder, rider: NotifyRider): Rendered {
    const a = order.shippingAddress;
    return render(store, `New delivery: ${order.orderNumber}`, `Hi ${rider.name}, new delivery assigned`, [
      `Order ID: ${order.orderNumber}`,
      `Customer: ${a.name}`,
      `Customer phone: ${a.phone}`,
      `Address: ${formatAddress(a)}`,
      `Items:\n${itemsText(order)}`,
      `Collect: ${amountLine(order)}`,
    ]);
  },

  riderAssignedAdmin(store: string, order: NotifyOrder, rider: NotifyRider): Rendered {
    return render(store, `Rider assigned: ${order.orderNumber}`, `Rider assigned to ${order.orderNumber}`, [
      `Rider: ${rider.name} (${rider.phone})${rider.vehicleNumber ? `, ${rider.vehicleType} ${rider.vehicleNumber}` : ""}`,
      `Customer: ${order.shippingAddress.name} (${order.shippingAddress.phone})`,
      `Address: ${formatAddress(order.shippingAddress)}`,
      `Collect: ${amountLine(order)}`,
    ]);
  },

  orderStatusCustomer(store: string, order: NotifyOrder, title: string, message: string): Rendered {
    return render(store, `${title} · ${order.orderNumber}`, title, [`Order ID: ${order.orderNumber}`, message]);
  },

  passwordResetOtp(store: string, name: string, otp: string): Rendered {
    return render(store, `Your ${store} password reset code`, `Hi ${name}, reset your password`, [
      `Your one-time code is: ${otp}`,
      "It expires in 10 minutes. If you didn't request this, you can ignore this email.",
    ]);
  },
};
