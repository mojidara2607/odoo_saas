/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";
import { useService } from "@web/core/utils/hooks";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";

patch(ActionpadWidget.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
    },

    async submitOrder() {
        if (this.uiState.clicked) {
            return;
        }
        this.uiState.clicked = true;
        try {
            const currentOrder = this.env.pos?.get_order?.() || this.env.pos?.getOrder?.();
            if (!currentOrder?.pos_reference) {
                await super.submitOrder(...arguments);
                return;
            }

            const isAllowed = await this.orm.call(
                "pos.order",
                "check_order_status",
                ["", currentOrder.pos_reference]
            );
            if (!isAllowed) {
                this.env.services.dialog.add(AlertDialog, {
                    title: _t("Order is Completed"),
                    body: _t("This order is already completed. Please create a new order."),
                });
                return;
            }

            await super.submitOrder(...arguments);
            await this.processOrderForKitchen(currentOrder);
            this.env.bus.trigger("pos-kitchen-screen-update");
        } finally {
            this.uiState.clicked = false;
        }
    },

    async processOrderForKitchen(order) {
        const orderData = {
            pos_reference: order.pos_reference,
            config_id: order.config_id?.id || order.config_id || this.env.pos.config.id,
            table_id: order.table_id?.id || order.table_id || false,
            session_id:
                order.session_id?.id || order.session_id || this.env.pos.pos_session?.id || false,
        };
        await this.orm.call("pos.order", "process_order_for_kitchen", [orderData]);
    },
});
