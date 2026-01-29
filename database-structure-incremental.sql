create table _diff
(
 guid varchar(64) not null,
 alterid int
);

create table _delete
(
 guid varchar(64) not null
);

create table _vchnumber
(
 guid varchar(64) not null,
 voucher_number varchar(256)
);

create table config
(
 name nvarchar(64) not null primary key,
 value nvarchar(1024)
);

create table mst_group
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 primary_group nvarchar(1024),
 is_revenue tinyint,
 is_deemedpositive tinyint,
 is_reserved tinyint,
 affects_gross_profit tinyint,
 sort_position int
);

create table mst_ledger
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 alias nvarchar(256),
 description nvarchar(64),
 notes nvarchar(64),
 is_revenue tinyint,
 is_deemedpositive tinyint,
 opening_balance decimal(17,2),
 closing_balance decimal(17,2),
 mailing_name nvarchar(256),
 mailing_address nvarchar(1024),
 mailing_state nvarchar(256),
 mailing_country nvarchar(256),
 mailing_pincode nvarchar(64),
 email nvarchar(256),
 mobile nvarchar(32),
 it_pan nvarchar(64),
 gstn nvarchar(64),
 gst_registration_type nvarchar(64),
 gst_supply_type nvarchar(64),
 gst_duty_head nvarchar(16),
 tax_rate decimal(9,4),
 bank_account_holder nvarchar(256),
 bank_account_number nvarchar(64),
 bank_ifsc nvarchar(64),
 bank_swift nvarchar(64),
 bank_name nvarchar(64),
 bank_branch nvarchar(64),
 bill_credit_period int
);

create table mst_vouchertype
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 numbering_method nvarchar(64),
 is_deemedpositive tinyint,
 affects_stock tinyint
);

create table mst_uom
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 formalname nvarchar(256),
 is_simple_unit tinyint,
 base_units nvarchar(1024),
 additional_units nvarchar(1024),
 conversion decimal(15,4)
);

create table mst_godown
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 address nvarchar(1024)
);

create table mst_stock_category
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64)
);

create table mst_stock_group
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64)
);

create table mst_stock_item
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 category nvarchar(1024),
 _category varchar(64),
 alias nvarchar(256),
 description nvarchar(64),
 notes nvarchar(64),
 part_number nvarchar(256),
 uom nvarchar(32),
 _uom varchar(64),
 alternate_uom nvarchar(32),
 _alternate_uom varchar(64),
 conversion decimal(15,4),
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 closing_balance decimal(15,4),
 closing_rate decimal(15,4),
 closing_value decimal(17,2),
 costing_method nvarchar(32),
 gst_type_of_supply nvarchar(32),
 gst_hsn_code nvarchar(64),
 gst_hsn_description nvarchar(256),
 gst_rate decimal(9,4),
 gst_taxability nvarchar(32)
);

create table mst_cost_category
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 allocate_revenue tinyint,
 allocate_non_revenue tinyint
);

create table mst_cost_centre
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 category nvarchar(1024)
);

create table mst_attendance_type
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 uom nvarchar(32),
 _uom varchar(64),
 attendance_type nvarchar(64),
 attendance_period nvarchar(64)
);

create table mst_employee
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 id_number nvarchar(256),
 date_of_joining date,
 date_of_release date,
 designation nvarchar(64),
 function_role nvarchar(64),
 location nvarchar(256),
 gender nvarchar(32),
 date_of_birth date,
 blood_group nvarchar(32),
 father_mother_name nvarchar(256),
 spouse_name nvarchar(256),
 address nvarchar(256),
 mobile nvarchar(32),
 email nvarchar(64),
 pan nvarchar(32),
 aadhar nvarchar(32),
 uan nvarchar(32),
 pf_number nvarchar(32),
 pf_joining_date date,
 pf_relieving_date date,
 pr_account_number nvarchar(32)
);

create table mst_payhead
(
 guid varchar(64) not null primary key,
 alterid int,
 name nvarchar(1024),
 parent nvarchar(1024),
 _parent varchar(64),
 payslip_name nvarchar(1024),
 pay_type nvarchar(64),
 income_type nvarchar(64),
 calculation_type nvarchar(32),
 leave_type nvarchar(64),
 calculation_period nvarchar(32)
);

create table mst_gst_effective_rate
(
 item nvarchar(1024),
 _item varchar(64),
 applicable_from date,
 hsn_description nvarchar(256),
 hsn_code nvarchar(64),
 duty_head nvarchar(64),
 rate decimal(9,4),
 rate_per_unit decimal(9,4),
 valuation_type nvarchar(64),
 is_rcm_applicable tinyint,
 nature_of_transaction nvarchar(64),
 nature_of_goods nvarchar(64),
 supply_type nvarchar(64),
 taxability nvarchar(64)
);

