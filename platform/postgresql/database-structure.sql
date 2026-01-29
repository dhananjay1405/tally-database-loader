create table config
(
 name varchar(64) not null primary key,
 value varchar(1024)
);

create table mst_group
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 primary_group varchar(1024),
 is_revenue smallint,
 is_deemedpositive smallint,
 is_reserved smallint,
 affects_gross_profit smallint,
 sort_position int
);

create table mst_ledger
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 alias varchar(256),
 description varchar(64),
 notes varchar(64),
 is_revenue smallint,
 is_deemedpositive smallint,
 opening_balance decimal(17,2),
 closing_balance decimal(17,2),
 mailing_name varchar(256),
 mailing_address varchar(1024),
 mailing_state varchar(256),
 mailing_country varchar(256),
 mailing_pincode varchar(64),
 email varchar(256),
 mobile varchar(32),
 it_pan varchar(64),
 gstn varchar(64),
 gst_registration_type varchar(64),
 gst_supply_type varchar(64),
 gst_duty_head varchar(16),
 tax_rate decimal(9,4),
 bank_account_holder varchar(256),
 bank_account_number varchar(64),
 bank_ifsc varchar(64),
 bank_swift varchar(64),
 bank_name varchar(64),
 bank_branch varchar(64),
 bill_credit_period int
);

create table mst_vouchertype
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 numbering_method varchar(64),
 is_deemedpositive smallint,
 affects_stock smallint
);

create table mst_uom
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 formalname varchar(256),
 is_simple_unit smallint,
 base_units varchar(1024),
 additional_units varchar(1024),
 conversion decimal(15,4)
);

create table mst_godown
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 address varchar(1024)
);

create table mst_stock_category
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024)
);

create table mst_stock_group
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024)
);

create table mst_stock_item
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 category varchar(1024),
 alias varchar(256),
 description varchar(64),
 notes varchar(64),
 part_number varchar(256),
 uom varchar(32),
 alternate_uom varchar(32),
 conversion decimal(15,4),
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 closing_balance decimal(15,4),
 closing_rate decimal(15,4),
 closing_value decimal(17,2),
 costing_method varchar(32),
 gst_type_of_supply varchar(32),
 gst_hsn_code varchar(64),
 gst_hsn_description varchar(256),
 gst_rate decimal(9,4),
 gst_taxability varchar(32)
);

create table mst_cost_category
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 allocate_revenue smallint,
 allocate_non_revenue smallint
);

create table mst_cost_centre
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 category varchar(1024)
);

create table mst_attendance_type
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 uom varchar(32),
 attendance_type varchar(64),
 attendance_period varchar(64)
);

create table mst_employee
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 id_number varchar(256),
 date_of_joining date,
 date_of_release date,
 designation varchar(64),
 function_role varchar(64),
 location varchar(256),
 gender varchar(32),
 date_of_birth date,
 blood_group varchar(32),
 father_mother_name varchar(256),
 spouse_name varchar(256),
 address varchar(256),
 mobile varchar(32),
 email varchar(64),
 pan varchar(32),
 aadhar varchar(32),
 uan varchar(32),
 pf_number varchar(32),
 pf_joining_date date,
 pf_relieving_date date,
 pr_account_number varchar(32)
);

create table mst_payhead
(
 guid varchar(64) not null primary key,
 name varchar(1024),
 parent varchar(1024),
 payslip_name varchar(1024),
 pay_type varchar(64),
 income_type varchar(64),
 calculation_type varchar(32),
 leave_type varchar(64),
 calculation_period varchar(32)
);

create table mst_gst_effective_rate
(
 item varchar(1024),
 applicable_from date,
 hsn_description varchar(256),
 hsn_code varchar(64),
 duty_head varchar(64),
 rate decimal(9,4),
 rate_per_unit decimal(9,4),
 valuation_type varchar(64),
 is_rcm_applicable smallint,
 nature_of_transaction varchar(64),
 nature_of_goods varchar(64),
 supply_type varchar(64),
 taxability varchar(64)
);

