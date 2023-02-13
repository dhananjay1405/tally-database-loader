# Data Structure

## Background
Tally has in-house database system, which cannot be accessed using standard RDBMS drivers. It has a hierarchical structure database, where-in few fields are of type table. So as a result, it has table-inside-table structure. Popular RDBMS (Relational DataBase Management System) Server like SQL Server, MySQL, etc does not support hierarchy structure data. So, the utility breaks down data from hierarchy to tabular structure, where tables can be relationally linked to each other.
<br><br>

## Concept of GUID in Tally
Every database system requires primary key, i.e. a field which holds unique value serving as signature to identify that row. Each table in Tally has a field named GUID (Globally Unique IDentifer), which is primary key. It contains a 40 digit text value separated by hyphen. This GUID is used to reference that row in other related tables.
<br><br>

## Tally vs Utility Data Structure
Tally has 2 types of data in table / sub-table (i.e a table inside a field value)
* Master
* Transaction

Tally Developer contains in details schema / structure of various tables of tally along with field of those tables

In the utility, Master tables have been prefixed with **mst** and Transaction tables with **trn** .

Utility splits inferred data from Tally into 2 category of tables
* Primary
* Derived

**Primary**: These are physical tables of Tally Database

**Derived**: These are logical tables derived from Tally Database tables, which resides internally as sub-table inside few fields of primary table. Utility derives them by merging these tables of each row into single table. Certain filter might also be applied while merging this.
<br><br>

## Primary tables of Tally
Below is the mapping of few Primary table of Tally with corresponding table in Utility

| Tally | Utility |
| --- | --- |
| Group | mst_group |
| Ledger | mst_ledger |
| Voucher Type | mst_vouchertype |
| Unit | mst_uom |
| Godown | mst_godown |
| Stock Group | mst_stock_group |
| Stock Item | mst_stock_item |
| Cost Category | mst_cost_category |
| Cost Centre | mst_cost_centre |
| Voucher | trn_voucher |
<br><br>

## Transaction data structure in utility
Tally has primary table named **Voucher**, which utility captures in trn_voucher. This table contains header information of any voucher like Date, Voucher Type, Voucher Number etc. From Voucher, below mentiond tables are derived

```
trn_voucher
    |——— trn_accounting
        |——— trn_cost_centre
        |——— trn_bill
    |———  trn_inventory
        |——— trn_batch
```

**trn_accounting**: Accounting effects of any voucher (if any) are captured in this table. It has separate row for every debit &amp; credit to ledger of single voucher linked by GUID of voucher from *trn_voucher* table. In case of multiple debit / credit, more than 2 rows would be found.

Amount field contains debit / credit as below
| Amount | Sign |
| --- | --- |
| negative | Debit |
| positive | Credit |

**trn_inventory**: Inventory effects of any voucher (if any) are captured in this table. For every inward / outward effect of individual stock item in voucher, row is found in this table linked to GUID of voucher from *trn_voucher* table.

Quantity fields denotes inward / outward movement as below
| Quantity | Sign |
| --- | --- |
| negative | Outward |
| positive | Inward |

**trn_bill**: This table contains bill-wise breakup of purchase/sale invoice or receipt/payment.

**trn_cost_centre**: This table contains cost centre wise breakup for individual debit/credit effect of voucher.

**trn_batch**: This table contains godown-wise breakup for individual inward/outward effect of voucher.

<br><br>


## Relationship
All the tables are related to each other with **one-to-many** relationship. The relationship is not enforced into database, as it hampers bulk data loading into database server. Also, Tally itself takes care of enforcing relationship internally. So, below table can be used for defining relationship required by BI tools like Power BI, Tableau, etc. It is represented into format **table(field)**
|One|Many|
|---|---|
|mst_group(name)|mst_ledger(parent)|
|mst_ledger(name)|mst_opening_bill_allocation(ledger)|
|mst_ledger(name)|trn_closingstock_ledger(ledger)|
|mst_ledger(name)|trn_accounting(ledger)|
|mst_ledger(name)|trn_cost_centre(ledger)|
|mst_ledger(name)|trn_bill(ledger)|
|mst_vouchertype(name)|trn_voucher(voucher_type)|
|mst_uom(name)|mst_stock_item(uom)|
|mst_godown(name)|mst_opening_batch_allocation(godown)|
|mst_godown(name)|trn_inventory(godown)|
|mst_godown(name)|trn_batch(godown)|
|mst_godown(name)|trn_batch(destination_godown)|
|mst_stock_group(name)|mst_stock_item(parent)|
|mst_stock_item(name)|mst_gst_effective_rate(item)|
|mst_stock_item(name)|mst_opening_batch_allocation(item)|
|mst_stock_item(name)|trn_inventory(item)|
|mst_stock_item(name)|trn_batch(item)|
|mst_cost_category(name)|mst_cost_centre(parent)|
|mst_cost_centre(name)|trn_cost_centre(costcentre)|
|trn_voucher(guid)|trn_accounting(guid)|
|trn_voucher(guid)|trn_inventory(guid)|
|trn_voucher(guid)|trn_cost_centre(guid)|
|trn_voucher(guid)|trn_bill(guid)|
|trn_voucher(guid)|trn_batch(guid)|



## Closing Balance
Tally does not create any voucher entry for the closing stock. Instead, it stores declared value of closing stock on respective date, in table **Ledger** in a field named **Ledger Closing Values** which holds table inside it.









