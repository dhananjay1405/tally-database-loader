## Release History

**Version: 1.0.16 [21-Jun-2022]**<br>
Added:
* Field named *order_duedate* introduced in trn_inventory table

**Version: 1.0.15 [09-Jun-2022]**<br>
Added:
* Loading of Tally data directly into Google BigQuery dataset
* Field named *alias* introduced in few master tables. *order_number* field introduced in Inventory Transactions

Fixed:
* OpeningBalance (in quantity) was giving absolute value, now fixed
* SQL Server insert mode failed in few scenario if 1000+ records were added in single batch. Now batch is restricted to 1000 records

**Version: 1.0.14 [28-Feb-2022]**<br>
Fixed:
* Commandline config --tally-fromdate and --tally-todate was not effecting from/to date while sending export request to Tally, now corrected

**Version: 1.0.13 [21-Feb-2022]**<br>
Fixed:
* Due to undocumented breaking changes in Tally Prime 2.0.1 export functionality was affected, now restored with fresh code changes
* In few cases, utility was not getting list of open companies from Tally Prime properly, now fixed
* PostgreSQL SSL connection was being rejected for self-signed certificates, now fixed by setting ignore flag

**Version: 1.0.12 [20-Nov-2021]**<br>
Added:
* Support of Postgre SQL Database Server Server.
* SSL (Secured Socket Layer) database connections for secure exchange of data especially for cloud database (PostgreSQL / SQL Server).

Fixed:
* Use of single quotes in INSERT statement, string type values, instead of double quotes, to bring uniformity of SQL Statements across multiple RDBMS platforms.
* CSV folder was used as parking space for intermediate process in database import method. Now the folder is deleted once data is imported successfully into database.

**Version: 1.0.11 [07-Nov-2021]**<br>
Fixed:
* Introduced specific error message related to database and connectvity.
* Reduced repetation of call stack in error messages to once for improved error diagnostic.

**Version: 1.0.10 [10-Oct-2021]**<br>
Added:
* 2 new fields in **trn_voucher** table. Party field was added for easy determination of Sundry Debtor / Creditor in any transaction and optimized aggregation.

**Version: 1.0.9 [08-Aug-2021]**<br>
Added:
* 2 new fields of amount in forex and currency in **trn_accounting** table. For Indian currency transaction, this field amount will be same as amount field.

Fixed:
* Crashing of Tally in the case when compound unit of measurement was used. TDL extraction expression is fixed.
* Failure in fetching data from specific company, when target company name was specified in **config.json** . Mechanism was failing when company had special characters like dash, brackets in its name.
* Default date in SQL queries in demo report section, changed to FY 2020-21.

**Version: 1.0.8 [01-Jul-2021]**<br>
Added:
* Rate column in stock item and inventory transaction table
* Added 2 new tables for opening batch & bill allocation (useful when company is split and there are pending bills as on split date)
* Introduced compatibility for field containing **rate** type of data in Tally. YAML export configuration now supports type *rate*

**Version: 1.0.7 [23-Jun-2021]**<br>
Added:
* Table named mst_gst_effective_rate containing rate of GST applicable on different stock item on multiple dates
* Email and Bank details related fields into mst_ledger table
* Power BI template for importing CSV files into Power BI model, is made available

Fixed:
* Exporting date type fields with blank value from Tally was causing issue while import. So now empty date field will be treated as NULL for database. During CSV export, same fields will remain as blank
* UTF-8 BOM (Byte Order Mark) is emmited to CSV files, when choosing CSV export in config.json so Without BOM, any field containing Unicode value was not decoded properly by excel

**Version: 1.0.6 [11-Jun-2021]**<br>
Fixed:
* Parent nature field of Tally containing value Primary, is converted to value as blank string, by custom TDL expression in YAML. In few tables this expression was missing, which is now fixed

