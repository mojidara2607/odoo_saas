{
    'name': 'POS Receipt Designer Pro',
    'version': '19.0.2.0.0',
    'category': 'Sales/Point of Sale',
    'summary': 'Compact thermal-style POS customer receipt layout',
    'description': """
POS Receipt Designer Pro
========================
Redesigns the default Point of Sale customer receipt into a compact,
professional thermal-receipt style layout. Features:

- Narrow monospace layout mimicking real thermal paper
- Compact header with centered receipt title, reference, and date
- Table-style item rows with column headers
- Structured totals section with clear separators
- Prominent total line with double borders
- Professional thank-you footer
- Tighter vertical spacing throughout
- Print-optimized styling
    """,
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['point_of_sale'],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_receipt_designer_pro/static/src/**/*',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
}
