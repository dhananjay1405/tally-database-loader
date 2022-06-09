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

**Ques:** How to enable MySQL Server invalid authentication mode error ?

**Ans:** In MySQL 8.x new authentication method was introduce. Currently project's MySQL client driver does not support that method. So you will have to modify your MySQL Server settings to **Legacy Authentication Method**. For windows PC follow steps as below:
1. Run *MySQL Installer Community* and choose re-configure option
![MySQL Server Window reconfigure server](https://excelkida.com/image/github/mysql-installer-packages-screen.png)
1. Change method to *Legacy Authentication*
![MySQL Server Window authentication method](https://excelkida.com/image/github/mysql-installer-authentication-mode-screen.png)