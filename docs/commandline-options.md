## Commandline Options
Utility is completely driven by configuration specified in **config.json** file. In case if specific configuration(s) needs to be overriden without changing it in config file, it can be done using commandline switches as follows:

```bat
node ./dist/index.js [[--option 01] [value 01] [--option 02] [value 02] ...]
```

**option**: Syntax for option is **--parent-child** , *parent* is the main config name followed by *child* is the sub-config name in **config.json** . (Refer example for further explanation)

**value**: Value of config for corresponsing option

### Examples:

**Scenario 01:** We have created separate databases for individual clients & currently need to load data of client in database named **airtel** in SQL Server, with rest of the settings unchanged, then below is the command for desired output
```bat
node ./dist/index.js --database-schema airtel
```

**Scenario 02:** We need to set from & to date dynamically (without changing config file), lets say **FY 2019-20 Q3**, then below is the command for that
```bat
node ./dist/index.js --tally-fromdate 20191001 --tally-todate 20191231
```

**Scenario 03:** You have a tally company named *Reliance Industries*, created database of it by name *client_reliance* and want to export **FY 2019-20**  Then below is the command for that
```bat
node ./dist/index.js --tally-fromdate 20191001 --tally-todate 20191231 --tally-company "Reliance Industries" --database-schema client_reliance
```


**Scenario 04:** You are using Amazon Web Services (AWS) as database server, and have multiple servers for each client group of companies with multiple separate database for each subsidiary company. You intend to sync data for **FY 2020-21** from Tally into **Jio** company database residing in **Reliance** server hosted at Mumbai region data centre of AWS. Command will be
```bat
node ./dist/index.js --tally-fromdate 20200401 --tally-todate 20210331 --database-server database-1.reliance.in-mumbai-1.rds.amazonaws.com --database-schema jio
```