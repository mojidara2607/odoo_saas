import logging

from odoo import models
from odoo.tools import float_is_zero

_logger = logging.getLogger(__name__)


class PurchaseOrder(models.Model):
    _inherit = "purchase.order"

    def _recompute_average_cost_from_purchase_lines(self, purchase_lines):
        purchase_lines = purchase_lines.sudo().filtered("product_id")
        if not purchase_lines:
            return

        PurchaseOrderLine = self.env["purchase.order.line"].sudo()
        processed_pairs = set()

        for line in purchase_lines:
            product = line.product_id
            company = line.order_id.company_id
            pair_key = (product.id, company.id)
            if pair_key in processed_pairs:
                continue
            processed_pairs.add(pair_key)

            matching_lines = PurchaseOrderLine.search(
                [
                    ("product_id", "=", product.id),
                    ("order_id.state", "in", ["purchase", "done"]),
                    ("order_id.company_id", "=", company.id),
                ]
            )
            if not matching_lines:
                _logger.debug(
                    "Skipping average cost update for product %s in company %s because no confirmed purchase lines were found.",
                    product.display_name,
                    company.display_name,
                )
                continue

            avg_price = sum(matching_lines.mapped("price_unit")) / len(matching_lines)
            company_product = product.with_company(company).sudo()
            if float_is_zero(
                avg_price - company_product.standard_price,
                precision_rounding=0.000001,
            ):
                continue

            _logger.info(
                "Updating average cost for product %s in company %s from %s to %s based on %s purchase lines.",
                product.display_name,
                company.display_name,
                company_product.standard_price,
                avg_price,
                len(matching_lines),
            )

            company_product.write({"standard_price": avg_price})
            company_product.product_tmpl_id.with_company(company).sudo().write(
                {"standard_price": avg_price}
            )

    def button_confirm(self):
        res = super().button_confirm()
        self._recompute_average_cost_from_purchase_lines(self.mapped("order_line"))
        return res


class PurchaseOrderLine(models.Model):
    _inherit = "purchase.order.line"

    def write(self, vals):
        relevant_lines = self.env["purchase.order.line"]
        if "price_unit" in vals:
            relevant_lines = self.filtered(
                lambda line: line.product_id and line.order_id.state in ("purchase", "done")
            )

        res = super().write(vals)

        if relevant_lines:
            relevant_lines.order_id._recompute_average_cost_from_purchase_lines(
                relevant_lines
            )

        return res
