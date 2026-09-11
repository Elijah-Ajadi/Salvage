export function escapeHTML(value:unknown):string {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}

export interface ReceiptData {
  receiptNumber: string;
  type: 'purchase' | 'claim' | 'reservation';
  pickup?: {status:string;window:string;deadline:string;liveUrl:string};
  date: string;
  item: {
    id: string;
    title: string;
    category: string;
    material: string;
    condition: string;
    address?: string;
  };
  buyer: {
    name: string;
    email: string;
    phone?: string;
  };
  seller: {
    name: string;
    email?: string;
    phone?: string;
  };
  payment: {
    amount: number;
    currency: string;
    method: string;
    transactionId?: string;
    status: string;
    refundedAmount?: number;
    test?: boolean;
  };
}

export function generateReceiptHTML(data: ReceiptData): string {
  // Escape every externally supplied string before interpolation, including optional fields.
  const escapeFields=(value:any):any=>typeof value==='string'?escapeHTML(value):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,escapeFields(v)])):value;
  if(data.pickup&&!/^https?:\/\//.test(data.pickup.liveUrl))data={...data,pickup:{...data.pickup,liveUrl:''}};
  data=escapeFields(data);
  const isReservation=data.type==='reservation';
  const isPaid = data.type === 'purchase' && data.payment.amount > 0;
  const titleText = isReservation ? 'RESERVATION & PICKUP RECEIPT' : isPaid ? 'OFFICIAL PAYMENT RECEIPT' : 'CLAIM CONFIRMATION & PICKUP PASS';
  const badgeText = data.pickup ? data.pickup.status.toUpperCase() : data.payment.test ? 'TEST PAYMENT — NO REAL MONEY' : isPaid ? (data.payment.refundedAmount ? 'PARTIALLY REFUNDED' : 'PAID IN FULL') : 'FREE CLAIM CONFIRMED';
  const badgeColor = isPaid ? '#2d5a27' : '#315485';
  const badgeBg = isPaid ? '#eaf5e6' : '#eaf0f9';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${data.receiptNumber} - Salvage</title>
<style>
  @page { margin: 20mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #242921;
    background: #fff;
    margin: 0;
    padding: 30px;
    font-size: 14px;
    line-height: 1.5;
  }
  .receipt-box {
    max-width: 680px;
    margin: 0 auto;
    border: 1px solid #e1e6db;
    border-radius: 12px;
    padding: 36px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #eef2e8;
    padding-bottom: 20px;
    margin-bottom: 25px;
  }
  .brand {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -1px;
    color: #3b572a;
  }
  .brand span { color: #6f8f4a; }
  .receipt-tag {
    text-align: right;
  }
  .badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    background: ${badgeBg};
    color: ${badgeColor};
    margin-bottom: 6px;
  }
  .receipt-number {
    font-size: 12px;
    color: #798371;
    font-family: monospace;
  }
  .doc-title {
    font-size: 19px;
    font-weight: 700;
    color: #2b3a22;
    margin: 0 0 4px;
    letter-spacing: -0.3px;
  }
  .doc-sub {
    font-size: 13px;
    color: #717d69;
    margin: 0 0 24px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 25px;
  }
  .info-card {
    background: #f7f9f4;
    border: 1px solid #e7ede0;
    border-radius: 8px;
    padding: 14px 16px;
  }
  .info-card h4 {
    margin: 0 0 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #69775f;
  }
  .info-card p {
    margin: 0 0 4px;
    font-size: 13px;
  }
  .info-card strong {
    font-size: 14px;
    color: #242c1d;
  }
  .item-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 25px;
  }
  .item-table th {
    text-align: left;
    padding: 10px 12px;
    background: #f0f4ec;
    color: #4b5e3e;
    font-size: 12px;
    font-weight: 600;
    border-bottom: 1px solid #d9e3d0;
  }
  .item-table td {
    padding: 14px 12px;
    border-bottom: 1px solid #eef2e8;
    vertical-align: top;
  }
  .item-title {
    font-size: 15px;
    font-weight: 600;
    color: #273120;
    margin-bottom: 3px;
  }
  .item-meta {
    font-size: 12px;
    color: #7a8670;
  }
  .totals {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 25px;
  }
  .totals-table {
    width: 280px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
    color: #606d56;
  }
  .totals-row.grand {
    border-top: 2px solid #3c582c;
    margin-top: 6px;
    padding-top: 10px;
    font-size: 17px;
    font-weight: 700;
    color: #283a1d;
  }
  .instructions {
    background: #fffdf5;
    border: 1px solid #f0e6c5;
    border-radius: 8px;
    padding: 16px;
    font-size: 13px;
    color: #695d31;
    line-height: 1.6;
    margin-bottom: 25px;
  }
  .instructions strong {
    color: #4a401c;
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
  }
  .footer {
    border-top: 1px solid #edf1e6;
    padding-top: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #8c9782;
  }
  @media print {
    body { padding: 0; background: #fff; }
    .receipt-box { border: none; box-shadow: none; padding: 0; }
    .no-print { display: none; }
  }
  .print-bar {
    max-width: 680px;
    margin: 0 auto 16px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .print-btn {
    background: #3f632b;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 18px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .print-btn:hover { background: #325022; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="receipt-box">
  <div class="header">
    <div>
      <div class="brand">salvage<span>.</span></div>
      <div style="font-size:12px;color:#78866e;margin-top:3px;">Local Building Material Exchange</div>
    </div>
    <div class="receipt-tag">
      <div class="badge">${badgeText}</div>
      <div class="receipt-number">Ref: ${data.receiptNumber}</div>
      <div style="font-size:12px;color:#85907c;margin-top:2px;">${data.date}</div>
    </div>
  </div>

  <h2 class="doc-title">${titleText}</h2>
  ${data.pickup?`<p><strong>${data.pickup.status}</strong><br>Pickup: ${data.pickup.window}<br>Deadline: ${data.pickup.deadline}<br><a href="${data.pickup.liveUrl}">Open live receipt for current status and pickup actions</a></p>`:''}
  <p>${data.payment.method} · ${data.payment.status}${data.payment.refundedAmount ? ` · Refunded: $${data.payment.refundedAmount.toFixed(2)}` : ''}</p>
  <p class="doc-sub">${isReservation ? 'This is a reservation, not proof of payment or collection. Inspect the item before accepting.' : isPaid ? 'Thank you for your purchase. Please retain this receipt for your pickup appointment.' : 'This document serves as your verified claim ticket for item pickup.'}</p>

  <div class="grid">
    <div class="info-card">
      <h4>Buyer (Claimant)</h4>
      <strong>${data.buyer.name}</strong>
      <p>${data.buyer.email}</p>
      ${data.buyer.phone ? `<p>${data.buyer.phone}</p>` : ''}
    </div>
    <div class="info-card">
      <h4>Contractor (Seller)</h4>
      <strong>${data.seller.name}</strong>
      ${data.seller.email ? `<p>${data.seller.email}</p>` : ''}
      ${data.seller.phone ? `<p>${data.seller.phone}</p>` : ''}
    </div>
  </div>

  <table class="item-table">
    <thead>
      <tr>
        <th>Item Description</th>
        <th>Category</th>
        <th>Condition</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="item-title">${data.item.title}</div>
          <div class="item-meta">${data.item.material} · ID: ${data.item.id.slice(0, 8)}...</div>
        </td>
        <td>${data.item.category}</td>
        <td>${data.item.condition}</td>
        <td style="text-align:right;font-weight:600;">
          ${(isPaid||isReservation) ? `$${data.payment.amount.toFixed(2)}` : '<span style="color:#2f6e2b;">FREE</span>'}
        </td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Item Subtotal</span>
        <span>${(isPaid||isReservation) ? `$${data.payment.amount.toFixed(2)}` : '$0.00'}</span>
      </div>
      <div class="totals-row">
        <span>Marketplace Fee</span>
        <span>$0.00</span>
      </div>
      <div class="totals-row grand">
        <span>${isReservation?'Reserved price (not charged)':isPaid?'Total paid':'Total due'}</span>
        <span>${(isPaid||isReservation) ? `$${data.payment.amount.toFixed(2)} ${data.payment.currency.toUpperCase()}` : '$0.00 USD'}</span>
      </div>
    </div>
  </div>

  <div class="instructions">
    <strong>📍 Pickup Coordination Instructions</strong>
    <div><strong>Address:</strong> ${data.item.address || 'Address provided upon arrangement with contractor'}</div>
    <div style="margin-top:4px;">Please contact <strong>${data.seller.name}</strong> to schedule a convenient collection time. Present this receipt (on your mobile device or printed) when collecting your materials.</div>
  </div>

  <div class="footer">
    <div>Salvage Platform · Clean diversion from landfills</div>
    <div>Generated: ${new Date().toLocaleString()}</div>
  </div>
</div>
</body>
</html>`;
}

export function openReceiptWindow(data: ReceiptData) {
  const html = generateReceiptHTML(data);
  const win = window.open('', '_blank');
  if (win) {
    win.opener = null;
    win.document.open();
    win.document.write(html);
    win.document.close();
  } else {
    // Automatic receipts may be opened after a network response; provide a download when popups are blocked.
    const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
    const link=document.createElement('a');link.href=url;link.download='salvage-receipt.html';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
