## Frequently Asked Question

**Ques:** How to enable SQL Server connectivity via TCP/IP port for Microsoft SQL Server ?

**Ans:** Utility supports connection to MS SQL Server via TCP/IP port only. It does not support connecting through named instance like *PC-NAME\\SQLEXPRESS*. This setting can be enabled using below steps:

1. Launch **Computer Management** (just type it in Windows Search bar)
1. Open: Services and Applications > SQL Server Configuration Manager > SQL Server Network Configuration > Protocols for MSSQLSERVER > TCP/IP
![SQL Server Configuration Manager network settings](https://excelkida.com/image/github/sql-server-configuration-manager-setting.png)
1. Right Click and **Enable** it
1. Double Click (or right click and open Properties) to open TCP/IP Properties window
1. Goto IP Addresses tab > IPAll > and set
    * TCP Dynamic Ports = (blank) erase value from it
    * TCP Port = 1433<br>
![SQL Server Configuration Manager IP Address settings](https://excelkida.com/image/github/sql-server-configuration-manager-ipaddress-port-config.png)
1. Restart SQL Server: Task Manager > Services > MSSQLSERVER > right click > Restart<br>
![SQL Server Service restart](https://excelkida.com/image/github/task-manager-sql-server-service-restart.png)

**Ques:** I am getting an error as below, how can I resolve it
```
Error from database() at
SyntaxError: Bad control character in string literal in JSON at position xx
```

**Ans:** This error occurs when **config.json** file JSON structure breaks while modifying values in it. In such scenario, overwrite existing *config.json* file by re-extracting it from utility project zip file.

**Ques:** MySQL gives error *Loading local data is disabled; this must be enabled on both the client and server sides*

**Ans:** MySQL by default disables loading of local files. To enable it run below command
```sql
SET GLOBAL local_infile=1;
```
If running after this query you end up with message as below

*1227 (42000): Access denied; you need (at least one of) the SUPER or SYSTEM_VARIABLES_ADMIN privilege(s) for this operation*

then only option left is to change **loadmethod** to **insert** as your database administrator does not allow you to enable local_infile due to security concerns.



**Ques:** I am getting error as below. How to resolve it ?
```
Error from tally.postTallyXML() at
AggregateError [ECONNREFUSED]:
    at internalConnectMultiple (node:net:1117:18)
    at afterConnectMultiple (node:net:1684:7)
    at TCPConnectWrap.callbackTrampoline (node:internal/async_hooks:130:17)
ECONNREFUSED
```

**Ans:** This error occurs when utility is unable to communicate with Tally. Ensure below things:
* Tally must be running
* Ensure XML port of Tally is enabled and is properly set in config.json &gt; tally &gt; port

**Ques:** I am getting error as below. How to resolve it ?
```
Error from tally.importData() at
Cannot detect First/Last voucher date from company
```

**Ans:** This error occurs when no company in Tally is selected or active.
It even occurs when you specify incorrect company name in config.json &gt; tally &gt; company


**Ques:** I get following error for PostgreSQL connection. What could be the issue
```
Error from database.executePostgres() at 
error: no pg_hba.conf entry for host "0.0.0.0", user "postgres", database "tallydb", no encryption
```

**Ans:**
You need to set **ssl** to **true** in config.json &gt; database. Also ensure, that your user and database is added in hostssl line in **pg_hba.conf**