create table mst_opening_batch_allocation
(
 name varchar(1024),
 item varchar(1024),
 opening_balance decimal(15,4),
 opening_rate decimal(15,4),
 opening_value decimal(17,2),
 godown varchar(1024),
 manufactured_on date
);

create table mst_opening_bill_allocation
(
 ledger varchar(1024),
 opening_balance decimal(17,4),
 bill_date date,
 name varchar(1024),
 bill_credit_period int,
 is_advance smallint
);

create table trn_closingstock_ledger
(
 ledger varchar(1024),
 stock_date date,
 stock_value decimal(17,2)
);

create table mst_stockitem_standard_cost
(
 item varchar(1024),
 date date,
 rate decimal(15,4)
);

create table mst_stockitem_standard_price
(
 item varchar(1024),
 date date,
 rate decimal(15,4)
);

create table trn_voucher
(
 guid varchar(64) not null primary key,
 date date,
 voucher_type varchar(1024),
 voucher_number varchar(64),
 reference_number varchar(64),
 reference_date date,
 narration varchar(4000),
 party_name varchar(256),
 place_of_supply varchar(256),
 is_invoice smallint,
 is_accounting_voucher smallint,
 is_inventory_voucher smallint,
 is_order_voucher smallint
);

create table trn_accounting
(
 guid varchar(64),
 ledger varchar(1024),
 amount decimal(17,2),
 amount_forex decimal(17,2),
 currency varchar(16)
);

create table trn_inventory
(
 guid varchar(64),
 item varchar(1024),
 quantity decimal(15,4),
 rate decimal(15,4),
 amount decimal(17,2),
 additional_amount decimal(17,2),
 discount_amount decimal(17,2),
 godown varchar(1024),
 tracking_number varchar(256),
 order_number varchar(256),
 order_duedate date
);

create table trn_cost_centre
(
 guid varchar(64),
 ledger varchar(1024),
 costcentre varchar(1024),
 amount decimal(17,2)
);

create table trn_cost_category_centre
(
 guid varchar(64),
 ledger varchar(1024),
 costcategory varchar(1024),
 costcentre varchar(1024),
 amount decimal(17,2)
);

create table trn_cost_inventory_category_centre
(
 guid varchar(64),
 ledger varchar(1024),
 item varchar(1024),
 costcategory varchar(1024),
 costcentre varchar(1024),
 amount decimal(17,2)
);

create table trn_bill
(
 guid varchar(64),
 ledger varchar(1024),
 name varchar(1024),
 amount decimal(17,2),
 billtype varchar(256),
 bill_credit_period int
);

create table trn_bank
(
 guid varchar(64),
 ledger varchar(1024),
 transaction_type varchar(32),
 instrument_date date,
 instrument_number varchar(1024),
 bank_name varchar(64),
 amount decimal(17,2),
 bankers_date date
);

create table trn_batch
(
 guid varchar(64),
 item varchar(1024),
 name varchar(1024),
 quantity decimal(15,4),
 amount decimal(17,2),
 godown varchar(1024),
 destination_godown varchar(1024),
 tracking_number varchar(1024)
);

create table trn_inventory_additional_cost
(
 guid varchar(64),
 ledger varchar(1024),
 amount decimal(17,2),
 additional_allocation_type varchar(32),
 rate_of_invoice_tax decimal(9,4)
);

create table trn_employee
(
 guid varchar(64),
 category varchar(1024),
 employee_name varchar(1024),
 amount decimal(17,2),
 employee_sort_order int
);

create table trn_payhead
(
 guid varchar(64),
 category varchar(1024),
 employee_name varchar(1024),
 employee_sort_order int,
 payhead_name varchar(1024),
 payhead_sort_order int,
 amount decimal(17,2)
);

create table trn_attendance
(
 guid varchar(64),
 employee_name varchar(1024),
 attendancetype_name varchar(1024),
 time_value decimal(17,2),
 type_value decimal(17,2)
);