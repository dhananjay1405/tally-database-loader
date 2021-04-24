with tblDailySales as 
(
 select v.date,
 sum(a.amount) amount
 from tallydb.trn_accounting a
 join tallydb.trn_voucher v on v.guid = a.guid
 join tallydb.mst_ledger l on l.name = a.ledger
 join tallydb.mst_group g on g.name = l.parent
 where g.primary_group = 'Sales Accounts' and v.date >= parse_date('%d-%m-%Y', @fromDate) and v.date <= parse_date('%d-%m-%Y', @toDate)
 group by v.date
)
select d.dt date, ifnull(c.amount, 0) amount
from (select * from unnest(generate_date_array(parse_date('%d-%m-%Y', @fromDate), parse_date('%d-%m-%Y', @toDate), interval 1 day)) dt) d
left join tblDailySales c on d.dt = c.date
order by d.dt
;