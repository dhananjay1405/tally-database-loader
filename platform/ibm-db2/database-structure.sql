create table config
(
 name varchar(64) not null primary key,
 value varchar(1024)
);

create table mst_group
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null,
 primary_group varchar(1024) not null,
 is_revenue smallint,
 is_deemedpositive smallint,
 is_reserved smallint,
 affects_gross_profit smallint,
 sort_position int
);

create table mst_ledger
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null,
 alias varchar(256) not null,
 is_revenue smallint,
 is_deemedpositive smallint,
 opening_balance decimal(17,2),
 description varchar(256) not null,
 mailing_name varchar(256) not null,
 mailing_address varchar(1024) not null,
 mailing_state varchar(256) not null,
 mailing_country varchar(256) not null,
 mailing_pincode varchar(64) not null,
 email varchar(256) not null,
 it_pan varchar(64) not null,
 gstn varchar(64) not null,
 gst_registration_type varchar(64) not null,
 gst_supply_type varchar(64) not null,
 gst_duty_head varchar(16) not null,
 tax_rate decimal(9,4),
 bank_account_holder varchar(256) not null,
 bank_account_number varchar(64) not null,
 bank_ifsc varchar(64) not null,
 bank_swift varchar(64) not null,
 bank_name varchar(64) not null,
 bank_branch varchar(64) not null
);

create table mst_vouchertype
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null,
 numbering_method varchar(64) not null,
 is_deemedpositive smallint,
 affects_stock smallint
);

create table mst_uom
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 formalname varchar(256) not null,
 is_simple_unit smallint not null,
 base_units varchar(1024) not null,
 additional_units varchar(1024) not null,
 conversion int not null
);

create table mst_godown
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null,
 address varchar(1024) not null
);

create table mst_stock_group
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null
);

create table mst_stock_item
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null,
 alias varchar(256) not null,
 uom varchar(1024) not null,
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 gst_nature_of_goods varchar(1024),
 gst_hsn_code varchar(64),
 gst_taxability varchar(1024)
);

create table mst_cost_category
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 allocate_revenue smallint,
 allocate_non_revenue smallint
);

create table mst_cost_centre
(
 guid varchar(64) not null primary key,
 name varchar(1024) not null,
 parent varchar(1024) not null,
 category varchar(1024) not null
);

create table mst_gst_effective_rate
(
 item varchar(1024) not null,
 applicable_from date,
 hsn_description varchar(256) not null,
 hsn_code varchar(64) not null,
 rate decimal(17,2) not null,
 is_rcm_applicable smallint,
 nature_of_transaction varchar(64) not null,
 nature_of_goods varchar(64) not null,
 supply_type varchar(64) not null,
 taxability varchar(64) not null
);

create table mst_opening_batch_allocation
(
 item varchar(1024) not null,
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 godown varchar(1024) not null,
 manufactured_on date
);

create table mst_opening_bill_allocation
(
 ledger varchar(1024) not null,
 opening_balance decimal(17,4),
 bill_date date,
 name varchar(1024) not null
);

create table trn_closingstock_ledger
(
 ledger varchar(1024) not null,
 stock_date date,
 stock_value decimal(17,2) not null
);

create table trn_voucher
(
 guid varchar(64) not null primary key,
 date date not null,
 voucher_type varchar(1024) not null,
 voucher_number varchar(64) not null,
 reference_number varchar(64) not null,
 reference_date date,
 narration varchar(4000) not null,
 party_name varchar(256) not null,
 place_of_supply varchar(256) not null,
 is_invoice smallint,
 is_accounting_voucher smallint,
 is_inventory_voucher smallint,
 is_order_voucher smallint
);

create table trn_accounting
(
 guid varchar(64) not null,
 ledger varchar(1024) not null,
 amount decimal(17,2) not null,
 amount_forex decimal(17,2) not null,
 currency varchar(16) not null
);

create table trn_inventory
(
 guid varchar(64) not null,
 item varchar(1024) not null,
 quantity decimal(15,4) not null,
 rate decimal(15,4) not null,
 amount decimal(17,2) not null,
 additional_amount decimal(17,2) not null,
 discount_amount decimal(17,2) not null,
 godown varchar(1024),
 tracking_number varchar(256),
 order_number varchar(256),
 order_duedate date
);

create table trn_cost_centre
(
 guid varchar(64) not null,
 ledger varchar(1024) not null,
 costcentre varchar(1024) not null,
 amount decimal(17,2) not null
);

create table trn_bill
(
 guid varchar(64) not null,
 ledger varchar(1024) not null,
 name varchar(1024) not null,
 amount decimal(17,2) not null,
 billtype varchar(256) not null
);

create table trn_batch
(
 guid varchar(64) not null,
 item varchar(1024) not null,
 name varchar(1024) not null,
 quantity decimal(15,4) not null,
 amount decimal(17,2) not null,
 godown varchar(1024),
 destination_godown varchar(1024),
 tracking_number varchar(1024)
);
