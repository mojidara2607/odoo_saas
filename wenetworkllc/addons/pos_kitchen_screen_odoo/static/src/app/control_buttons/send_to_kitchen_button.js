/** @odoo-module **/

import { ControlButtons } from "@point_of_sale/app/screens/product_screen/control_buttons/control_buttons";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

/**
 * Raw JSON-RPC call that does NOT depend on any Owl component being alive.
 * Used as a fallback when `useService("orm")` rejects with
 * "Component is destroyed" because the ControlButtons component (or its
 * parent screen) was unmounted between dialog-open and dialog-confirm.
 */
async function _kitchenCallKw(model, method, args, kwargs = {}) {
    const userContext =
        window.odoo?.session_info?.user_context ||
        window.odoo?.__DEBUG__?.services?.user?.context ||
        {};
    const response = await fetch("/web/dataset/call_kw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
                model: model,
                method: method,
                args: args,
                kwargs: { ...kwargs, context: userContext },
            },
        }),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from /web/dataset/call_kw`);
    }
    const json = await response.json();
    if (json.error) {
        const msg =
            json.error?.data?.message ||
            json.error?.data?.debug ||
            json.error?.message ||
            "RPC error";
        throw new Error(msg);
    }
    return json.result;
}

/**
 * Open `reportUrl` in a tab/window. If `popupWindow` was pre-opened in the
 * user-gesture click handler we just redirect it (popup-blocker friendly);
 * otherwise we fall back to a synthetic <a target="_blank"> click.
 */
function _kitchenOpenPdf(reportUrl, popupWindow = null) {
    console.log("[pos_kitchen_screen_odoo] opening PDF:", reportUrl);
    if (popupWindow && !popupWindow.closed) {
        try {
            popupWindow.location.href = reportUrl;
            return;
        } catch (e) {
            console.warn("[pos_kitchen_screen_odoo] popup redirect failed", e);
        }
    }
    const link = document.createElement("a");
    link.href = reportUrl;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

patch(ControlButtons.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.dialog = useService("dialog");
    },

    _kitchenGetOrder() {
        const pos = this.pos || this.env.pos;
        return pos?.get_order?.() || pos?.getOrder?.() || pos?.selectedOrder || null;
    },

    _kitchenOrderHasLines(order) {
        const lines = this._kitchenGetRawLines(order);
        return lines.some((l) => (l.qty ?? l.get_quantity?.() ?? l.quantity ?? 0) > 0);
    },

    async _kitchenSyncCurrentOrder(order) {
        const pos = this.pos || this.env.pos;
        if (typeof pos.syncAllOrders === "function") {
            try {
                await pos.syncAllOrders({ orders: [order] });
                return;
            } catch (e) {
                await pos.syncAllOrders();
                return;
            }
        }
        if (typeof pos.push_orders === "function") {
            await pos.push_orders(order);
        }
    },

    _kitchenGetRawLines(order) {
        if (!order) {
            return [];
        }
        if (Array.isArray(order.lines) && order.lines.length) {
            return order.lines;
        }
        if (order.orderlines?.models && Array.isArray(order.orderlines.models)) {
            return order.orderlines.models;
        }
        if (typeof order.getOrderlines === "function") {
            const result = order.getOrderlines() || [];
            return Array.isArray(result) ? result : Array.from(result);
        }
        if (typeof order.get_orderlines === "function") {
            const result = order.get_orderlines() || [];
            return Array.isArray(result) ? result : Array.from(result);
        }
        if (Array.isArray(order.orderlines)) {
            return order.orderlines;
        }
        if (order.orderlines?.records) {
            return order.orderlines.records;
        }
        if (Array.isArray(order.lines)) {
            return order.lines;
        }
        return [];
    },

    _kitchenExtractOrderlines(order) {
        const rawLines = this._kitchenGetRawLines(order);
        return rawLines
            .map((line) => {
                const qty =
                    (typeof line.get_quantity === "function" && line.get_quantity()) ??
                    line.qty ??
                    line.quantity ??
                    0;
                if (!qty) {
                    return null;
                }
                const productName =
                    (typeof line.get_full_product_name === "function" &&
                        line.get_full_product_name()) ||
                    line.full_product_name ||
                    line.product_id?.display_name ||
                    line.product_id?.name ||
                    line.product?.display_name ||
                    line.product?.name ||
                    "";
                const unitPrice =
                    (typeof line.get_unit_price === "function" && line.get_unit_price()) ??
                    line.price_unit ??
                    0;
                const priceSubtotal =
                    (typeof line.get_price_with_tax === "function" &&
                        line.get_price_with_tax()) ??
                    line.price_subtotal_incl ??
                    line.price_subtotal ??
                    qty * unitPrice;
                const note =
                    (typeof line.get_note === "function" && line.get_note()) ||
                    line.customer_note ||
                    line.note ||
                    line.order_note ||
                    line.product_note ||
                    "";
                console.log("[pos_kitchen_screen_odoo] line note debug:", {
                    productName,
                    note,
                    has_get_note: typeof line.get_note === "function",
                    customer_note: line.customer_note,
                    note_field: line.note,
                    order_note: line.order_note,
                    product_note: line.product_note,
                    line_keys: Object.keys(line || {}),
                });

                return {
                    product_name: productName,
                    productName: productName,
                    qty: qty,
                    quantity: qty,
                    price: unitPrice,
                    price_unit: unitPrice,
                    price_subtotal: priceSubtotal,
                    price_display: priceSubtotal,
                    note: note,
                    customer_note: note,
                };
            })
            .filter(Boolean);
    },

    _showKitchenPrintFallbackDialog(order) {
        // ---- Capture EVERYTHING the confirm/cancel handlers will need
        // ---- BEFORE the dialog opens. After the user clicks "Continue"
        // ---- the parent screen may unmount this component, in which
        // ---- case `this`, `this.orm`, `this.pos`, etc. are unsafe.
        const pos = this.pos || this.env.pos;
        const posReference =
            order?.pos_reference || order?.name || order?.uuid || "";
        const configId = pos?.config?.id;

        // The orm proxy returned by `useService("orm")` is wrapped to abort
        // pending calls when the owning component is destroyed, which is
        // exactly the bug we're fixing. Hold the *raw* env-level service so
        // calls survive component destruction. `window.odoo.__DEBUG__` is a
        // last-resort fallback for production builds where it's exposed.
        const rawOrm =
            this.env?.services?.orm ||
            window.odoo?.__DEBUG__?.services?.orm ||
            null;

        // Notification + dialog services are app-level singletons, so they
        // survive component teardown — but capture them anyway so we don't
        // touch `this` after the dialog closes.
        const notification = this.env?.services?.notification || this.notification;

        // Bound retry that we still need a live `this` for. We'll guard the
        // call so a destroyed-component error doesn't bubble.
        const retryPrint = () => this._kitchenTriggerPrint(order, { isRetry: true });

        this.dialog.add(ConfirmationDialog, {
            title: _t("Printing failed"),
            body: _t(
                "The kitchen ticket could not be printed. Click Continue to open the KOT PDF in a new tab, or Retry to try printing again."
            ),
            confirmLabel: _t("Continue"),
            cancelLabel: _t("Retry"),
            confirm: async () => {
                console.log(
                    "[pos_kitchen_screen_odoo] Continue clicked — fetching PDF",
                    { posReference, configId }
                );

                if (!posReference || !configId) {
                    console.error(
                        "[pos_kitchen_screen_odoo] missing order ref or config id",
                        { posReference, configId }
                    );
                    try {
                        notification.add(
                            _t("Cannot generate KOT PDF: missing order reference."),
                            { type: "danger" }
                        );
                    } catch (e) {
                        console.warn("[pos_kitchen_screen_odoo] notify failed", e);
                    }
                    return;
                }

                // Open the popup SYNCHRONOUSLY inside the user-gesture click
                // handler so the browser's popup blocker accepts it. Do NOT
                // pass "noopener" — that forces window.open() to return null
                // and we can't redirect it later.
                const popupWindow = window.open("about:blank", "_blank");

                let reportUrl = null;
                try {
                    // 1) Try the raw env ORM service first. It's not bound
                    //    to a component lifecycle so it should survive even
                    //    if ControlButtons unmounted while the dialog was up.
                    if (rawOrm && typeof rawOrm.call === "function") {
                        try {
                            reportUrl = await rawOrm.call(
                                "pos.order",
                                "get_kot_pdf_report_url",
                                [posReference, configId]
                            );
                            console.log(
                                "[pos_kitchen_screen_odoo] env.services.orm returned URL:",
                                reportUrl
                            );
                        } catch (ormError) {
                            console.warn(
                                "[pos_kitchen_screen_odoo] env.services.orm.call failed, falling back to raw fetch",
                                ormError
                            );
                        }
                    }

                    // 2) Fallback: raw JSON-RPC fetch — completely
                    //    independent of any component / service lifecycle.
                    if (!reportUrl) {
                        reportUrl = await _kitchenCallKw(
                            "pos.order",
                            "get_kot_pdf_report_url",
                            [posReference, configId]
                        );
                        console.log(
                            "[pos_kitchen_screen_odoo] raw fetch returned URL:",
                            reportUrl
                        );
                    }

                    if (!reportUrl) {
                        if (popupWindow && !popupWindow.closed) {
                            popupWindow.close();
                        }
                        throw new Error(_t("Could not generate KOT PDF."));
                    }

                    _kitchenOpenPdf(reportUrl, popupWindow);
                } catch (error) {
                    if (popupWindow && !popupWindow.closed) {
                        popupWindow.close();
                    }
                    console.error(
                        "[pos_kitchen_screen_odoo] KOT PDF fallback failed",
                        error
                    );
                    try {
                        notification.add(
                            _t(
                                "Failed to open KOT PDF: %s",
                                error?.data?.message || error?.message || ""
                            ),
                            { type: "danger" }
                        );
                    } catch (e) {
                        console.warn(
                            "[pos_kitchen_screen_odoo] notification.add failed",
                            e
                        );
                    }
                }
            },
            cancel: async () => {
                try {
                    await retryPrint();
                } catch (e) {
                    console.warn(
                        "[pos_kitchen_screen_odoo] retry print failed",
                        e
                    );
                }
            },
        });
    },

    async _kitchenTriggerPrint(order, { isRetry = false } = {}) {
        const pos = this.pos || this.env.pos;
        try {
            const proxy = pos?.hardwareProxy || pos?.proxy;
            const printer = proxy?.printer || proxy;

            const baseReceipt = order?.export_for_printing?.() || {};
            const orderlines = this._kitchenExtractOrderlines(order);
            const receipt = {
                ...baseReceipt,
                name: baseReceipt.name || order?.name || order?.pos_reference || "",
                orderlines: orderlines,
            };

            const hasPrinter =
                (printer && typeof printer.printReceipt === "function") ||
                (proxy && typeof proxy.print_receipt === "function");

            if (!hasPrinter) {
                console.warn(
                    "[pos_kitchen_screen_odoo] no printer detected, showing PDF fallback"
                );
                this._showKitchenPrintFallbackDialog(order);
                return;
            }

            let printResult = true;
            if (printer && typeof printer.printReceipt === "function") {
                printResult = await printer.printReceipt(receipt);
            } else if (proxy && typeof proxy.print_receipt === "function") {
                printResult = await proxy.print_receipt(receipt);
            }

            const ok =
                printResult === true ||
                printResult?.successful === true ||
                printResult?.result === true;

            if (!ok && !isRetry) {
                this._showKitchenPrintFallbackDialog(order);
            } else if (!ok && isRetry) {
                this.notification.add(_t("Printing failed again."), { type: "danger" });
            }
        } catch (e) {
            console.warn("[pos_kitchen_screen_odoo] print trigger failed", e);
            if (isRetry) {
                this.notification.add(_t("Printing failed again."), { type: "danger" });
                return;
            }
            this._showKitchenPrintFallbackDialog(order);
        }
    },

    async sendToKitchenScreen() {
        const pos = this.pos || this.env.pos;
        const order = this._kitchenGetOrder();
        if (!order) {
            this.notification.add(_t("No active order."), { type: "warning" });
            return;
        }
        if (!this._kitchenOrderHasLines(order)) {
            this.notification.add(_t("Add at least one product before sending to kitchen."), {
                type: "warning",
            });
            return;
        }

        try {
            await this._kitchenSyncCurrentOrder(order);

            const posReference =
                order.pos_reference || order.name || order.uuid || "";
            const tableId =
                order.table_id?.id ||
                order.getTable?.()?.id ||
                order.table?.id ||
                false;
            const sessionId =
                order.session_id?.id ||
                pos.session?.id ||
                pos.pos_session?.id ||
                false;

            const ok = await this.orm.call("pos.order", "process_order_for_kitchen", [
                {
                    pos_reference: posReference,
                    config_id: pos.config.id,
                    table_id: tableId,
                    session_id: sessionId,
                },
            ]);

            if (ok) {
                this.notification.add(_t("Order sent to the kitchen screen."), {
                    type: "success",
                });
                await this._kitchenTriggerPrint(order);
            } else {
                this.notification.add(
                    _t(
                        "Order saved but no kitchen station accepted it. " +
                        "Configure one in Point of Sale → Kitchen Screen → Configuration."
                    ),
                    { type: "warning" }
                );
            }
        } catch (error) {
            console.error("[pos_kitchen_screen_odoo] sendToKitchenScreen failed", error);
            this.notification.add(
                _t(
                    "Failed to send order to kitchen: %s",
                    error?.data?.message || error?.message || ""
                ),
                { type: "danger" }
            );
        }
    },
});
