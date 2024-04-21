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


**Ques:** MySQL gives error *Loading local data is disabled; this must be enabled on both the client and server sides*

**Ans:** MySQL by default disables loading of local files. To enable it run below command
```sql
SET GLOBAL local_infile=1;
```
