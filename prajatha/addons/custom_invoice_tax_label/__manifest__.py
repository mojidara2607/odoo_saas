{
    'name': 'Custom Invoice Tax Label',
    'version': '19.0.1.2.0',
    'summary': 'Force "Tax Invoice" title and DDMMYY dates on the customer-invoice PDF (vanilla + GCC compatible)',
    'description': """
Replaces the title on the Customer Invoice PDF with "Tax Invoice" and renders
Invoice Date / Due Date in DDMMYY format (e.g. 120526 for 12 May 2026).

Works on both vanilla Odoo 19 and Odoo 19 with l10n_gcc_invoice installed:
* The XML override uses surgical xpaths that preserve the <t name="..."> anchors
  GCC's primary view depends on, so installation no longer fails with
  "Element '<t name=\"invoice_title\">' cannot be located in parent view".
* The Python override of account.move._l10n_gcc_get_invoice_title forces the
  GCC bilingual title to "Tax Invoice" as well; on a system without
  l10n_gcc_invoice the method is unused and harmless, so this module does NOT
  depend on l10n_gcc_invoice.
    """,
    'author': 'Custom',
    'category': 'Accounting/Accounting',
    'depends': ['account'],
    'data': [
        'views/report_invoice_templates.xml',
    ],
    'license': 'LGPL-3',
    'installable': True,
    'application': False,
    'auto_install': False,
}
