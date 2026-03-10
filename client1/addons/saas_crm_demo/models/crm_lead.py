# -*- coding: utf-8 -*-
# ============================================================
# CRM Lead Extension - Adds "Company Code" field
# ============================================================
# In Odoo, we "inherit" existing models to add new fields.
# This is like extending a class in Python.
# We're adding a new field to the existing CRM Lead model.
# ============================================================

from odoo import models, fields


class CrmLead(models.Model):
    # _inherit means we're extending the existing 'crm.lead' model
    # (we're NOT creating a new model, just adding to the existing one)
    _inherit = 'crm.lead'

    # New field: Company Code
    # This will appear in the CRM Lead form
    # Each tenant can set their own code (e.g., "ACME-001", "BETA-001")
    company_code = fields.Char(
        string='Company Code',           # Label shown in the UI
        help='Unique code for this tenant/company. '
             'Used to demonstrate data isolation in SaaS setup.',
        size=50,                          # Maximum 50 characters
        tracking=True,                    # Log changes in the chatter
    )

    # New field: Tenant Name
    # Extra field to make the demo more visual
    tenant_name = fields.Char(
        string='Tenant Name',
        help='Name of the tenant/company this lead belongs to.',
        size=100,
    )
