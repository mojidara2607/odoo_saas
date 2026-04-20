/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { Orderline } from "@point_of_sale/app/components/orderline/orderline";

// ---------------------------------------------------------------------------
// OrderReceipt — keep existing helpers
// ---------------------------------------------------------------------------
patch(OrderReceipt.prototype, {
    get receiptDate() {
        if (!this.order.date_order) {
            return "";
        }
        return this.order.formatDateOrTime("date_order");
    },

    get customerName() {
        return this.order.partner_id?.name || "";
    },

    /**
     * Total discount across all order lines.
     * Uses the built-in getTotalDiscount() which sums per-line
     * discount_amount from the pricing engine.
     * Always returns a number (0 when no discount is applied).
     *
     * NOTE: Must be a method, not a getter — the base template does
     * t-set="totalDiscount" which writes to the component scope.
     * A getter (read-only) would crash OWL with:
     *   "TypeError: setting getter-only property totalDiscount"
     */
    getReceiptTotalDiscount() {
        return Math.abs(this.order.getTotalDiscount() || 0);
    },
});

// ---------------------------------------------------------------------------
// Orderline — add per-unit tax breakdown for receipt description block.
//
// Exposed as a getter so it is accessible in the QWeb template via
// ``receiptTaxBreakdown``.
//
// Data flow:
//   line.order_id.unitPrices          ← prices computed with qty=1
//     .baseLineByLineUuids[line.uuid] ← per-line data
//       .tax_details.taxes_data[]     ← per-tax entries
//         .tax        → the account.tax record  (.name, .amount)
//         .tax_amount → per-unit tax amount (already for qty 1)
//         .base_amount→ base before this tax (for qty 1)
//
// The getter returns an array of objects ready for the template:
//   [{ name: "VAT 5%", pct: "5", taxAmt: 0.013, baseAmt: 0.250 }]
//
// If the line has no taxes, it returns an empty array.
// ---------------------------------------------------------------------------
patch(Orderline.prototype, {
    /**
     * Per-unit tax breakdown for the receipt description block.
     *
     * Returns an array like:
     *   [{ name: "VAT 5%", pct: "5", taxAmt: 0.013, baseAmt: 0.250 }]
     *
     * baseAmt is the per-unit price EXCLUDING tax (the "base rate").
     * taxAmt  is the per-unit tax amount for this specific tax.
     * name    is the tax display name (e.g. "VAT 5%").
     * pct     is the tax percentage as a string (e.g. "5").
     */
    /**
     * Line discount formatted for the receipt DISC column.
     * Returns e.g. "10%" or "0%" if no discount.
     */
    getDiscountDisplay(line) {
        const disc = line.discount;
        return disc ? Number(disc).toFixed(0) + "%" : "0%";
    },

    get receiptTaxBreakdown() {
        const line = this.props.line;

        if (!line.order_id || !line.tax_ids?.length) {
            return [];
        }

        try {
            // unitPrices is computed at order level with quantity = 1
            const unitData = line.order_id.unitPrices?.baseLineByLineUuids?.[line.uuid];
            if (!unitData || !unitData.tax_details?.taxes_data?.length) {
                return [];
            }

            const taxesData = unitData.tax_details.taxes_data;
            // base_amount on the first tax entry = per-unit base price excl tax
            const baseAmt = taxesData[0]?.base_amount ?? unitData.tax_details.raw_total_excluded_currency ?? 0;

            return taxesData
                .filter((td) => !td.is_reverse_charge)
                .map((td) => ({
                    name: td.tax?.name || "",
                    pct: td.tax?.amount != null ? parseFloat(td.tax.amount).toString() : "",
                    taxAmt: Math.abs(td.tax_amount ?? td.raw_tax_amount_currency ?? 0),
                    baseAmt: Math.abs(baseAmt),
                }));
        } catch (_e) {
            // Safety net: if anything in the price chain is not yet computed
            // (e.g. during line creation), return empty so the template
            // simply omits the breakdown.
            return [];
        }
    },

    /**
     * Formatted single-line tax breakdown string for the receipt.
     *
     * Examples:
     *   "(0.250 + VAT 5% 0.013)"
     *   "(0.250 + VAT 5% 0.013 + CESS 1% 0.003)"   ← multiple taxes
     *   ""                                            ← no taxes
     */
    get receiptTaxBreakdownText() {
        const parts = this.receiptTaxBreakdown;
        if (!parts.length) {
            return "";
        }

        // Use fixed decimal formatting that matches the currency's precision
        const currency = this.props.line.currency;
        const digits = currency?.decimal_places ?? 3;

        const base = parts[0].baseAmt.toFixed(digits);
        const taxParts = parts.map(
            (p) => `${p.name} ${p.taxAmt.toFixed(digits)}`
        );
        return `(${base} + ${taxParts.join(" + ")})`;
    },
});
