# -*- coding: utf-8 -*-
"""בונה את טבלת החישוב לחודש נתון מנתוני התיקייה האמיתיים."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from invoice_processing.accounting import (
    build_rows, compute, _month_title, HOME_UTILITY_RATE, HOME_UTILITY_FROM)
from invoice_processing.reporting.excel_summary import build_workbook

month = sys.argv[1]
rows, folder = build_rows(month)
t = compute(rows, month)
out = Path(folder) / f"טבלת חישוב {month}.xlsx"
build_workbook(rows, t, _month_title(month), out,
               home_rate=HOME_UTILITY_RATE, home_from=HOME_UTILITY_FROM)

print("OUT=" + str(out))
print(f"ROWS={len(rows)}")
print(f"INCOME net={t.income_net} vat={t.income_vat}")
print(f"EXPENSE net={t.expense_net} vat={t.expense_vat} novat={t.expense_no_vat}")
print(f"HOME full={t.home_full_total} net={t.home_net} vat={t.home_vat}")
print(f"PROFIT={t.profit}")
print(f"VAT_DUE={t.vat_due}")
print(f"FOREIGN={t.foreign}")
from collections import Counter
print("CATS=" + str(dict(Counter(r.category for r in rows))))