create table mst_opening_batch_allocation
(
 name nvarchar(1024),
 item nvarchar(1024),
 _item varchar(64),
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 godown nvarchar(1024),
 _godown varchar(64),
 manufactured_on date
);

create table mst_opening_bill_allocation
(
 ledger nvarchar(1024),
 _ledger varchar(64),
 opening_balance decimal(17,4),
 bill_date date,
 name nvarchar(1024),
 bill_credit_period int,
 is_advance tinyint
);

create table trn_closingstock_ledger
(
 ledger nvarchar(1024),
 _ledger varchar(64),
 stock_date date,
 stock_value decimal(17,2)
);

create table mst_stockitem_standard_cost
(
 item nvarchar(1024),
 _item varchar(64),
 date date,
 rate decimal(15,4)
);

create table mst_stockitem_standard_price
(
 item nvarchar(1024),
 _item varchar(64),
 date date,
 rate decimal(15,4)
);

create table trn_voucher
(
 guid varchar(64) not null primary key,
 alterid int,
 date date,
 voucher_type nvarchar(1024),
 _voucher_type varchar(64),
 voucher_number nvarchar(64),
 reference_number nvarchar(64),
 reference_date date,
 narration nvarchar(4000),
 party_name nvarchar(256),
 _party_name varchar(64),
 place_of_supply nvarchar(256),
 is_invoice tinyint,
 is_accounting_voucher tinyint,
 is_inventory_voucher tinyint,
 is_order_voucher tinyint
);

create table trn_accounting
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 amount decimal(17,2),
 amount_forex decimal(17,2),
 currency nvarchar(16)
);

create table trn_inventory
(
 guid varchar(64),
 item nvarchar(1024),
 _item varchar(64),
 quantity decimal(15,4),
 rate decimal(15,4),
 amount decimal(17,2),
 additional_amount decimal(17,2),
 discount_amount decimal(17,2),
 godown nvarchar(1024),
 _godown varchar(64),
 tracking_number nvarchar(256),
 order_number nvarchar(256),
 order_duedate date
);

create table trn_cost_centre
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 costcentre nvarchar(1024),
 _costcentre varchar(64),
 amount decimal(17,2)
);

create table trn_cost_category_centre
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 costcategory nvarchar(1024),
 _costcategory varchar(64),
 costcentre nvarchar(1024),
 _costcentre varchar(64),
 amount decimal(17,2)
);

create table trn_cost_inventory_category_centre
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 item nvarchar(1024),
 _item varchar(64),
 costcategory nvarchar(1024),
 _costcategory varchar(64),
 costcentre nvarchar(1024),
 _costcentre varchar(64),
 amount decimal(17,2)
);

create table trn_bill
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 name nvarchar(1024),
 amount decimal(17,2),
 billtype nvarchar(256),
 bill_credit_period int
);

create table trn_bank
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 transaction_type nvarchar(32),
 instrument_date date,
 instrument_number nvarchar(1024),
 bank_name nvarchar(64),
 amount decimal(17,2),
 bankers_date date
);

create table trn_batch
(
 guid varchar(64),
 item nvarchar(1024),
 _item varchar(64),
 name nvarchar(1024),
 quantity decimal(15,4),
 amount decimal(17,2),
 godown nvarchar(1024),
 _godown varchar(64),
 destination_godown nvarchar(1024),
 _destination_godown varchar(64),
 tracking_number nvarchar(1024)
);

create table trn_inventory_additional_cost
(
 guid varchar(64),
 ledger nvarchar(1024),
 _ledger varchar(64),
 amount decimal(17,2),
 additional_allocation_type nvarchar(32),
 rate_of_invoice_tax decimal(9,4)
);

create table trn_employee
(
 guid varchar(64),
 category nvarchar(1024),
 _category varchar(64),
 employee_name nvarchar(1024),
 _employee_name varchar(64),
 amount decimal(17,2),
 employee_sort_order int
);

create table trn_payhead
(
 guid varchar(64),
 category nvarchar(1024),
 _category varchar(64),
 employee_name nvarchar(1024),
 _employee_name varchar(64),
 employee_sort_order int,
 payhead_name nvarchar(1024),
 _payhead_name varchar(64),
 payhead_sort_order int,
 amount decimal(17,2)
);

create table trn_attendance
(
 guid varchar(64),
 employee_name nvarchar(1024),
 _employee_name varchar(64),
 attendancetype_name nvarchar(1024),
 _attendancetype_name varchar(64),
 time_value decimal(17,2),
 type_value decimal(17,2)
);