**Version: 1.0.5 [05-Jun-2021]**<br>
Added:
* YAML format tally tables & fields definition specification file **tally-export-config.yaml**, for easy expansion of User Defined Fields as utility now aims for easy export of fields created by TDL Developers customising Tally. TDL XML is created on-the-fly by reading this specification file.
* Timestamps in **import-log.txt** file, to know exactly when utility was run
* No of seconds it took for each table of Tally to export. This information might be helpful when user wants to skip any heavy tables of Tally from export, by removing it from **tally-export-config.yaml** specification file for quick export

Removed:
* XML folder containing specification of Tally tables and fields, as this XML is now automatically created on-the-fly. Also *table-info.json* file was removed, as **tally-export-config.yaml** already contains equivalent name of fields in database for corresponding Tally fields.
* In **config.json** file, **batch** mode of transaction export where we could specify it full or daily is removed, as whole logic is now revamped. Revamping of logic resulted in longer time to export data from Tally, but significant lower usage of RAM while export (as high RAM usage by Tally Prime was hindering other process in few cases)

Version: **1.0.4 [17-May-2021]**<br>
Added:
* Support for selecting specific company from which to export data (using Powershell script loop can be setup to automate this for multiple companies)
* Voucher Reference number field added
* 5 more tables added related to cost centre, bill reference, batch allocation

Version: **1.0.3 [24-Apr-2021]**<br>
Added:
* SQL Queries for generating reports in a folder named **reports**. Due to difference in SQL functions names and syntax nomenclature in MySQL and MS-SQL, query for same report is made available for both database technologies
* Option to simply generate CSV files dump and then exit utility, by setting **technology** as **csv** in **config.json**. This option is introduced with an aim of transferring these CSV dumps to PC when Database Server is not directly accessible via Network (LAN/Internet). Also, these files can be used for **Google BigQuery** schema tables loading for cloud-based reporting

Fixed:
* CSV file dump, adopted ISO date format of **YYYY-MM-DD** instead of YYYYMMDD for easy detection of dates by Database Server
* Database table **trn_voucher**  field **date** was erronously assigned *datetime* data type instead of *date* now fixed

Version: **1.0.2 [12-Apr-2021]**<br>
Added:
* A configuration option **batch** has been added to handle cases where export of large number transaction rows from Tally in a single HTTP request results in freezing of Tally (due to huge amount of RAM usage). So, assigning value **daily** to this settings exports transactions (or vouchers) data day-by-day into CSV file and then pushes it to Database at once.
* New fields of Tally related to GST (HSN Code, type of supply, etc) have been added in *stock item* table
* 3 more flag type of fields added to *voucher* table to determine if voucher is of type accounting / inventory / order. These fields speed-up SQL Query for calculating of closing balance as on date

Fixed:
* **port** and **server** settings for *Tally* section in the file **config.json** were not effected if default value was overriden. This issue is now fixed
* In **file** based loading mode, first row of CSV file containing header was even treated as data row. So modified that query to skip 1 row from top
* SQL Server does not accept text enclosed in *double quotes* in SQL query for row insert by default. Due to this *file* based bulk loading of data failed for MS SQL Server . So modified SQL query for MS SQL Server where *QUOTED_IDENTIFIER* flag is set to *OFF* before the SQL statement


Version: **1.0.1 [06-Apr-2021]**<br>
Added:
* Header column in CSV files is introduced for easy viewing of CSV files from Excel to know exact error. Also these files can easily be imported, if database server is in protected PC with no external access

Fixed:
* \\ character in text field generated invalid CSV files, interrupting database loading. Proper escaping of backslah is now fixed
* Character limit for PAN(10) & GST Number(15) field increased in **database-structure.sql** as older versions of Tally were found to be accepting extra characters
* Closing Stock values for **trn_closingstock_ledger** table were missing 0 if no amount was specified for corresponding date. So now fixed with 0 in amount
* Commandline process exits with code of 0 = Success / 1 = Error, so that any other dependent programs/scripts can utilise this exit code for troubleshooting


Version: **1.0.0 [26-Mar-2021]**<br>
* Utility released