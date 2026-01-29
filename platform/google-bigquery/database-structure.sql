create table tallydb.config
(
 name string not null primary key not enforced,
 value string
);

create table tallydb.mst_group
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 primary_group string,
 is_revenue tinyint,
 is_deemedpositive tinyint,
 is_reserved tinyint,
 affects_gross_profit tinyint,
 sort_position int
);

create table tallydb.mst_ledger
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 alias string,
 description string,
 notes string,
 is_revenue tinyint,
 is_deemedpositive tinyint,
 opening_balance decimal,
 closing_balance decimal,
 mailing_name string,
 mailing_address string,
 mailing_state string,
 mailing_country string,
 mailing_pincode string,
 email string,
 mobile string,
 it_pan string,
 gstn string,
 gst_registration_type string,
 gst_supply_type string,
 gst_duty_head string,
 tax_rate decimal,
 bank_account_holder string,
 bank_account_number string,
 bank_ifsc string,
 bank_swift string,
 bank_name string,
 bank_branch string,
 bill_credit_period int
);

create table tallydb.mst_vouchertype
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 numbering_method string,
 is_deemedpositive tinyint,
 affects_stock tinyint
);

create table tallydb.mst_uom
(
 guid string not null primary key not enforced,
 name string,
 formalname string,
 is_simple_unit tinyint,
 base_units string,
 additional_units string,
 conversion decimal
);

create table tallydb.mst_godown
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 address string
);

create table tallydb.mst_stock_category
(
 guid string not null primary key not enforced,
 name string,
 parent string
);

create table tallydb.mst_stock_group
(
 guid string not null primary key not enforced,
 name string,
 parent string
);

create table tallydb.mst_stock_item
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 category string,
 alias string,
 description string,
 notes string,
 part_number string,
 uom string,
 alternate_uom string,
 conversion decimal,
 opening_balance decimal,
 opening_rate decimal,
 opening_value decimal,
 closing_balance decimal,
 closing_rate decimal,
 closing_value decimal,
 costing_method string,
 gst_type_of_supply string,
 gst_hsn_code string,
 gst_hsn_description string,
 gst_rate decimal,
 gst_taxability string
);

create table tallydb.mst_cost_category
(
 guid string not null primary key not enforced,
 name string,
 allocate_revenue tinyint,
 allocate_non_revenue tinyint
);

create table tallydb.mst_cost_centre
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 category string
);

create table tallydb.mst_attendance_type
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 uom string,
 attendance_type string,
 attendance_period string
);

create table tallydb.mst_employee
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 id_number string,
 date_of_joining date,
 date_of_release date,
 designation string,
 function_role string,
 location string,
 gender string,
 date_of_birth date,
 blood_group string,
 father_mother_name string,
 spouse_name string,
 address string,
 mobile string,
 email string,
 pan string,
 aadhar string,
 uan string,
 pf_number string,
 pf_joining_date date,
 pf_relieving_date date,
 pr_account_number string
);

create table tallydb.mst_payhead
(
 guid string not null primary key not enforced,
 name string,
 parent string,
 payslip_name string,
 pay_type string,
 income_type string,
 calculation_type string,
 leave_type string,
 calculation_period string
);

create table tallydb.mst_gst_effective_rate
(
 item string,
 applicable_from date,
 hsn_description string,
 hsn_code string,
 duty_head string,
 rate decimal,
 rate_per_unit decimal,
 valuation_type string,
 is_rcm_applicable tinyint,
 nature_of_transaction string,
 nature_of_goods string,
 supply_type string,
 taxability string
);

create table tallydb.mst_opening_batch_allocation
(
 name string,
 item string,
 opening_balance decimal,
 opening_rate decimal,
 opening_value decimal,
 godown string,
 manufactured_on date
);

create table tallydb.mst_opening_bill_allocation
(
 ledger string,
 opening_balance decimal,
 bill_date date,
 name string,
 bill_credit_period int,
 is_advance tinyint
);

create table tallydb.trn_closingstock_ledger
(
 ledger string,
 stock_date date,
 stock_value decimal
);

create table tallydb.mst_stockitem_standard_cost
(
 item string,
 date date,
 rate decimal
);

create table tallydb.mst_stockitem_standard_price
(
 item string,
 date date,
 rate decimal
);

create table tallydb.trn_voucher
(
 guid string not null primary key not enforced,
 date date,
 voucher_type string,
 voucher_number string,
 reference_number string,
 reference_date date,
 narration string,
 party_name string,
 place_of_supply string,
 is_invoice tinyint,
 is_accounting_voucher tinyint,
 is_inventory_voucher tinyint,
 is_order_voucher tinyint
);

create table tallydb.trn_accounting
(
 guid string,
 ledger string,
 amount decimal,
 amount_forex decimal,
 currency string
);

create table tallydb.trn_inventory
(
 guid string,
 item string,
 quantity decimal,
 rate decimal,
 amount decimal,
 additional_amount decimal,
 discount_amount decimal,
 godown string,
 tracking_number string,
 order_number string,
 order_duedate date
);

create table tallydb.trn_cost_centre
(
 guid string,
 ledger string,
 costcentre string,
 amount decimal
);

create table tallydb.trn_cost_category_centre
(
 guid string,
 ledger string,
 costcategory string,
 costcentre string,
 amount decimal
);

create table tallydb.trn_cost_inventory_category_centre
(
 guid string,
 ledger string,
 item string,
 costcategory string,
 costcentre string,
 amount decimal
);

create table tallydb.trn_bill
(
 guid string,
 ledger string,
 name string,
 amount decimal,
 billtype string,
 bill_credit_period int
);

create table tallydb.trn_bank
(
 guid string,
 ledger string,
 transaction_type string,
 instrument_date date,
 instrument_number string,
 bank_name string,
 amount decimal,
 bankers_date date
);

create table tallydb.trn_batch
(
 guid string,
 item string,
 name string,
 quantity decimal,
 amount decimal,
 godown string,
 destination_godown string,
 tracking_number string
);

create table tallydb.trn_inventory_additional_cost
(
 guid string,
 ledger string,
 amount decimal,
 additional_allocation_type string,
 rate_of_invoice_tax decimal
);

create table tallydb.trn_employee
(
 guid string,
 category string,
 employee_name string,
 amount decimal,
 employee_sort_order int
);

create table tallydb.trn_payhead
(
 guid string,
 category string,
 employee_name string,
 employee_sort_order int,
 payhead_name string,
 payhead_sort_order int,
 amount decimal
);

create table tallydb.trn_attendance
(
 guid string,
 employee_name string,
 attendancetype_name string,
 time_value decimal,
 type_value decimal
);