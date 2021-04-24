set
 @fromDate = '2014-04-01',
 @toDate = '2015-03-31';
with recursive tblDateList as
(
 select date(@fromDate) value
 union all
 select date_add(value, interval 1 day) from tblDateList where value < date(@toDate)
),
tblDailySales as 
(
 select v.date,
 sum(a.amount) amount
 from trn_accounting a
 join trn_voucher v on v.guid = a.guid
 join mst_ledger l on l.name = a.ledger
 join mst_group g on g.name = l.parent
 where g.primary_group = 'Purchase Accounts' and v.date >= @fromDate and v.date <= @toDate
 group by v.date
)
select d.value date, ifnull(-c.amount, 0) amount
from tblDateList d
left join tblDailySales c on d.value = c.date
;