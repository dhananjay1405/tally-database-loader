/* Account Statement */
set
 @ledger = 'Cash',
 @fromDate = '2014-04-01',
 @toDate = '2015-03-31';
with tblLedger as
(
 select v.guid, v.date, v.voucher_number, v.voucher_type, v.narration,
 (case when a.amount < 0 then -a.amount else 0 end) 'debit',
 (case when a.amount > 0 then a.amount else 0 end) 'credit'
 from trn_accounting a
 join trn_voucher v on v.guid = a.guid
 where a.ledger = @ledger and v.is_accounting_voucher = 1 and (v.date between @fromDate and @toDate)
 order by v.date
),
tblEntry as
(
 select v.guid, group_concat(distinct a.ledger order by a.amount) ledgers
 from trn_voucher v
 join trn_accounting a on (a.guid = v.guid and a.ledger <> @ledger)
 where v.guid in (select guid from tblLedger) and v.is_accounting_voucher = 1
 group by v.guid
)
select l.date, l.voucher_number, l.voucher_type, c.ledgers ledgers, l.debit, l.credit, l.narration
from tblLedger l
join tblEntry c on c.guid = l.guid
order by l.date
;