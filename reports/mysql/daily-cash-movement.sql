/*
  Daily Receipt and Payment (incl Contra)
*/
set
 @fromDate = '2020-04-01',
 @toDate = '2021-03-31';
with recursive tblDateList as
(
 select date(@fromDate) value
 union all
 select date_add(value, interval 1 day) from tblDateList where value < date(@toDate)
),
tblCashMovement as 
(
 select v.date,
 sum(case when a.amount < 0 then -a.amount else 0 end) receipt,
 sum(case when a.amount > 0 then a.amount else 0 end) payment
 from trn_accounting a
 join trn_voucher v on v.guid = a.guid
 join mst_ledger l on l.name = a.ledger
 join mst_group g on g.name = l.parent
 join mst_vouchertype t on t.name = v.voucher_type
 where g.primary_group = 'cash-in-hand' and t.parent in ('receipt', 'payment', 'contra')
 group by v.date
)
select d.value date, ifnull(c.receipt, 0) receipt, ifnull(c.payment, 0) payment
from tblDateList d
left join tblCashMovement c on d.value = c.date
;