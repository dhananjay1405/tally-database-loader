create table config
(
 name nvarchar2(64) not null primary key,
 value nvarchar2(1024)
);

create table mst_group
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 primary_group nvarchar2(1024) default '' not null,
 is_revenue number(1),
 is_deemedpositive number(1),
 is_reserved number(1),
 sort_position number(8)
);

create table mst_ledger
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 alias nvarchar2(256) default '' not null,
 is_revenue number(1),
 is_deemedpositive number(1),
 opening_balance number(17,2) default 0,
 description nvarchar2(256) default '' not null,
 mailing_name nvarchar2(256) default '' not null,
 mailing_address nvarchar2(1024) default '' not null,
 mailing_state nvarchar2(256) default '' not null,
 mailing_country nvarchar2(256) default '' not null,
 mailing_pincode nvarchar2(64) default '' not null,
 email nvarchar2(256) default '' not null,
 it_pan nvarchar2(64) default '' not null,
 gstn nvarchar2(64) default '' not null,
 gst_registration_type nvarchar2(64) default '' not null,
 gst_supply_type nvarchar2(64) default '' not null,
 gst_duty_head nvarchar2(16) default '' not null,
 tax_rate number(9,4) default 0,
 bank_account_holder nvarchar2(256) default '' not null,
 bank_account_number nvarchar2(64) default '' not null,
 bank_ifsc nvarchar2(64) default '' not null,
 bank_swift nvarchar2(64) default '' not null,
 bank_name nvarchar2(64) default '' not null,
 bank_branch nvarchar2(64) default '' not null
);

create table mst_vouchertype
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 is_deemedpositive number(1),
 affects_stock number(1)
);

create table mst_uom
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 formalname nvarchar2(256) default '' not null,
 is_simple_unit number(1) not null,
 base_units nvarchar2(1024) not null,
 additional_units nvarchar2(1024) not null,
 conversion number(8) not null
);

create table mst_godown
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 address nvarchar2(1024) default '' not null
);

create table mst_stock_group
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null
);

create table mst_stock_item
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 alias nvarchar2(256) default '' not null,
 uom nvarchar2(1024) default '' not null,
 opening_balance number(15,4) default 0,
 opening_rate number(15,4) default 0,
 opening_value number(17,2) default 0,
 gst_type_of_supply nvarchar2(32) default '',
 gst_hsn_code nvarchar2(64) default '',
 gst_hsn_description nvarchar2(256) default '',
 gst_rate int default 0,
 gst_taxability nvarchar2(32) default ''
);

create table mst_cost_category
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 allocate_revenue number(1),
 allocate_non_revenue number(1)
);

create table mst_cost_centre
(
 guid varchar(64) not null primary key,
 name nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 category nvarchar2(1024) default '' not null
);

create table mst_gst_effective_rate
(
 item nvarchar2(1024) default '' not null,
 applicable_from date,
 hsn_description nvarchar2(256) default '' not null,
 hsn_code nvarchar2(64) default '' not null,
 rate number(17,2) default 0 not null,
 is_rcm_applicable number(1),
 nature_of_transaction nvarchar2(64) default '' not null,
 nature_of_goods nvarchar2(64) default '' not null,
 supply_type nvarchar2(64) default '' not null,
 taxability nvarchar2(64) default '' not null
);

create table mst_opening_batch_allocation
(
 item nvarchar2(1024) default '' not null,
 opening_balance number(15,4) default 0,
 opening_rate number(15,4) default 0,
 opening_value number(17,2) default 0,
 godown nvarchar2(1024) default '' not null,
 manufactured_on date
);

create table mst_opening_bill_allocation
(
 ledger nvarchar2(1024) default '' not null,
 opening_balance number(17,4) default 0,
 bill_date date
);

create table mst_stockitem_standard_cost
(
 item nvarchar2(1024) default '' not null,
 _item varchar(64) default '' not null,
 date date,
 rate decimal(15,4) default 0
);

create table mst_stockitem_standard_price
(
 item nvarchar2(1024) not null default '',
 _item varchar(64) not null default '',
 date date,
 rate decimal(15,4) default 0
);

create table trn_voucher
(
 guid varchar(64) not null primary key,
 "date" date not null,
 voucher_type nvarchar2(1024) not null,
 voucher_number nvarchar2(64) default '' not null,
 reference_number nvarchar2(64) default '' not null,
 narration nvarchar2(4000) default '' not null,
 party_name nvarchar2(256) not null,
 place_of_supply nvarchar2(256) not null,
 is_invoice number(1),
 is_accounting_voucher number(1),
 is_inventory_voucher number(1),
 is_order_voucher number(1)
);

create table trn_accounting
(
 guid varchar(64) not null,
 ledger nvarchar2(1024) default '' not null,
 amount number(17,2) default 0 not null,
 amount_forex number(17,2) default 0 not null,
 currency nvarchar2(16) default '' not null
);

create table trn_inventory
(
 guid varchar(64) not null,
 item nvarchar2(1024) default '' not null,
 quantity number(15,4) default 0 not null,
 rate number(15,4) default 0 not null,
 amount number(17,2) default 0 not null,
 additional_amount number(17,2) default 0 not null,
 discount_amount number(17,2) default 0 not null,
 godown nvarchar2(1024),
 tracking_number nvarchar2(256),
 order_number nvarchar2(256),
 order_duedate date
);

create table trn_cost_centre
(
 guid varchar(64) not null,
 ledger nvarchar2(1024) default '' not null,
 name nvarchar2(1024) default '' not null,
 amount number(17,2) default 0 not null
);

create table trn_bill
(
 guid varchar(64) not null,
 ledger nvarchar2(1024) default '' not null,
 name nvarchar2(1024) default '' not null,
 amount number(17,2) default 0 not null,
 billtype nvarchar2(256) default '' not null
);

create table trn_batch
(
 guid varchar(64) not null,
 item nvarchar2(1024) default '' not null,
 name nvarchar2(1024) default '' not null,
 quantity number(15,4) default 0 not null,
 amount number(17,2) default 0 not null,
 godown nvarchar2(1024),
 destination_godown nvarchar2(1024),
 tracking_number nvarchar2(1024)
);

create table trn_closingstock_ledger
(
 ledger nvarchar2(1024) default '' not null,
 parent nvarchar2(1024) default '' not null,
 stock_date date,
 stock_value number(17,2) default 0 not null
);
