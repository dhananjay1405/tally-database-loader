/* Sales Register (input for PIVOT table) */

SELECT
  v.date,
  v.voucher_type,
  v.voucher_number,
  a.ledger,
  a.amount,
  v.party_name,
  p.gstn,
  g.primary_group,
  t.parent AS voucher_category
FROM tallydb.trn_accounting AS a
INNER JOIN tallydb.trn_voucher AS v ON a.guid = v.guid
INNER JOIN tallydb.mst_vouchertype AS t ON v.voucher_type = t.name
INNER JOIN tallydb.mst_ledger AS l ON a.ledger = l.name
INNER JOIN tallydb.mst_group AS g ON l.parent = g.name
INNER JOIN tallydb.mst_ledger AS p ON v.party_name = p.name
WHERE
  v.is_order_voucher = 0
  AND v.is_inventory_voucher = 0
  AND t.parent IN ('Sales', 'Credit Note')
  AND a.ledger <> v.party_name