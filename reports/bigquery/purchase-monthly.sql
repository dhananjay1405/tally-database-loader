with tblYearMonthList as
(
 select extract(year from dt) year, extract(month from dt) month
 from (select * from unnest(generate_date_array(parse_date('%d-%m-%Y', @fromDate), parse_date('%d-%m-%Y', @toDate), interval 1 month)) dt)
),
tblMonthlySales as 
(
 select extract(year from v.date) year, extract(month from v.date) month,
 sum(a.amount) amount
 from tallydb.trn_accounting a
 join tallydb.trn_voucher v on v.guid = a.guid
 join tallydb.mst_ledger l on l.name = a.ledger
 join tallydb.mst_group g on g.name = l.parent
 where g.primary_group = 'Purchase Accounts' and v.date >= parse_date('%d-%m-%Y', @fromDate) and v.date <= parse_date('%d-%m-%Y', @toDate)
 group by extract(year from v.date), extract(month from v.date)
)
select l.year year, l.month month, ifnull(-s.amount, 0) amount
from tblYearMonthList l
left join tblMonthlySales s on (l.year = s.year and l.month = s.month)
order by l.year, l.month
;