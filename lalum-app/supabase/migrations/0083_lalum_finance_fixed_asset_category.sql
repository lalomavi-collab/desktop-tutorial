-- Finance: a tax category for fixed assets (equipment, furniture, building improvements). Their input VAT is recovered
-- when bought and their cost is depreciated, not expensed; the engine keeps them out of the period until the accountant
-- sets a depreciation rate. Only widens the allowed values of lalum_fin_expenses.tax_category; no row changes.
alter table public.lalum_fin_expenses drop constraint if exists lalum_fin_expenses_tax_category_check;
alter table public.lalum_fin_expenses add constraint lalum_fin_expenses_tax_category_check check (tax_category in (
  'OPERATIONAL_100','VEHICLE_MAINTENANCE','VEHICLE_EV_CHARGING','OFFICE_REFRESHMENTS','CLIENT_GIFTS','PROFESSIONAL_ATTIRE',
  'HOME_OFFICE','LOCAL_HOSPITALITY_NON_DEDUCTIBLE','FINES_NON_DEDUCTIBLE','MIXED_CUSTOM','FIXED_ASSET'));
