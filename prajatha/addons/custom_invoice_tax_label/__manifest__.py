{
    'name': 'Custom Invoice Tax Label',
    'version': '19.0.1.0.0',
    'summary': 'Force customer invoice PDF title to "Tax Invoice" for both Preview and Print',
    'description': """
Replaces the title shown on the Customer Invoice PDF (account.report_invoice_document
and its proforma/preview variant) so that, for move_type = 'out_invoice', it always
renders as "Tax Invoice <name>" regardless of state (draft, posted, cancel) and
regardless of whether the report is printed or previewed (proforma).
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
