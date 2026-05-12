from odoo import models


class AccountMove(models.Model):
    _inherit = "account.move"

    def _l10n_gcc_get_invoice_title(self):
        """Force the customer-invoice title to "Tax Invoice" on the GCC report.

        On a system with ``l10n_gcc_invoice`` installed, the GCC primary report
        (``l10n_gcc_invoice.l10n_gcc_report_invoice_document``) renders the
        result of this method instead of the base ``<t name="invoice_title">``
        when this method returns a truthy value. We always return "Tax Invoice"
        for customer invoices so the GCC path matches the non-GCC path that
        our XML override already sets.

        On a system WITHOUT ``l10n_gcc_invoice``, this method is unused (no
        view calls it) and therefore harmless – which is why we can define it
        unconditionally without adding ``l10n_gcc_invoice`` to ``depends``.
        """
        self.ensure_one()
        if self.move_type == "out_invoice":
            return "Tax Invoice"
        parent = getattr(super(), "_l10n_gcc_get_invoice_title", None)
        return parent() if parent else ""
