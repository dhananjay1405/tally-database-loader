set
 @fromDate = '2020-04-01',
 @toDate = '2021-03-31';
with tblop as
(
 select a.ledger ledger, sum(a.amount) amount
 from trn_accounting a
 join trn_voucher v on v.guid = a.guid
 join mst_ledger l on a.ledger = l.name
 where v.is_accounting_voucher = 1 and l.is_revenue = 0 and v.date < @fromDate
 group by a.ledger
),
tblcurr as
(
 select a.ledger ledger,
 sum(case when a.amount < 0 then abs(a.amount) else 0 end) debit,
 sum(case when a.amount > 0 then a.amount else 0 end) credit
 from trn_accounting a
 join trn_voucher v on v.guid = a.guid
 where v.is_accounting_voucher = 1 and v.date between @fromDate and @toDate 
 group by a.ledger
)
select l.name, l.parent,
(l.opening_balance + ifnull(op.amount,0)) opening,
ifnull(curr.debit,0) debit,
ifnull(curr.credit,0) credit,
(l.opening_balance + ifnull(op.amount,0) + ifnull(curr.credit,0) - ifnull(curr.debit,0)) closing
from mst_ledger l
left join tblop op on op.ledger = l.name
left join tblcurr curr on curr.ledger = l.name
order by l.name
;