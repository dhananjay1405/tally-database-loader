/*  Post Import Script : Opening Transactions
    SQL for treating opening balance as a transaction to speed-up calculation
*/
insert into trn_voucher(guid,date,voucher_type,is_invoice,is_accounting_voucher,is_order_voucher) values('00000000-0000-0000-0000-000000000000-00000001','1999-12-31','opening balance',0,1,0);

insert into trn_accounting(guid,ledger,amount)
select
	'00000000-0000-0000-0000-000000000000-00000001' 'guid',
    l.name,
    l.opening_balance
from mst_ledger l
where l.opening_balance <> 0
;