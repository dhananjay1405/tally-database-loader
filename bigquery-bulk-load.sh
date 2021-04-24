# bulk loading of compressed CSV files into bigquery schema
tbl=(mst_group mst_ledger mst_vouchertype mst_uom mst_godown mst_stock_group mst_stock_item trn_voucher trn_accounting trn_inventory trn_closingstock_ledger)
sch=(
    guid:STRING,name:STRING,parent:STRING,primary_group:STRING,is_revenue:BOOL,is_deemedpositive:BOOL,is_reserved:BOOL,sort_position:INT64
    guid:STRING,name:STRING,parent:STRING,is_revenue:BOOL,is_deemedpositive:BOOL,opening_balance:DECIMAL,description:STRING,mailing_name:STRING,mailing_address:STRING,mailing_state:STRING,mailing_country:STRING,mailing_pincode:STRING,it_pan:STRING,gstn:STRING,gst_registration_type:STRING,gst_supply_type:STRING,gst_duty_head:STRING,tax_rate:DECIMAL
    guid:STRING,name:STRING,parent:STRING,is_deemedpositive:BOOL,affects_stock:BOOL
    guid:STRING,name:STRING,formalname:STRING,is_simple_unit:STRING,base_units:STRING,additional_units:STRING,conversion:INT64
    guid:STRING,name:STRING,parent:STRING,address:STRING
    guid:STRING,name:STRING,parent:STRING
    guid:STRING,name:STRING,parent:STRING,uom:STRING,opening_balance:DECIMAL,opening_value:DECIMAL,gst_nature_of_goods:STRING,gst_hsn_code:STRING,gst_taxability:STRING
    guid:STRING,date:DATE,voucher_type:STRING,voucher_number:STRING,narration:STRING,is_invoice:BOOL,is_accounting_voucher:BOOL,is_inventory_voucher:BOOL,is_order_voucher:BOOL
    guid:STRING,ledger:STRING,amount:DECIMAL
    guid:STRING,item:STRING,quantity:DECIMAL,amount:DECIMAL,additional_amount:DECIMAL,discount_amount:DECIMAL,godown:STRING,tracking_number:STRING
    ledger:STRING,parent:STRING,stock_date:DATE,stock_value:DECIMAL
)
for i in ${!tbl[@]}
do
 echo "Loading table ${tbl[$i]}"
 bq load --source_format=CSV --skip_leading_rows=1 "tallydb.${tbl[$i]}" "gs://tallydb/${tbl[$i]}.csv" "${sch[$i]}"
done