create table tallydb.config
(
 name string(64) not null,
 value string(1024)
);

create table tallydb.mst_group
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 parent string(1024) not null,
 _parent string(64) not null,
 primary_group string(1024) not null,
 is_revenue tinyint,
 is_deemedpositive tinyint,
 is_reserved tinyint,
 affects_gross_profit tinyint,
 sort_position int
);

create table tallydb.mst_ledger
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null ,
 parent string(1024) not null ,
 _parent string(64) not null,
 alias string(256) not null,
 is_revenue tinyint,
 is_deemedpositive tinyint,
 opening_balance decimal(17,2),
 description string(256) not null ,
 mailing_name string(256) not null ,
 mailing_address string(1024) not null ,
 mailing_state string(256) not null ,
 mailing_country string(256) not null ,
 mailing_pincode string(64) not null ,
 email string(256) not null ,
 it_pan string(64) not null ,
 gstn string(64) not null ,
 gst_registration_type string(64) not null ,
 gst_supply_type string(64) not null ,
 gst_duty_head string(16) not null ,
 tax_rate decimal(9,4),
 bank_account_holder string(256) not null ,
 bank_account_number string(64) not null ,
 bank_ifsc string(64) not null ,
 bank_swift string(64) not null ,
 bank_name string(64) not null ,
 bank_branch string(64) not null 
);

create table tallydb.mst_vouchertype
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 parent string(1024) not null,
 _parent string(64) not null,
 numbering_method string(64) not null,
 is_deemedpositive tinyint,
 affects_stock tinyint
);

create table tallydb.mst_uom
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 formalname string(256) not null,
 is_simple_unit tinyint not null,
 base_units string(1024) not null,
 additional_units string(1024) not null,
 conversion int not null
);

create table tallydb.mst_godown
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 parent string(1024) not null,
 _parent string(64) not null,
 address string(1024) not null
);

create table tallydb.mst_stock_group
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 parent string(1024) not null,
 _parent string(64) not null
);

create table tallydb.mst_stock_item
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 parent string(1024) not null,
 _parent string(64) not null,
 alias string(256) not null,
 uom string(1024) not null,
 _uom string(64) not null,
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 gst_nature_of_goods string(1024),
 gst_hsn_code string(64),
 gst_taxability string(1024)
);

create table tallydb.mst_cost_category
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 allocate_revenue tinyint,
 allocate_non_revenue tinyint
);

create table tallydb.mst_cost_centre
(
 guid string(64) not null,
 alterid int not null,
 name string(1024) not null,
 parent string(1024) not null,
 _parent string(64) not null,
 category string(1024) not null
);

create table tallydb.mst_gst_effective_rate
(
 item string(1024) not null,
 _item string(64) not null,
 applicable_from date,
 hsn_description string(256) not null,
 hsn_code string(64) not null,
 rate decimal(17,2) not null,
 is_rcm_applicable tinyint,
 nature_of_transaction string(64) not null,
 nature_of_goods string(64) not null,
 supply_type string(64) not null,
 taxability string(64) not null
);

create table tallydb.mst_opening_batch_allocation
(
 item string(1024) not null,
 _item string(64) not null,
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 godown string(1024) not null,
 _godown string(64) not null,
 manufactured_on date
);

create table tallydb.mst_opening_bill_allocation
(
 ledger string(1024) not null,
 _ledger string(64) not null,
 opening_balance decimal(17,4),
 bill_date date,
 name string(1024) not null
);

create table tallydb.trn_closingstock_ledger
(
 ledger string(1024) not null,
 _ledger string(64) not null,
 stock_date date,
 stock_value decimal(17,2) not null
);

create table tallydb.trn_voucher
(
 guid string(64) not null,
 alterid int not null,
 date date not null,
 voucher_type string(1024) not null,
 _voucher_type string(64) not null,
 voucher_number string(64) not null,
 reference_number string(64) not null,
 reference_date date,
 narration string(4000) not null,
 party_name string(256) not null,
 _party_name string(64) not null,
 place_of_supply string(256) not null,
 is_invoice tinyint,
 is_accounting_voucher tinyint,
 is_inventory_voucher tinyint,
 is_order_voucher tinyint
);

create table tallydb.trn_accounting
(
 guid string(64) not null,
 ledger string(1024) not null,
 _ledger string(64) not null,
 amount decimal(17,2) not null,
 amount_forex decimal(17,2) not null,
 currency string(16) not null
);

create table tallydb.trn_inventory
(
 guid string(64) not null,
 item string(1024) not null,
 _item string(64) not null,
 quantity decimal(15,4) not null,
 rate decimal(15,4) not null,
 amount decimal(17,2) not null,
 additional_amount decimal(17,2) not null,
 discount_amount decimal(17,2) not null,
 godown string(1024),
 _godown string(64) not null,
 tracking_number string(256),
 order_number string(256),
 order_duedate date
);

create table tallydb.trn_cost_centre
(
 guid string(64) not null,
 ledger string(1024) not null,
 _ledger string(64) not null,
 costcentre string(1024) not null,
 _costcentre string(64) not null,
 amount decimal(17,2) not null
);

create table tallydb.trn_bill
(
 guid string(64) not null,
 ledger string(1024) not null,
 _ledger string(64) not null,
 name string(1024) not null,
 amount decimal(17,2) not null,
 billtype string(256) not null
);

create table tallydb.trn_batch
(
 guid string(64) not null,
 item string(1024) not null,
 _item string(64) not null,
 name string(1024) not null,
 quantity decimal(15,4) not null,
 amount decimal(17,2) not null,
 godown string(1024),
 _godown string(64) not null,
 destination_godown string(1024),
 _destination_godown string(64) not null,
 tracking_number string(1024)
);
