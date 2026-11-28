-- Only live legacy variants; preserve their effective yes/no state, IDs, prices and order links.
UPDATE product_variants v
SET supplier_available=v.supplier_available AND COALESCE(v.stock,0)>0,
    stock_mode='availability',stock=NULL
FROM products p
WHERE v.product_id=p.id AND p.launch_archived_at IS NULL
  AND v.supplier_retired_at IS NULL AND v.stock_mode='quantity';
