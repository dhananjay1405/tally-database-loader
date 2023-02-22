# Sync Options

## Background
Time to sync is dependent on the volumn of data in the Tally. In few scenario where data is huge, sync time can be very long.
Utility supports 2 types of sync

**Full**: Complete data is sync to database freshly

**Incremental**: Only that portion of data is sync which got added / modified / deleted from the last sync point

## Steps
To perform incremental sync, it is a pre-requisite that a Full sync must be done as a starting point. After a successful Full sync, *config.json* can be edited and sync can be changed to Incremental for future.

## Compatibility
Incremental sync option is compatible only for RDBMS types of database i.e.
1. SQL Server
1. PostgreSQL Server

MySQL / MariaDB, incremental sync is experience issues. So kindly use it at your own risk.

Google BigQuery read operation incurs cost. So incremental sync might shoot billing compared to full sync. So, incremental sync option is delibarely not provided for BigQuery. CSV file mode too does not support incremental sync.

## Incremental Sync - Known Limitations
* Date From/To parameter of config.json is disabled during incremental sync (it is set to *auto* as a default), as utility cannot track if changes to data outside period were made or not.
* During prelimnary Full sync required for subsequent incremental sync, period should be kept as *auto*
* Existing data should not be deleted from database manually using DELETE / TRUNCATE SQL command when using incremental sync, as it may break sync and cause data ingegrity issues
* Setting incorrect database name in subsequency incremental sync will cause data integrity issues.
* **Incremental** sync option needs to be used judiciously when it is bare necessity. Prefer **Full** sync which is safe compared to incremental sync.
