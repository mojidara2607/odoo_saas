# -*- coding: utf-8 -*-
# ============================================================
# SaaS CRM Demo Module
# ============================================================
# This module adds a "Company Code" field to CRM Leads.
# It helps demonstrate that each client (tenant) has
# completely isolated data in this multi-tenant setup.
#
# HOW TO INSTALL:
#   1. Go to Apps menu in Odoo
#   2. Click "Update Apps List"
#   3. Search for "SaaS CRM Demo"
#   4. Click Install
# ============================================================

{
    'name': 'SaaS CRM Demo',
    'version': '17.0.1.0.0',
    'summary': 'Adds Company Code field to CRM leads for SaaS demo',
    'description': """
        Multi-Tenant SaaS Demo Module
        ==============================
        This module demonstrates data isolation in a multi-tenant
        Odoo SaaS setup by adding a "Company Code" field to CRM leads.

        Each client/tenant can set their own company code,
        proving that databases are completely separate.
    """,
    'author': 'SaaS Demo Team',
    'category': 'Sales/CRM',
    'depends': ['crm'],              # This module needs CRM to be installed first
    'data': [
        'views/crm_lead_views.xml',  # Our custom view modifications
    ],
    'installable': True,             # Can be installed
    'auto_install': False,           # Won't install automatically
    'application': False,            # Not a standalone app
    'license': 'LGPL-3',
}
