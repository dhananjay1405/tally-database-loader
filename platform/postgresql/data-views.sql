/* Sales View */
create view vw_sales as
select
    v.date,
    v.voucher_number,
    v.voucher_type,
    t.parent voucher_category,
    v.party_name,
    p.parent party_parent,
    a.ledger,
    a.amount
from trn_accounting a
join trn_voucher v on v.guid = a.guid
join mst_vouchertype t on v.voucher_type = t.name
join mst_ledger l on a.ledger = l.name
join mst_group g on l.parent = g.name
join mst_ledger p on v.party_name = p.name
where t.parent in ('Sales', 'Credit Note') and g.primary_group in ('Sales Accounts')
;



/* Purchase View */
create view vw_purchase as
select
    v.date,
    v.voucher_number,
    v.voucher_type,
    t.parent voucher_category,
    v.party_name,
    p.parent party_parent,
    a.ledger,
    a.amount
from trn_accounting a
join trn_voucher v on v.guid = a.guid
join mst_vouchertype t on v.voucher_type = t.name
join mst_ledger l on a.ledger = l.name
join mst_group g on l.parent = g.name
join mst_ledger p on v.party_name = p.name
where t.parent in ('Purchase', 'Debit Note') and g.primary_group in ('Purchase Accounts')