# bulk loading of compressed CSV files into bigquery schema
database="tallydb"
bucket="tallydb"
tbl=(mst_group mst_ledger mst_vouchertype mst_uom mst_godown mst_stock_group mst_stock_item mst_cost_category mst_cost_centre mst_gst_effective_rate mst_opening_batch_allocation mst_opening_bill_allocation trn_closingstock_ledger trn_voucher trn_accounting trn_inventory trn_cost_centre trn_bill trn_batch)
sch=(
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING,primary_group:STRING,is_revenue:BOOL,is_deemedpositive:BOOL,is_reserved:BOOL,affects_gross_profit:BOOL,sort_position:INT64
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING,alias:STRING,is_revenue:BOOL,is_deemedpositive:BOOL,opening_balance:DECIMAL,description:STRING,mailing_name:STRING,mailing_address:STRING,mailing_state:STRING,mailing_country:STRING,mailing_pincode:STRING,email:STRING,it_pan:STRING,gstn:STRING,gst_registration_type:STRING,gst_supply_type:STRING,gst_duty_head:STRING,tax_rate:DECIMAL,bank_account_holder:STRING,bank_account_number:STRING,bank_ifsc:STRING,bank_swift:STRING,bank_name:STRING,bank_branch:STRING
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING,numbering_method:STRING,is_deemedpositive:BOOL,affects_stock:BOOL
    guid:STRING,alterid:INT64,name:STRING,formalname:STRING,is_simple_unit:BOOL,base_units:STRING,additional_units:STRING,conversion:INT64
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING,address:STRING
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING,alias:STRING,uom:STRING,_uom:STRING,opening_balance:DECIMAL,opening_rate:DECIMAL,opening_value:DECIMAL,gst_nature_of_goods:STRING,gst_hsn_code:STRING,gst_taxability:STRING
    guid:STRING,alterid:INT64,name:STRING,allocate_revenue:BOOL,allocate_non_revenue:BOOL
    guid:STRING,alterid:INT64,name:STRING,parent:STRING,_parent:STRING,category:STRING
    item:STRING,_item:STRING,applicable_from:DATE,hsn_description:STRING,hsn_code:STRING,rate:DECIMAL,is_rcm_applicable:BOOL,nature_of_transaction:STRING,nature_of_goods:STRING,supply_type:STRING,taxability:STRING
    item:STRING,_item:STRING,opening_balance:DECIMAL,opening_rate:DECIMAL,opening_value:DECIMAL,godown:STRING,_godown:STRING,manufactured_on:DATE
    ledger:STRING,_ledger:STRING,opening_balance:DECIMAL,bill_date:DATE
    ledger:STRING,_ledger:STRING,stock_date:DATE,stock_value:DECIMAL
    guid:STRING,alterid:INT64,date:DATE,voucher_type:STRING,_voucher_type:STRING,voucher_number:STRING,reference_number:STRING,reference_date:DATE,narration:STRING,party_name:STRING,_party_name:STRING,place_of_supply:STRING,is_invoice:BOOL,is_accounting_voucher:BOOL,is_inventory_voucher:BOOL,is_order_voucher:BOOL
    guid:STRING,ledger:STRING,_ledger:STRING,amount:DECIMAL,amount_forex:DECIMAL,currency:STRING
    guid:STRING,item:STRING,_item:STRING,quantity:DECIMAL,rate:DECIMAL,amount:DECIMAL,additional_amount:DECIMAL,discount_amount:DECIMAL,godown:STRING,_godown:STRING,tracking_number:STRING,order_number:STRING,order_duedate:DATE
    guid:STRING,ledger:STRING,_ledger:STRING,costcentre:STRING,_costcentre:STRING,amount:DECIMAL
    guid:STRING,ledger:STRING,_ledger:STRING,name:STRING,amount:DECIMAL,billtype:STRING
    guid:STRING,item:STRING,_item:STRING,name:STRING,quantity:DECIMAL,amount:DECIMAL,godown:STRING,_godown:STRING,destination_godown:STRING,_destination_godown:STRING,tracking_number:STRING
)
for i in ${!tbl[@]}
do
 echo "Loading table ${tbl[$i]}"
 bq load --source_format=CSV --skip_leading_rows=1 --replace "$database.${tbl[$i]}" "gs://$bucket/${tbl[$i]}.csv" "${sch[$i]}"
done