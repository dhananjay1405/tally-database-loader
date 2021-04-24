create table config
(
 name nvarchar(64) not null primary key,
 value nvarchar(1024)
);

create table mst_group
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default '',
 primary_group nvarchar(1024) not null default '',
 is_revenue tinyint,
 is_deemedpositive tinyint,
 is_reserved tinyint,
 sort_position int
);

create table mst_ledger
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default '',
 is_revenue tinyint,
 is_deemedpositive tinyint,
 opening_balance decimal(17,2) default 0,
 description nvarchar(256) not null default '',
 mailing_name nvarchar(256) not null default '',
 mailing_address nvarchar(1024) not null default '',
 mailing_state nvarchar(256) not null default '',
 mailing_country nvarchar(256) not null default '',
 mailing_pincode nvarchar(64) not null default '',
 it_pan nvarchar(64) not null default '',
 gstn nvarchar(64) not null default '',
 gst_registration_type nvarchar(64) not null default '',
 gst_supply_type nvarchar(64) not null default '',
 gst_duty_head nvarchar(16) not null default '',
 tax_rate decimal(9,4) default 0
);

create table mst_vouchertype
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default '',
 is_deemedpositive tinyint,
 affects_stock tinyint
);

create table mst_uom
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 formalname nvarchar(256) not null default '',
 is_simple_unit tinyint not null,
 base_units nvarchar(1024) not null,
 additional_units nvarchar(1024) not null,
 conversion int not null
);

create table mst_godown
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default '',
 address nvarchar(1024) not null default ''
);

create table mst_stock_group
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default ''
);

create table mst_stock_item
(
 guid char(64) not null primary key,
 name nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default '',
 uom nvarchar(1024) not null default '',
 opening_balance decimal(15,4) default 0,
 opening_value decimal(17,2) default 0,
 gst_nature_of_goods nvarchar(1024) default '',
 gst_hsn_code nvarchar(64) default '',
 gst_taxability nvarchar(1024) default ''
);

create table trn_voucher
(
 guid char(64) not null primary key,
 date date not null,
 voucher_type nvarchar(1024) not null,
 voucher_number nvarchar(64) not null default '',
 narration nvarchar(4000) not null default '',
 is_invoice tinyint,
 is_accounting_voucher tinyint,
 is_inventory_voucher tinyint,
 is_order_voucher tinyint
);

create table trn_accounting
(
 guid char(64) not null,
 ledger nvarchar(1024) not null default '',
 amount decimal(17,2) not null default 0
);

create table trn_inventory
(
 guid char(64) not null,
 item nvarchar(1024) not null default '',
 quantity decimal(15,4) not null default 0,
 amount decimal(17,2) not null default 0,
 additional_amount decimal(17,2) not null default 0,
 discount_amount decimal(17,2) not null default 0,
 godown nvarchar(1024),
 tracking_number nvarchar(1024)
);

create table trn_closingstock_ledger
(
 ledger nvarchar(1024) not null default '',
 parent nvarchar(1024) not null default '',
 stock_date datetime,
 stock_value decimal(17,2) not null default 0
);
