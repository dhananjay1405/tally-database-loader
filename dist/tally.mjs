import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import readline from 'node:readline';
import stream from 'node:stream';
import yaml from 'js-yaml';
import { utility } from './utility.mjs';
import { logger } from './logger.mjs';
import { database } from './database.mjs';
class _tally {
    config;
    lastAlterIdMaster = 0;
    lastAlterIdTransaction = 0;
    isDefinitionYAML = true;
    lstTableMasterYaml = [];
    lstTableTransactionYaml = [];
    lstTableYaml = [];
    lstTallyCollectionDefinitionJson = [];
    lstDatabaseTableDefinitionJson = [];
    lstCollectionDataCache = new Map();
    //hidden commandline flags
    importMaster = true;
    importTransaction = true;
    truncateTable = true;
    periodFromDate = null;
    periodToDate = null;
    constructor() {
        try {
            this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['tally'];
        }
        catch (err) {
            this.config = {
                definition: 'tally-export-config.yaml',
                server: 'localhost',
                port: 9000,
                company: '',
                fromdate: 'auto',
                todate: 'auto',
                frequency: 0,
                sync: 'full',
                batchsize: 5000
            };
            logger.logError('tally()', err);
            throw err;
        }
    }
    updateCommandlineConfig(lstConfigs) {
        try {
            if (lstConfigs.has('tally-definition'))
                this.config.definition = lstConfigs.get('tally-definition') || '';
            if (lstConfigs.has('tally-server'))
                this.config.server = lstConfigs.get('tally-server') || '';
            if (lstConfigs.has('tally-port'))
                this.config.port = parseInt(lstConfigs.get('tally-port') || '9000');
            if (lstConfigs.has('tally-fromdate') && lstConfigs.has('tally-todate')) {
                let fromDate = lstConfigs.get('tally-fromdate') || '';
                let toDate = lstConfigs.get('tally-todate') || '';
                this.config.fromdate = /^\d{4}-?\d{2}-?\d{2}$/g.test(fromDate) ? fromDate : 'auto';
                this.config.todate = /^\d{4}-?\d{2}-?\d{2}$/g.test(toDate) ? toDate : 'auto';
            }
            if (lstConfigs.has('tally-sync'))
                this.config.sync = lstConfigs.get('tally-sync') || 'full';
            if (lstConfigs.has('tally-batchsize'))
                this.config.batchsize = parseInt(lstConfigs.get('tally-batchsize') || '5000');
            if (lstConfigs.has('tally-frequency'))
                this.config.frequency = parseInt(lstConfigs.get('tally-frequency') || '0');
            if (lstConfigs.has('tally-company'))
                this.config.company = lstConfigs.get('tally-company') || '';
            //flags
            if (lstConfigs.has('tally-master'))
                this.importMaster = lstConfigs.get('tally-master') == 'true';
            if (lstConfigs.has('tally-transaction'))
                this.importTransaction = lstConfigs.get('tally-transaction') == 'true';
            if (lstConfigs.has('tally-truncate'))
                this.truncateTable = lstConfigs.get('tally-truncate') == 'true';
        }
        catch (err) {
            logger.logError('tally.updateCommandlineConfig()', err);
            throw err;
        }
    }
    importData() {
        return new Promise(async (resolve, reject) => {
            try {
                logger.logMessage('Tally to Database | version: 1.0.41');
                let pathTallyExportDefinition = this.config.definition;
                if (pathTallyExportDefinition.endsWith('.yaml')) {
                    //Load YAML export definition file
                    if (fs.existsSync(`./${pathTallyExportDefinition}`)) {
                        let objYAML = yaml.load(fs.readFileSync(`./${pathTallyExportDefinition}`, 'utf-8'));
                        this.lstTableMasterYaml = objYAML['master'];
                        this.lstTableTransactionYaml = objYAML['transaction'];
                        this.lstTableYaml = [...this.lstTableMasterYaml, ...this.lstTableTransactionYaml];
                    }
                    else {
                        logger.logMessage('Tally export definition file specified does not exists or is invalid');
                        resolve();
                        return;
                    }
                }
                else {
                    this.isDefinitionYAML = false;
                    this.lstCollectionDataCache.clear(); //clear cache
                    //Load JSON collection definition file
                    if (fs.existsSync(`./${pathTallyExportDefinition.replace('.yaml', '.json')}`)) {
                        let objJSON = JSON.parse(fs.readFileSync(`./${pathTallyExportDefinition.replace('.yaml', '.json')}`, 'utf-8'));
                        this.lstTallyCollectionDefinitionJson = objJSON['collections'];
                        this.lstDatabaseTableDefinitionJson = objJSON['tables'];
                    }
                    else {
                        logger.logMessage('Tally collection definition file specified does not exists or is invalid');
                        resolve();
                        return;
                    }
                }
                await database.openConnectionPool();
                if (this.config.sync == 'incremental') {
                    if (this.isDefinitionYAML == false) {
                        logger.logMessage('Incremental Sync is supported only for YAML based definition');
                        return reject();
                    }
                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        //set mandatory config required for incremental sync
                        this.config.fromdate = 'auto';
                        this.config.todate = 'auto';
                        //delete and re-create CSV folder
                        if (fs.existsSync('./csv'))
                            fs.rmSync('./csv', { recursive: true });
                        fs.mkdirSync('./csv');
                        // check if all the tables required exists in database and create if not
                        if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                            logger.logMessage('Verifying required database tables [%s]', new Date().toLocaleDateString());
                            let lstTables = [];
                            lstTables.push(...this.lstTableMasterYaml);
                            lstTables.push(...this.lstTableTransactionYaml);
                            //fetch list of existing tables in database                        
                            let lstDatabaseTables = await database.listDatabaseTables();
                            //prepare list of required tables
                            let lstRequiredTables = lstTables.map(p => p.name);
                            lstRequiredTables.push('config'); //add config table
                            lstRequiredTables.push('_diff'); //add temporary diff table
                            lstRequiredTables.push('_delete'); //add temporary delete table
                            lstRequiredTables.push('_vchnumber'); //add temporary voucher number table
                            //verify if all the required tables exists in database
                            let countRequiredTablesFound = 0;
                            for (const requiredTable of lstRequiredTables) {
                                if (lstDatabaseTables.includes(requiredTable)) {
                                    countRequiredTablesFound++;
                                }
                            }
                            //run create table script only if none of the required tables are found
                            if (countRequiredTablesFound == 0) {
                                logger.logMessage('Creating database tables [%s]', new Date().toLocaleDateString());
                                await database.createDatabaseTables(this.config.sync);
                            }
                        }
                        //acquire last AlterID of master & transaction from last sync version of Database
                        logger.logMessage('Acquiring last AlterID from database');
                        let lastAlterIdMasterDatabase = await database.executeScalar(`select coalesce(max(cast(value as ${database.config.technology == 'mysql' ? 'unsigned int' : 'int'})),0) x from config where name = 'Last AlterID Master'`);
                        let lastAlterIdTransactionDatabase = await database.executeScalar(`select coalesce(max(cast(value as ${database.config.technology == 'mysql' ? 'unsigned int' : 'int'})),0) x from config where name = 'Last AlterID Transaction'`);
                        //update active company information before starting import
                        logger.logMessage('Updating company information configuration table [%s]', new Date().toLocaleDateString());
                        await this.saveCompanyInfo();
                        //prepare substitution list of runtime values to reflected in TDL XML
                        let configTallyXML = new Map();
                        configTallyXML.set('fromDate', utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                        configTallyXML.set('toDate', utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));
                        configTallyXML.set('targetCompany', this.config.company ? utility.String.escapeHTML(this.config.company) : '##SVCurrentCompany');
                        logger.logMessage('Performing incremental sync [%s]', new Date().toLocaleString());
                        await this.updateLastAlterId(); //Update last alter ID
                        let lastAlterIdMasterTally = this.lastAlterIdMaster;
                        let lastAlterIdTransactionTally = this.lastAlterIdTransaction;
                        //calculate flags to determine what changed
                        let flgIsMasterChanged = lastAlterIdMasterTally != lastAlterIdMasterDatabase;
                        let flgIsTransactionChanged = lastAlterIdTransactionTally != lastAlterIdTransactionDatabase;
                        //terminate sync if nothing has changed
                        if (!flgIsMasterChanged && !flgIsTransactionChanged) {
                            logger.logMessage('  No change found');
                            return resolve();
                        }
                        //iterate through all the Primary type of tables
                        let lstPrimaryTables = [];
                        if (flgIsMasterChanged) {
                            lstPrimaryTables.push(...this.lstTableMasterYaml.filter(p => p.nature == 'Primary'));
                        }
                        if (flgIsTransactionChanged) {
                            lstPrimaryTables.push(...this.lstTableTransactionYaml.filter(p => p.nature == 'Primary'));
                        }
                        for (let i = 0; i < lstPrimaryTables.length; i++) {
                            let activeTable = lstPrimaryTables[i];
                            await database.executeNonQuery('truncate table _diff;');
                            await database.executeNonQuery('truncate table _delete;');
                            let tempTable = {
                                name: '',
                                collection: activeTable.collection,
                                fields: [
                                    {
                                        name: 'guid',
                                        field: 'Guid',
                                        type: 'text'
                                    },
                                    {
                                        name: 'alterid',
                                        field: 'AlterId',
                                        type: 'text'
                                    }
                                ],
                                nature: '',
                                fetch: ['AlterId'],
                                filters: activeTable.filters
                            };
                            await this.processReport('_diff', tempTable, configTallyXML);
                            await database.bulkLoad(path.join(process.cwd(), `./csv/_diff.data`), '_diff', tempTable.fields.map(p => p.type)); //upload to temporary table
                            fs.unlinkSync(path.join(process.cwd(), `./csv/_diff.data`)); //delete temporary file
                            //insert into delete list rows there were deleted in current data compared to previous one
                            await database.executeNonQuery(`insert into _delete select guid from ${activeTable.name} where guid not in (select guid from _diff);`);
                            //insert into delete list rows that were modified in current data (as they will be imported freshly)
                            await database.executeNonQuery(`insert into _delete select t.guid from ${activeTable.name} as t join _diff as s on s.guid = t.guid where s.alterid <> t.alterid;`);
                            //remove delete list rows from the source table
                            await database.executeNonQuery(`delete from ${activeTable.name} where guid in (select guid from _delete)`);
                            //iterate through each cascade delete table and delete modified rows for insertion of fresh copy
                            if (Array.isArray(activeTable.cascade_delete) && activeTable.cascade_delete.length) {
                                for (let j = 0; j < activeTable.cascade_delete.length; j++) {
                                    let targetTable = activeTable.cascade_delete[j].table;
                                    let targetField = activeTable.cascade_delete[j].field;
                                    await database.executeNonQuery(`delete from ${targetTable} where ${targetField} in (select guid from _delete);`);
                                }
                            }
                        }
                        // iterate through all Master tables to extract modifed and added rows in Tally data
                        if (flgIsMasterChanged) {
                            for (let i = 0; i < this.lstTableMasterYaml.length; i++) {
                                let activeTable = this.lstTableMasterYaml[i];
                                //add AlterID filter
                                if (!Array.isArray(activeTable.filters))
                                    activeTable.filters = [];
                                activeTable.filters.push(`$AlterID > ${lastAlterIdMasterDatabase}`);
                                let targetTable = activeTable.name;
                                await this.processReport(targetTable, activeTable, configTallyXML);
                                await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable, activeTable.fields.map(p => p.type));
                                fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                                logger.logMessage('  syncing table %s', targetTable);
                            }
                        }
                        // iterate through Transaction table to extract modifed and added rows in Tally data
                        if (flgIsTransactionChanged) {
                            for (let i = 0; i < this.lstTableTransactionYaml.length; i++) {
                                let activeTable = this.lstTableTransactionYaml[i];
                                //add AlterID filter
                                if (!Array.isArray(activeTable.filters))
                                    activeTable.filters = [];
                                activeTable.filters.push(`$AlterID > ${lastAlterIdTransactionDatabase}`);
                                let targetTable = activeTable.name;
                                await this.processReport(targetTable, activeTable, configTallyXML);
                                await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable, activeTable.fields.map(p => p.type));
                                fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                                logger.logMessage('  syncing table %s', targetTable);
                            }
                        }
                        if (flgIsMasterChanged) {
                            // process foreign key updates to derived table fields
                            logger.logMessage('  processing foreign key updates');
                            for (let i = 0; i < lstPrimaryTables.length; i++) {
                                let activeTable = lstPrimaryTables[i];
                                if (Array.isArray(activeTable.cascade_update) && activeTable.cascade_update.length)
                                    for (let j = 0; j < activeTable.cascade_update.length; j++) {
                                        let targetTable = activeTable.cascade_update[j].table;
                                        let targetField = activeTable.cascade_update[j].field;
                                        if (database.config.technology == 'mssql') {
                                            await database.executeNonQuery(`update t set t.${targetField} = s.name from ${targetTable} as t join ${activeTable.name} as s on s.guid = t._${targetField} ;`);
                                        }
                                        else if (database.config.technology == 'mysql') {
                                            await database.executeNonQuery(`update ${targetTable} as t join ${activeTable.name} as s on s.guid = t._${targetField} set t.${targetField} = s.name ;`);
                                        }
                                        else if (database.config.technology == 'postgres') {
                                            await database.executeNonQuery(`update ${targetTable} as t set ${targetField} = s.name from ${activeTable.name} as s where s.guid = t._${targetField} ;`);
                                        }
                                        else
                                            ;
                                    }
                            }
                        }
                        if (flgIsTransactionChanged) {
                            //check if any Voucher Type is set to auto numbering
                            //automatic voucher number shifts voucher numbers of all subsequent date vouchers on insertion of in-between vouchers which requires updation
                            let countAutoNumberVouchers = await database.executeNonQuery(`select count(*) as c from mst_vouchertype where numbering_method like '%Auto%' ;`);
                            if (countAutoNumberVouchers) {
                                logger.logMessage('  processing voucher number updates');
                                await database.executeNonQuery('truncate table _vchnumber;');
                                //pull list of voucher numbers for all the vouchers
                                let activeTable = this.lstTableTransactionYaml.filter(p => p.name = 'trn_voucher')[0];
                                let lstActiveTableFilter = activeTable.filters || [];
                                lstActiveTableFilter.push('$$IsEqual:($NumberingMethod:VoucherType:$VoucherTypeName):"Automatic"');
                                if (Array.isArray(activeTable.filters))
                                    activeTable.filters.splice(activeTable.filters.length - 1, 1); //remove AlterID filter
                                let tempTable = {
                                    name: '',
                                    collection: activeTable.collection,
                                    fields: [
                                        {
                                            name: 'guid',
                                            field: 'Guid',
                                            type: 'text'
                                        },
                                        {
                                            name: 'voucher_number',
                                            field: 'VoucherNumber',
                                            type: 'text'
                                        }
                                    ],
                                    nature: '',
                                    filters: lstActiveTableFilter
                                };
                                await this.processReport('_vchnumber', tempTable, configTallyXML);
                                await database.bulkLoad(path.join(process.cwd(), `./csv/_vchnumber.data`), '_vchnumber', tempTable.fields.map(p => p.type)); //upload to temporary table
                                fs.unlinkSync(path.join(process.cwd(), `./csv/_vchnumber.data`)); //delete temporary file
                                //update voucher number with fresh copy
                                if (database.config.technology == 'mssql') {
                                    await database.executeNonQuery('update t set t.voucher_number = s.voucher_number from trn_voucher as t join _vchnumber as s on s.guid = t.guid;');
                                }
                                else if (database.config.technology == 'mysql') {
                                    await database.executeNonQuery('update trn_voucher as t join _vchnumber as s on s.guid = t.guid set t.voucher_number = s.voucher_number;');
                                }
                                else if (database.config.technology == 'postgres') {
                                    await database.executeNonQuery('update trn_voucher as t set voucher_number = s.voucher_number from _vchnumber as s where s.guid = t.guid;');
                                }
                                else
                                    ;
                            }
                        }
                        //erase rows for all the temporary calculation tables
                        await database.executeNonQuery('truncate table _diff ;');
                        await database.executeNonQuery('truncate table _delete ;');
                        await database.executeNonQuery('truncate table _vchnumber ;');
                    }
                    else
                        logger.logMessage('Incremental Sync is supported only for SQL Server / MySQL / PostgreSQL');
                }
                else { // assume default as full
                    let lstCompanies = await this.fetchTallyCompanyList();
                    if (!lstCompanies.length) {
                        logger.logMessage('Not a single company is open in Tally');
                        return reject();
                    }
                    else {
                        //activate target company
                        if (this.config.company) {
                            //validate if specified company exists
                            if (lstCompanies.map(p => p.name).includes(this.config.company)) {
                                await this.setTallyTargetCompany(this.config.company); // make the company active
                            }
                            else {
                                logger.logMessage(`Specified company "${this.config.company}" does not exists / open in Tally`);
                                return reject();
                            }
                        }
                        else { // default to active company
                            this.config.company = lstCompanies[0]?.name || '';
                        }
                        //select target period
                        if (this.config.fromdate.toLowerCase() == 'auto' || this.config.todate.toLowerCase() == 'auto') {
                            [this.periodFromDate, this.periodToDate] = await this.fetchTallyCompanyDefaultPeriod();
                        }
                        else {
                            this.periodFromDate = utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd');
                            this.periodToDate = utility.Date.parse(this.config.todate, 'yyyy-MM-dd');
                            if (!this.periodFromDate || !this.periodToDate || this.periodFromDate > this.periodToDate) {
                                logger.logMessage('Invalid from / to date specified');
                                return reject();
                            }
                            else {
                                await this.setTallyTargetPeriod(this.periodFromDate, this.periodToDate);
                            }
                        }
                    }
                    let lstTables = [];
                    if (this.importMaster) {
                        if (this.isDefinitionYAML) {
                            lstTables.push(...this.lstTableMasterYaml.map(p => p.name));
                        }
                        else {
                            lstTables.push(...this.lstDatabaseTableDefinitionJson.filter(p => p.isMaster).map(p => p.name));
                        }
                    }
                    if (this.importTransaction) {
                        if (this.isDefinitionYAML) {
                            lstTables.push(...this.lstTableTransactionYaml.map(p => p.name));
                        }
                        else {
                            lstTables.push(...this.lstDatabaseTableDefinitionJson.filter(p => !p.isMaster).map(p => p.name));
                        }
                    }
                    //delete and re-create CSV folder
                    if (fs.existsSync('./csv')) {
                        fs.rmSync('./csv', { recursive: true });
                    }
                    fs.mkdirSync('./csv');
                    // check if all the tables required exists in database and create if not
                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        logger.logMessage('Verifying required database tables [%s]', new Date().toLocaleDateString());
                        //fetch list of existing tables in database
                        let lstDatabaseTables = await database.listDatabaseTables();
                        //prepare list of required tables
                        let lstRequiredTables = [];
                        lstRequiredTables.push(...lstTables);
                        lstRequiredTables.push('config'); //add config table
                        //verify if all the required tables exists in database
                        let countRequiredTablesFound = 0;
                        for (const requiredTable of lstRequiredTables) {
                            if (lstDatabaseTables.includes(requiredTable)) {
                                countRequiredTablesFound++;
                            }
                        }
                        //run create table script only if none of the required tables are found
                        if (countRequiredTablesFound == 0) {
                            logger.logMessage('Creating database tables [%s]', new Date().toLocaleDateString());
                            await database.createDatabaseTables(this.config.sync);
                        }
                    }
                    if (/^(mssql|mysql|postgres|bigquery|csv)$/g.test(database.config.technology)) {
                        //update active company information before starting import
                        logger.logMessage('Updating company information configuration table [%s]', new Date().toLocaleDateString());
                        await this.saveCompanyInfo();
                    }
                    //prepare substitution list of runtime values to reflected in TDL XML
                    let configTallyXML = new Map();
                    configTallyXML.set('fromDate', utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                    configTallyXML.set('toDate', utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));
                    configTallyXML.set('targetCompany', this.config.company ? utility.String.escapeHTML(this.config.company) : '##SVCurrentCompany');
                    if (this.isDefinitionYAML) {
                        //dump data exported from Tally to CSV file required for bulk import
                        logger.logMessage('Generating CSV files from Tally [%s]', new Date().toLocaleString());
                        for (let i = 0; i < lstTables.length; i++) {
                            let timestampBegin = Date.now();
                            let targetTable = lstTables[i];
                            let targetTableConfig = this.lstTableYaml.filter(p => p.name == targetTable)[0];
                            await this.processReport(targetTable, targetTableConfig, configTallyXML);
                            let timestampEnd = Date.now();
                            let elapsedSecond = utility.Number.round((timestampEnd - timestampBegin) / 1000, 3);
                            logger.logMessage('  saving file %s.csv [%f sec]', targetTable, elapsedSecond);
                        }
                    }
                    else {
                        //iterate through each collection and cache data in memory
                        logger.logMessage('Generating collections from Tally [%s]', new Date().toLocaleString());
                        // generate master collections
                        for (const targetCollection of this.lstTallyCollectionDefinitionJson) {
                            if (targetCollection.collection != 'voucher') { //process master collection
                                let timestampBegin = Date.now();
                                let reqXmlPayload = this.generateCollectionRequestXMLPayload(targetCollection);
                                await this.saveTallyXMLResponse(reqXmlPayload, `./csv/${targetCollection.collection}.xml`);
                                let timestampEnd = Date.now();
                                let elapsedSecond = utility.Number.round((timestampEnd - timestampBegin) / 1000, 3);
                                logger.logMessage('  saving file %s.xml [%f sec]', targetCollection.collection, elapsedSecond);
                                this.lstCollectionDataCache.set(targetCollection.collection, await this.parseXmlToJsonCollection(targetCollection.collection));
                                fs.unlinkSync(`./csv/${targetCollection.collection}.xml`); //delete temporary file
                            }
                            else {
                                let lstVoucherCollectionData = [];
                                const processVoucherCollectionDateRange = async (periodStartDate, periodEndDate, batchCtr = 0) => {
                                    let timestampBegin = Date.now();
                                    let targetCollection = this.lstTallyCollectionDefinitionJson.filter(p => p.collection == 'voucher')[0];
                                    targetCollection.filters?.push({
                                        name: 'fltrPeriod',
                                        expression: `$Date &gt;= $$Date:"${utility.Date.format(periodStartDate, 'yyyyMMdd')}" and $Date &lt;= $$Date:"${utility.Date.format(periodEndDate, 'yyyyMMdd')}"`
                                    });
                                    let reqXmlPayload = this.generateCollectionRequestXMLPayload(targetCollection);
                                    await this.saveTallyXMLResponse(reqXmlPayload, `./csv/${targetCollection.collection}.xml`);
                                    let timestampEnd = Date.now();
                                    let elapsedSecond = utility.Number.round((timestampEnd - timestampBegin) / 1000, 3);
                                    if (batchCtr != 0) {
                                        logger.logMessage('  saving file voucher.xml | batch #%d [%f sec]', batchCtr, elapsedSecond);
                                    }
                                    else {
                                        logger.logMessage('  saving file voucher.xml [%f sec]', elapsedSecond);
                                    }
                                    lstVoucherCollectionData.push(...await this.parseXmlToJsonCollection(targetCollection.collection));
                                    fs.unlinkSync(`./csv/voucher.xml`); //delete temporary file
                                };
                                let lstDateCount = await this.generateVoucherDatewiseCount();
                                let lstStartEndDateBatch = [];
                                if (lstDateCount.length > 0) {
                                    lstStartEndDateBatch.push([lstDateCount[0][0], lstDateCount[0][0], lstDateCount[0][1]]); //initialize first batch
                                }
                                for (let i = 1; i < lstDateCount.length; i++) {
                                    let [currDate, currCount] = lstDateCount[i];
                                    let latestBatch = lstStartEndDateBatch[lstStartEndDateBatch.length - 1];
                                    if (latestBatch[2] + currCount > this.config.batchsize) { //batch overflow
                                        lstStartEndDateBatch.push([currDate, currDate, currCount]); //start new batch
                                    }
                                    else {
                                        latestBatch[1] = currDate; //extend end date
                                        latestBatch[2] += currCount; //increment batch counter
                                    }
                                }
                                if (lstStartEndDateBatch.length > 1) {
                                    //process each voucher batch
                                    for (let i = 0; i < lstStartEndDateBatch.length; i++) {
                                        let [batchStartDate, batchEndDate, batchCount] = lstStartEndDateBatch[i];
                                        await processVoucherCollectionDateRange(batchStartDate, batchEndDate, i + 1);
                                    }
                                }
                                else {
                                    await processVoucherCollectionDateRange(this.periodFromDate || new Date(), this.periodToDate || new Date());
                                }
                                this.lstCollectionDataCache.set(targetCollection.collection, lstVoucherCollectionData);
                            }
                        }
                    }
                    if (this.truncateTable) {
                        if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                            await database.truncateTables(lstTables); //truncate tables
                        }
                    }
                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        if (this.isDefinitionYAML) {
                            //perform CSV file based bulk import into database
                            logger.logMessage('Loading CSV files to database tables [%s]', new Date().toLocaleString());
                            for (let i = 0; i < lstTables.length; i++) {
                                let targetTable = lstTables[i];
                                let targetTableConfig = this.lstTableYaml.filter(p => p.name == targetTable)[0];
                                let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable, targetTableConfig.fields.map(p => p.type));
                                fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                                logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                            }
                        }
                        else {
                            // perform in-memory collection data based bulk import into database
                            logger.logMessage('Loading collections to database tables [%s]', new Date().toLocaleString());
                            for (const targetTable of this.lstDatabaseTableDefinitionJson) {
                                let lstDataRows = this.populateTableFromCollectionData(targetTable);
                                let rowCount = await database.bulkLoadTableJson(targetTable, lstDataRows);
                                logger.logMessage('  %s: imported %d rows', targetTable.name, rowCount);
                            }
                        }
                        fs.rmdirSync('./csv'); //remove directory
                    }
                    else if (database.config.technology == 'csv' || database.config.technology == 'json' || database.config.technology == 'bigquery') {
                        if (database.config.technology == 'bigquery') {
                            logger.logMessage('Loading data into BigQuery tables [%s]', new Date().toLocaleString());
                        }
                        if (this.isDefinitionYAML) {
                            //remove special character of date from CSV files, which was inserted for null dates
                            for (let i = 0; i < lstTables.length; i++) {
                                let targetTable = lstTables[i];
                                let targetTableConfig = this.lstTableYaml.filter(p => p.name == targetTable)[0];
                                let lstFieldTypes = targetTableConfig.fields.map(p => p.type);
                                let content = fs.readFileSync(`./csv/${targetTable}.data`, 'utf-8');
                                if (database.config.technology == 'json') {
                                    content = JSON.stringify(database.csvToJsonArray(content, targetTable, lstFieldTypes));
                                }
                                else {
                                    content = database.convertCSV(content, lstFieldTypes);
                                }
                                fs.writeFileSync(`./csv/${targetTable}.${database.config.technology == 'json' ? 'json' : 'csv'}`, '\ufeff' + content);
                                fs.unlinkSync(`./csv/${targetTable}.data`); //delete raw file
                                if (database.config.technology == 'bigquery') {
                                    let rowCount = await database.uploadGoogleBigQuery(targetTable);
                                    logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                                }
                            }
                        }
                        else {
                            logger.logMessage('Generating CSV files [%s]', new Date().toLocaleString());
                            for (const targetTable of lstTables) {
                                let tableDef = this.lstDatabaseTableDefinitionJson.filter(p => p.name == targetTable)[0];
                                let lstDataRows = this.populateTableFromCollectionData(tableDef);
                                await database.jsonToCsv(`./csv/${targetTable}.csv`, tableDef, lstDataRows, true); //save CSV file
                                if (database.config.technology == 'bigquery') {
                                    let rowCount = await database.uploadGoogleBigQuery(targetTable);
                                    logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                                }
                            }
                        }
                    }
                    else
                        ;
                }
                resolve();
            }
            catch (err) {
                logger.logError('tally.importData()', err);
                reject(err);
            }
            finally {
                await database.closeConnectionPool();
            }
        });
    }
    updateLastAlterId() {
        return new Promise(async (resolve, reject) => {
            try {
                //acquire last AlterID of master & transaction from Tally (for current company)
                let xmlPayLoad = '<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReport</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>ASCII (Comma Delimited)</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReport"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart</PARTS></FORM><PART NAME="MyPart"><LINES>MyLine</LINES><REPEAT>MyLine : MyCollection</REPEAT><SCROLLED>Vertical</SCROLLED></PART><LINE NAME="MyLine"><FIELDS>FldAlterMaster,FldAlterTransaction</FIELDS></LINE><FIELD NAME="FldAlterMaster"><SET>$AltMstId</SET></FIELD><FIELD NAME="FldAlterTransaction"><SET>$AltVchId</SET></FIELD><COLLECTION NAME="MyCollection"><TYPE>Company</TYPE><FILTER>FilterActiveCompany</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="FilterActiveCompany">$$IsEqual:##SVCurrentCompany:$Name</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>';
                if (tally.config.company) { // substitute company name if found
                    xmlPayLoad = xmlPayLoad.replace('##SVCurrentCompany', `"${utility.String.escapeHTML(tally.config.company)}"`);
                }
                let contentLastAlterIdTally = await this.postTallyXML(xmlPayLoad);
                if (contentLastAlterIdTally == '') { //target company is closed
                    this.lastAlterIdMaster = -1;
                    this.lastAlterIdTransaction - 1;
                    if (!tally.config.company) {
                        logger.logMessage('No company open in Tally');
                        return reject('Please select one or more company in Tally to sync data');
                    }
                    else {
                        logger.logMessage(`Specified company "${tally.config.company}" is closed in Tally`);
                        return reject('Please select target company in Tally to sync data');
                    }
                }
                else {
                    let lstAltId = contentLastAlterIdTally.replace(/\"/g, '').split(',');
                    this.lastAlterIdMaster = lstAltId.length >= 2 ? parseInt(lstAltId[0]) : 0;
                    this.lastAlterIdTransaction = lstAltId.length >= 2 ? parseInt(lstAltId[1]) : 0;
                    // fill-up invalid alterID with zero
                    if (isNaN(this.lastAlterIdMaster)) {
                        this.lastAlterIdMaster = 0;
                    }
                    if (isNaN(this.lastAlterIdTransaction)) {
                        this.lastAlterIdTransaction = 0;
                    }
                }
                resolve();
            }
            catch (err) {
                logger.logError('tally.importData()', err);
                resolve();
            }
        });
    }
    postTallyXML(msg) {
        return new Promise((resolve, reject) => {
            try {
                let req = http.request({
                    hostname: this.config.server,
                    port: this.config.port,
                    path: '',
                    method: 'POST',
                    headers: {
                        'Content-Length': Buffer.byteLength(msg, 'utf16le'),
                        'Content-Type': 'text/xml;charset=utf-16'
                    }
                }, (res) => {
                    let data = '';
                    res
                        .setEncoding('utf16le')
                        .on('data', (chunk) => {
                        let result = chunk.toString() || '';
                        data += result;
                    })
                        .on('end', () => {
                        resolve(data);
                    })
                        .on('error', (httpErr) => {
                        logger.logMessage('Unable to connect with Tally. Ensure tally XML port is enabled');
                        logger.logError('tally.postTallyXML()', httpErr['message'] || '');
                        reject(httpErr);
                    });
                });
                req.on('error', (reqError) => {
                    logger.logMessage('Unable to connect with Tally. Ensure tally XML port is enabled');
                    logger.logError('tally.postTallyXML()', reqError['message'] || '');
                    reject(reqError);
                });
                req.write(msg, 'utf16le');
                req.end();
            }
            catch (err) {
                logger.logError('tally.postTallyXML()', err);
                reject(err);
            }
        });
    }
    ;
    saveTallyXMLResponse(msg, filename) {
        return new Promise((resolve, reject) => {
            try {
                let strResponse = fs.createWriteStream(filename, { encoding: 'utf16le' });
                let req = http.request({
                    hostname: this.config.server,
                    port: this.config.port,
                    path: '',
                    method: 'POST',
                    headers: {
                        'Content-Length': Buffer.byteLength(msg, 'utf16le'),
                        'Content-Type': 'text/xml;charset=utf-16'
                    }
                }, (res) => {
                    // if statusCode is OK, pipe the response to file
                    if (res.statusCode == 200) {
                        res.pipe(strResponse);
                    }
                    else {
                        strResponse.close();
                        fs.unlinkSync(filename); //delete partial file
                        reject(`Tally XML response error: ${res.statusCode} - ${res.statusMessage}`);
                    }
                });
                req.on('error', (reqError) => {
                    logger.logMessage('Unable to connect with Tally. Ensure tally XML port is enabled');
                    logger.logError('tally.saveTallyXMLResponse()', reqError['message'] || '');
                    reject(reqError);
                });
                strResponse.on('finish', () => {
                    strResponse.close();
                    resolve();
                });
                strResponse.on('error', (err) => {
                    strResponse.close();
                    logger.logError('tally.saveTallyXMLResponse()', err);
                    reject(err);
                });
                req.write(msg, 'utf16le');
                req.end();
            }
            catch (err) {
                logger.logError('tally.saveTallyXMLResponse()', err);
                reject(err);
            }
        });
    }
    substituteTDLParameters(msg, substitutions) {
        let retval = msg;
        try {
            substitutions.forEach((v, k) => {
                let regPtrn = new RegExp(`\\{${k}\\}`);
                if (typeof v === 'string')
                    retval = retval.replace(regPtrn, utility.String.escapeHTML(v));
                else if (typeof v === 'number')
                    retval = retval.replace(regPtrn, v.toString());
                else if (v instanceof Date)
                    retval = retval.replace(regPtrn, utility.Date.format(v, 'd-MMM-yyyy'));
                else if (typeof v === 'boolean')
                    retval = retval.replace(regPtrn, v ? 'Yes' : 'No');
                else
                    ;
            });
        }
        catch (err) {
            logger.logError('tally.substituteTDLParameters()', err);
        }
        return retval;
    }
    processTdlOutputManipulation(txt) {
        let retval = txt;
        try {
            retval = retval.replace('<ENVELOPE>', ''); //Eliminate ENVELOPE TAG
            retval = retval.replace('</ENVELOPE>', '');
            retval = retval.replace(/\<FLDBLANK\>\<\/FLDBLANK\>/g, ''); //Eliminate blank tag
            retval = retval.replace(/\s+\r\n/g, ''); //remove empty lines
            retval = retval.replace(/\r\n/g, ''); //remove all line breaks
            retval = retval.replace(/\t/g, ' '); //replace all tabs with a single space
            retval = retval.replace(/\s+\<F/g, '<F'); //trim left space
            retval = retval.replace(/\<\/F\d+\>/g, ''); //remove XML end tags
            retval = retval.replace(/\<F01\>/g, '\r\n'); //append line break to each row start and remove first field XML start tag
            retval = retval.replace(/\<F\d+\>/g, '\t'); //replace XML start tags with tab separator
            retval = retval.replace(/&amp;/g, '&'); //escape ampersand
            retval = retval.replace(/&lt;/g, '<'); //escape less than
            retval = retval.replace(/&gt;/g, '>'); //escape greater than
            retval = retval.replace(/&quot;/g, '"'); //escape ampersand
            retval = retval.replace(/&apos;/g, "'"); //escape ampersand
            retval = retval.replace(/&tab;/g, ''); //strip out tab if any
            retval = retval.replace(/&#\d+;/g, ""); //remove all unreadable character escapes
        }
        catch (err) {
            logger.logError('tally.processTdlOutputManipulation()', err);
        }
        return retval;
    }
    processReport(targetTable, tableConfig, substitutions) {
        return new Promise(async (resolve, reject) => {
            try {
                let xml = this.generateXMLfromYAML(tableConfig);
                if (substitutions && substitutions.size)
                    xml = this.substituteTDLParameters(xml, substitutions);
                let output = await this.postTallyXML(xml);
                output = this.processTdlOutputManipulation(output);
                let columnHeaders = tableConfig.fields.map(p => p.name).join('\t');
                fs.writeFileSync(`./csv/${targetTable}.data`, columnHeaders + output);
                resolve();
            }
            catch (err) {
                logger.logError(`tally.processMasterReport(${targetTable})`, err);
                reject(err);
            }
        });
    }
    saveCompanyInfo() {
        return new Promise(async (resolve, reject) => {
            try {
                const convertDateYYYYMMDD = (dateStr) => {
                    let partYear = dateStr.substring(0, 4);
                    let partMonth = dateStr.substring(4, 6);
                    let partDay = dateStr.substring(6);
                    return partYear + '-' + partMonth + '-' + partDay;
                };
                let xmlCompany = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>TallyDatabaseLoaderReport</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>ASCII (Comma Delimited)</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="TallyDatabaseLoaderReport"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart</PARTS></FORM><PART NAME="MyPart"><LINES>MyLine</LINES><REPEAT>MyLine : MyCollection</REPEAT><SCROLLED>Vertical</SCROLLED></PART><LINE NAME="MyLine"><FIELDS>FldGuid,FldName,FldBooksFrom,FldLastVoucherDate,FldLastAlterIdMaster,FldLastAlterIdTransaction,FldEOL</FIELDS></LINE><FIELD NAME="FldGuid"><SET>$Guid</SET></FIELD><FIELD NAME="FldName"><SET>$$StringFindAndReplace:$Name:'"':'""'</SET></FIELD><FIELD NAME="FldBooksFrom"><SET>(($$YearOfDate:$BooksFrom)*10000)+(($$MonthOfDate:$BooksFrom)*100)+(($$DayOfDate:$BooksFrom)*1)</SET></FIELD><FIELD NAME="FldLastVoucherDate"><SET>(($$YearOfDate:$LastVoucherDate)*10000)+(($$MonthOfDate:$LastVoucherDate)*100)+(($$DayOfDate:$LastVoucherDate)*1)</SET></FIELD><FIELD NAME="FldLastAlterIdMaster"><SET>$AltMstId</SET></FIELD><FIELD NAME="FldLastAlterIdTransaction"><SET>$AltVchId</SET></FIELD><FIELD NAME="FldEOL"><SET>†</SET></FIELD><COLLECTION NAME="MyCollection"><TYPE>Company</TYPE><FILTER>FilterActiveCompany</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="FilterActiveCompany">$$IsEqual:##SVCurrentCompany:$Name</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
                if (this.config.company) //replce active company with specific company name if specified
                    xmlCompany = xmlCompany.replace('##SVCurrentCompany', `"${utility.String.escapeHTML(this.config.company)}"`);
                let strCompanyInfo = await this.postTallyXML(xmlCompany); //extract active company information
                if (strCompanyInfo.endsWith(',"†",\r\n')) {
                    strCompanyInfo = strCompanyInfo.replace(/\",\"†\",\r\n/g, '').substr(1);
                    let lstCompanyInfoParts = strCompanyInfo.split(/\",\"/g);
                    let companyName = lstCompanyInfoParts[1];
                    companyName = companyName.replace(/'/g, '\\"');
                    if (this.config.fromdate == 'auto' || this.config.todate == 'auto') { //auto assign from/to from company info for detection mode
                        this.config.fromdate = convertDateYYYYMMDD(lstCompanyInfoParts[2]);
                        this.config.todate = convertDateYYYYMMDD(lstCompanyInfoParts[3]);
                    }
                    let altIdMaster = parseInt(lstCompanyInfoParts[4]);
                    let altIdTransaction = parseInt(lstCompanyInfoParts[5]);
                    //clear config table of database and insert active company info to config table
                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        await database.executeNonQuery('truncate table config;');
                        await database.executeNonQuery(`insert into config(name,value) values('Update Timestamp','${new Date().toLocaleString()}'),('Company Name','${companyName}'),('Period From','${this.config.fromdate}'),('Period To','${this.config.todate}'),('Last AlterID Master','${altIdMaster}'),('Last AlterID Transaction','${altIdTransaction}');`);
                    }
                    else if (/^(csv|bigquery)$/g.test(database.config.technology)) {
                        let csvContent = `name,value\r\nUpdate Timestamp,${new Date().toLocaleString().replace(',', '')}\r\nCompany Name,${companyName}\r\nPeriod From,${this.config.fromdate}\r\nPeriod To,${this.config.todate}\r\Last AlterID nMaster,${altIdMaster}\r\Last AlterID nTransaction,${altIdTransaction}`;
                        fs.writeFileSync('./csv/config.csv', csvContent, { encoding: 'utf-8' });
                        if (database.config.technology == 'bigquery') {
                            await database.uploadGoogleBigQuery('config');
                        }
                    }
                    else {
                        return reject('Invalid platform selected');
                    }
                }
                else {
                    if (!tally.config.company) {
                        logger.logMessage('No company open in Tally');
                        return reject('Please select one or more company in Tally to sync data');
                    }
                    else {
                        logger.logMessage(`Specified company "${tally.config.company}" is closed in Tally`);
                        return reject('Please select target company in Tally to sync data');
                    }
                }
                resolve();
            }
            catch (err) {
                logger.logError(`tally.saveCompanyInfo()`, err['message']);
                reject('');
            }
        });
    }
    setTallyTargetCompany(companyName) {
        return new Promise(async (resolve, reject) => {
            try {
                let xmlPayload = `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReport</ID></HEADER><BODY><DESC><TDL><TDLMESSAGE><REPORT NAME="MyReport"><USE>ChangeCurrentCompany</USE><SET>SVCurrentCompany : "${companyName}"</SET></REPORT></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
                await this.postTallyXML(xmlPayload);
                resolve();
            }
            catch (err) {
                logger.logError(`tally.setTallyTargetCompany()`, err);
                reject(err);
            }
        });
    }
    setTallyTargetPeriod(fromDate, toDate) {
        return new Promise(async (resolve, reject) => {
            try {
                let dateFromStr = utility.Date.format(fromDate, 'd-MMM-yyyy');
                let dateToStr = utility.Date.format(toDate, 'd-MMM-yyyy');
                let xmlPayload = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReport</ID></HEADER><BODY><DESC><STATICVARIABLES></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReport"><USE>Change Period</USE><SET>SVFromDate : "${dateFromStr}"</SET><SET>SVToDate : "${dateToStr}"</SET></REPORT></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
                await this.postTallyXML(xmlPayload);
                resolve();
            }
            catch (err) {
                logger.logError(`tally.setTallyTargetPeriod()`, err);
                reject(err);
            }
        });
    }
    tallyOleDateToJSDate(oleDateNumber) {
        try {
            oleDateNumber += 25569; //convert to unix epoch base date
            return new Date(oleDateNumber * 86400 * 1000);
        }
        catch (err) {
            logger.logError(`tally.tallyOleDateToJSDate()`, err);
            return null;
        }
    }
    fetchTallyCompanyList() {
        return new Promise(async (resolve, reject) => {
            let retval = [];
            try {
                let xmlPayload = '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>TallyDatabaseLoaderColl</ID></HEADER><BODY><DESC><TDL><TDLMESSAGE><COLLECTION NAME="TallyDatabaseLoaderColl"><TYPE>company</TYPE><COMPUTE>IsActiveCompany : $$IsEqual:$Name:##SVCurrentCompany</COMPUTE><FETCH>BooksFrom,AltMstId,AltVchId</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>';
                let xmlContent = await this.postTallyXML(xmlPayload);
                retval = await this.parseXmlToJsonCollection('company', xmlContent);
                resolve(retval);
            }
            catch (err) {
                logger.logError(`tally.fetchTallyCompanyList()`, err);
                reject(err);
            }
        });
    }
    fetchTallyCompanyDefaultPeriod() {
        return new Promise(async (resolve, reject) => {
            try {
                let retval = [null, null];
                let retvalFromDate = null;
                let xmlPayload = '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Function</TYPE><ID>$$SystemPeriodFrom</ID></HEADER></ENVELOPE>';
                let xmlContent = await this.postTallyXML(xmlPayload);
                let regPtrn = /\<RESULT\sTYPE=\"Date\"\sJD=\"(\d+)\"\>/g;
                let match = regPtrn.exec(xmlContent);
                if (match && match.length >= 2) {
                    retvalFromDate = this.tallyOleDateToJSDate(parseInt(match[1]));
                }
                xmlPayload = '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Function</TYPE><ID>$$SystemPeriodTo</ID></HEADER></ENVELOPE>';
                xmlContent = await this.postTallyXML(xmlPayload);
                match = regPtrn.exec(xmlContent);
                let retvalToDate = null;
                if (match && match.length >= 2) {
                    retvalToDate = this.tallyOleDateToJSDate(parseInt(match[1]));
                }
                retval = [retvalFromDate, retvalToDate];
                resolve(retval);
            }
            catch (err) {
                logger.logError(`tally.fetchTallyCompanyDefaultPeriod()`, err);
                reject(err);
            }
        });
    }
    generateXMLfromYAML(tblConfig) {
        let retval = '';
        try {
            //XML header
            retval = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>TallyDatabaseLoaderReport</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>XML (Data Interchange)</SVEXPORTFORMAT><SVFROMDATE>{fromDate}</SVFROMDATE><SVTODATE>{toDate}</SVTODATE><SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="TallyDatabaseLoaderReport"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart01</PARTS></FORM>`;
            if (!this.config.company) //remove complete SVCURRENTCOMPANY tag if no target company is specified
                retval = retval.replace('<SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY>', '');
            else
                retval = retval.replace('{targetCompany}', utility.String.escapeHTML(this.config.company));
            //Push routes list
            let lstRoutes = tblConfig.collection.split(/\./g);
            let targetCollection = lstRoutes.splice(0, 1);
            lstRoutes.unshift('MyCollection'); //add basic collection level route
            //loop through and append PART XML
            for (let i = 0; i < lstRoutes.length; i++) {
                let xmlPart = utility.Number.format(i + 1, 'MyPart00');
                let xmlLine = utility.Number.format(i + 1, 'MyLine00');
                retval += `<PART NAME="${xmlPart}"><LINES>${xmlLine}</LINES><REPEAT>${xmlLine} : ${lstRoutes[i]}</REPEAT><SCROLLED>Vertical</SCROLLED></PART>`;
            }
            //loop through and append LINE XML (except last line which contains field data)
            for (let i = 0; i < lstRoutes.length - 1; i++) {
                let xmlLine = utility.Number.format(i + 1, 'MyLine00');
                let xmlPart = utility.Number.format(i + 2, 'MyPart00');
                retval += `<LINE NAME="${xmlLine}"><FIELDS>FldBlank</FIELDS><EXPLODE>${xmlPart}</EXPLODE></LINE>`;
            }
            retval += `<LINE NAME="${utility.Number.format(lstRoutes.length, 'MyLine00')}">`;
            retval += `<FIELDS>`; //field end
            //Append field declaration list
            for (let i = 0; i < tblConfig.fields.length; i++)
                retval += utility.Number.format(i + 1, 'Fld00') + ',';
            retval = utility.String.strip(retval, 1);
            retval += `</FIELDS></LINE>`; //End of Field declaration
            //loop through each field
            for (let i = 0; i < tblConfig.fields.length; i++) {
                let fieldXML = `<FIELD NAME="${utility.Number.format(i + 1, 'Fld00')}">`;
                let iField = tblConfig.fields[i];
                //set field TDL XML expression based on type of data
                if (/^(\.\.)?[a-zA-Z0-9_]+$/g.test(iField.field)) {
                    if (iField.type == 'text')
                        fieldXML += `<SET>$${iField.field}</SET>`;
                    else if (iField.type == 'logical')
                        fieldXML += `<SET>if $${iField.field} then 1 else 0</SET>`;
                    else if (iField.type == 'date')
                        fieldXML += `<SET>if $$IsEmpty:$${iField.field} then $$StrByCharCode:241 else $$PyrlYYYYMMDDFormat:$${iField.field}:"-"</SET>`;
                    else if (iField.type == 'number')
                        fieldXML += `<SET>if $$IsEmpty:$${iField.field} then "0" else $$String:$${iField.field}</SET>`;
                    else if (iField.type == 'amount')
                        fieldXML += `<SET>$$StringFindAndReplace:(if $$IsDebit:$${iField.field} then -$$NumValue:$${iField.field} else $$NumValue:$${iField.field}):"(-)":"-"</SET>`;
                    else if (iField.type == 'quantity')
                        fieldXML += `<SET>$$StringFindAndReplace:(if $$IsInwards:$${iField.field} then $$Number:$$String:$${iField.field}:"TailUnits" else -$$Number:$$String:$${iField.field}:"TailUnits"):"(-)":"-"</SET>`;
                    else if (iField.type == 'rate')
                        fieldXML += `<SET>if $$IsEmpty:$${iField.field} then 0 else $$Number:$${iField.field}</SET>`;
                    else
                        fieldXML += `<SET>${iField.field}</SET>`;
                }
                else
                    fieldXML += `<SET>${iField.field}</SET>`;
                fieldXML += `<XMLTAG>${utility.Number.format(i + 1, 'F00')}</XMLTAG>`;
                fieldXML += `</FIELD>`;
                retval += fieldXML;
            }
            retval += `<FIELD NAME="FldBlank"><SET>""</SET></FIELD>`; //Blank Field specification
            //collection
            retval += `<COLLECTION NAME="MyCollection"><TYPE>${targetCollection}</TYPE>`;
            //fetch list
            if (tblConfig.fetch && tblConfig.fetch.length)
                retval += `<FETCH>${tblConfig.fetch.join(',')}</FETCH>`;
            //filter
            if (tblConfig.filters && tblConfig.filters.length) {
                retval += `<FILTER>`;
                for (let j = 0; j < tblConfig.filters.length; j++)
                    retval += utility.Number.format(j + 1, 'Fltr00') + ',';
                retval = utility.String.strip(retval); //remove last comma
                retval += `</FILTER>`;
            }
            retval += `</COLLECTION>`;
            //filter
            if (tblConfig.filters && tblConfig.filters.length)
                for (let j = 0; j < tblConfig.filters.length; j++)
                    retval += `<SYSTEM TYPE="Formulae" NAME="${utility.Number.format(j + 1, 'Fltr00')}">${tblConfig.filters[j]}</SYSTEM>`;
            //XML footer
            retval += `</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
        }
        catch (err) {
            logger.logError(`tally.generateXMLfromYAML()`, err);
        }
        return retval;
    }
    generateCollectionRequestXMLPayload(targetCollection) {
        let retval = '';
        try {
            retval = '<ENVELOPE>\n<HEADER>\n<VERSION>1</VERSION>\n<TALLYREQUEST>Export</TALLYREQUEST>\n<TYPE>Collection</TYPE>\n<ID>TallyDatabaseLoaderColl</ID>\n</HEADER>\n<BODY>\n<DESC>\n<TDL>\n<TDLMESSAGE>\n';
            if (!targetCollection.by && !targetCollection.aggrcompute) {
                retval += '<COLLECTION NAME="TallyDatabaseLoaderColl">\n';
            }
            else {
                retval += '<COLLECTION NAME="TallyDatabaseLoaderCollEx">\n';
            }
            retval += `<TYPE>${targetCollection.collection}</TYPE>\n`; //append collection name
            if (Array.isArray(targetCollection.compute) && targetCollection.compute.length > 0) { //append compute definitions (if any)
                for (const computeDef of targetCollection.compute) {
                    retval += `<COMPUTE>${computeDef.name} : ${computeDef.expression}</COMPUTE>\n`;
                }
            }
            if (Array.isArray(targetCollection.fetch) && targetCollection.fetch.length > 0) {
                retval += `<FETCH>${targetCollection.fetch.join(',')}</FETCH>\n`; //append fetch fields
            }
            if (Array.isArray(targetCollection.filters) && targetCollection.filters.length > 0) {
                retval += `<FILTER>${targetCollection.filters.map(f => f.name).join(',')}</FILTER>\n`;
            }
            retval += `</COLLECTION>\n`;
            if (targetCollection.by && targetCollection.aggrcompute) {
                retval += '<COLLECTION NAME="TallyDatabaseLoaderColl">\n<SOURCECOLLECTION>TallyDatabaseLoaderCollEx</SOURCECOLLECTION>\n';
                for (const aggrBy of targetCollection.by) {
                    retval += `<BY>${aggrBy}</BY>\n`;
                }
                for (const aggrComputeDef of targetCollection.aggrcompute) {
                    retval += `<AGGRCOMPUTE>${aggrComputeDef}</AGGRCOMPUTE>\n`;
                }
                retval += `</COLLECTION>\n`;
            }
            if (Array.isArray(targetCollection.filters) && targetCollection.filters.length > 0) { //append filter definitions (if any)
                for (const filterDef of targetCollection.filters) {
                    if (filterDef.expression && filterDef.expression.trim() !== '') {
                        retval += `<SYSTEM TYPE="Formulae" NAME="${filterDef.name}">${filterDef.expression}</SYSTEM>\n`;
                    }
                }
            }
            retval += `</TDLMESSAGE>\n</TDL>\n</DESC>\n</BODY>\n</ENVELOPE>`;
        }
        catch (err) {
            logger.logError(`tally.generateCollectionRequestXMLPayload()`, err);
        }
        return retval;
    }
    populateTableFromCollectionData(targetTable) {
        let retval = [];
        try {
            const extractFieldValueFromSourceObject = (targetField, sourceDataObjTree) => {
                let retval = undefined;
                let targetFieldName = targetField.source;
                //search for the field from inner most object to outer most object
                for (let i = sourceDataObjTree.length - 1; i >= 0; i--) {
                    if (sourceDataObjTree[i].hasOwnProperty(targetFieldName)) {
                        retval = sourceDataObjTree[i][targetFieldName];
                        break;
                    }
                }
                //handle datatype mismatch
                if (typeof retval === 'string' && (targetField.datatype == 'decimal' || targetField.datatype == 'number')) {
                    if (retval.includes('=')) { //forex expression
                        retval = retval.split('=')[1].trim(); //extract numeric part after equal sign
                        retval = retval.replace(/[^0-9\.\-]/g, ''); //remove non-numeric characters
                    }
                    retval = parseFloat(retval);
                    if (isNaN(retval)) {
                        retval = 0;
                    }
                }
                else if (typeof retval === 'string' && targetField.datatype == 'boolean') {
                    retval = retval === 'Yes';
                }
                else if (Array.isArray(retval) && retval.length == 1 && !targetField.transform?.concat) {
                    retval = retval[0]; //unwrap single item array if no concat transformation specified
                }
                // handle transformation if specified
                if (targetField.transform && retval !== undefined && retval !== null) {
                    if (targetField.transform.replace && typeof retval === 'string') {
                        if (typeof targetField.transform.replace === 'string') { // text stripping replacement
                            retval = retval.replace(targetField.transform.replace, '');
                        }
                        else { // find & replace action
                            retval = retval.replace(targetField.transform.replace.source, targetField.transform.replace.target);
                        }
                    }
                    else if (targetField.transform.concat && Array.isArray(retval)) {
                        retval = retval.join(targetField.transform.concat); // concatenate array items into single string using delimiter specified in concat
                    }
                    else if (targetField.transform.lookup) {
                        //
                    }
                    else
                        ;
                }
                // handling if value is still undefined (not found in source object tree)
                if (retval === undefined) {
                    if (targetField.datatype == 'number' || targetField.datatype == 'decimal') {
                        retval = 0;
                    }
                    else if (targetField.datatype == 'date') {
                        retval = null;
                    }
                    else if (targetField.datatype == 'string') {
                        retval = '';
                    }
                }
                return retval;
            };
            const generateDataRow = (sourceDataObjTree) => {
                let objRow = {};
                for (const fieldDef of targetTable.fields) {
                    let fieldValue = extractFieldValueFromSourceObject(fieldDef, sourceDataObjTree);
                    Object.defineProperty(objRow, fieldDef.name, { value: fieldValue, writable: true, enumerable: true, configurable: true });
                }
                return objRow;
            };
            const iterateCollectionPathObject = (sourceCollectionPath, targetCollectionPaths, sourceDataObjTree) => {
                let sourceDataObj = sourceDataObjTree[sourceDataObjTree.length - 1]; //get last object in tree
                if (targetCollectionPaths.includes(sourceCollectionPath)) {
                    let dataRow = generateDataRow(sourceDataObjTree);
                    retval.push(dataRow);
                }
                else {
                    for (const key of Object.keys(sourceDataObj)) {
                        if (Array.isArray(sourceDataObj[key]) && targetCollectionPaths.some(p => p.startsWith(`${sourceCollectionPath}.${key}`))) { //check if key is array and is part of target collection path
                            for (let i = 0; i < sourceDataObj[key].length; i++) { //iterate through each array item
                                sourceDataObjTree.push(sourceDataObj[key][i]); //push to object tree
                                iterateCollectionPathObject(`${sourceCollectionPath}.${key}`, targetCollectionPaths, sourceDataObjTree); //recursive call
                            }
                        }
                    }
                }
            };
            let collectionTree = targetTable.collectionPaths[0].split('.');
            let collectionName = collectionTree[0]; //extract collection name
            let collectionData = this.lstCollectionDataCache.get(collectionName) || [];
            //check for filter condition
            if (targetTable.filter) {
                let filterField = targetTable.filter.field;
                let filterValue = targetTable.filter.value;
                if (targetTable.filter.operator == '==') {
                    collectionData = collectionData.filter(p => p[filterField] == filterValue);
                }
                else if (targetTable.filter.operator == '!=') {
                    collectionData = collectionData.filter(p => p[filterField] != filterValue);
                }
                else if (targetTable.filter.operator == '>') {
                    collectionData = collectionData.filter(p => p[filterField] > filterValue);
                }
                else if (targetTable.filter.operator == '>=') {
                    collectionData = collectionData.filter(p => p[filterField] >= filterValue);
                }
                else if (targetTable.filter.operator == '<') {
                    collectionData = collectionData.filter(p => p[filterField] < filterValue);
                }
                else if (targetTable.filter.operator == '<=') {
                    collectionData = collectionData.filter(p => p[filterField] <= filterValue);
                }
                else
                    ;
            }
            //iterate through each collection data object to generate data rows
            for (let i = 0; i < collectionData.length; i++) {
                iterateCollectionPathObject(collectionName, targetTable.collectionPaths, [collectionData[i]]);
            }
        }
        catch (err) {
            logger.logError(`tally.populateTableFromCollectionData(${targetTable.name})`, err);
            throw err;
        }
        return retval;
    }
    parseTallyDataTypeValue(dataType, rawValue) {
        let retval = undefined;
        try {
            if (dataType === 'Date') {
                if (rawValue.length === 8) { //expected format YYYYMMDD
                    //convert to YYYY-MM-DD format
                    let partYear = rawValue.substring(0, 4);
                    let partMonth = rawValue.substring(4, 6);
                    let partDay = rawValue.substring(6);
                    let dateString = `${partYear}-${partMonth}-${partDay}`;
                    retval = new Date(dateString);
                }
                else {
                    retval = null; //null date value
                }
            }
            else if (dataType === 'Logical') {
                retval = rawValue === 'Yes'; //boolean value
            }
            else if (dataType === 'Number' || dataType === 'Amount') {
                rawValue = rawValue.trim(); //remove spaces from beginning & end
                if (rawValue.includes('=')) { //forex expression
                    rawValue = rawValue.split('=')[1].trim(); //extract numeric part after equal sign
                    rawValue = rawValue.replace(/[^0-9\.\-]/g, ''); //remove non-numeric characters
                }
                retval = parseFloat(rawValue); //convert to number
                if (isNaN(retval)) { //invalid number, set to zero
                    retval = 0;
                }
            }
            else if (dataType === 'Quantity') {
                rawValue = rawValue.trim(); //remove leading spaces
                retval = parseFloat(rawValue.split(' ')[0]); //extract numeric part by splitting at first space
                if (isNaN(retval)) { //invalid number, set to zero
                    retval = 0;
                }
            }
            else if (dataType === 'Rate') {
                rawValue = rawValue.trim(); //remove leading spaces
                if (rawValue.includes('=')) { //forex expression
                    rawValue = rawValue.split('=')[1].trim(); //extract numeric part after equal sign
                    rawValue = rawValue.split('/')[0]; //extract numeric part by splitting at first slash
                    rawValue = rawValue.replace(/[^0-9\.\-]/g, ''); //remove non-numeric characters
                    retval = parseFloat(rawValue);
                }
                else {
                    retval = parseFloat(rawValue.split('/')[0]); //extract numeric part by splitting at first slash
                }
                if (isNaN(retval)) { //invalid number, set to zero
                    retval = 0;
                }
            }
            else if (dataType === 'Due Date') {
                rawValue = rawValue.trim(); //remove spaces from beginning & end
                if (/^\d+\sDays$/g.test(rawValue)) {
                    let numDays = parseInt(rawValue.replace(' Days', ''));
                    retval = isNaN(numDays) ? 0 : numDays;
                }
                else {
                    retval = 0;
                }
            }
            else if (dataType === 'String') {
                retval = utility.String.unescapeHTML(rawValue); //unescaped string value
                retval = retval.replace(/\t/g, ''); //replace tab with space
            }
            else
                ;
        }
        catch (err) {
            logger.logError(`tally.parseTallyDataTypeValue()`, err);
        }
        return retval;
    }
    parseXmlToJsonCollection(targetCollection, xmlContent = "") {
        return new Promise(async (resolve, reject) => {
            try {
                let retval = [];
                //create realdline interface to read XML file line by line
                const fileStream = xmlContent ? stream.Readable.from(xmlContent) : fs.createReadStream(`./csv/${targetCollection}.xml`, { encoding: 'utf16le' });
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });
                let isParsingCollection = false;
                let isParsingSubList = false;
                let isParsingArrayList = false;
                let isQtyPositive = false;
                let lstPathTree = [];
                let lastDataType = '';
                rl.on('line', (line) => {
                    const extractTargetObject = () => {
                        //extract last object item from retval
                        let lastIdx = retval.length - 1;
                        let targetObj = retval[lastIdx];
                        //iterate through path tree to reach target object
                        for (let i = 0; i < lstPathTree.length; i++) {
                            let pathPart = lstPathTree[i];
                            if (pathPart in targetObj && Array.isArray(targetObj[pathPart])) {
                                lastIdx = targetObj[pathPart].length - 1;
                                targetObj = targetObj[pathPart][lastIdx];
                            }
                        }
                        return targetObj;
                    };
                    line = line.trim(); //remove leading & trailing spaces
                    if (line == `<${targetCollection.toUpperCase()}>` || line.startsWith(`<${targetCollection.toUpperCase()} `)) { //check if line is start of collection item
                        isParsingCollection = true; //indicate flag for reading collection item
                        let currObj = {}; //initialize new object
                        //check if NAME attribute is present to assign name property
                        if (line.startsWith(`<${targetCollection.toUpperCase()} NAME=`)) {
                            let reName = /NAME=\"([^\"]+)\"/g.exec(line);
                            let itemName = reName ? reName[1] : '';
                            Object.defineProperty(currObj, 'name', { value: itemName, writable: true, enumerable: true, configurable: true });
                        }
                        retval.push(currObj);
                    }
                    else if (line.startsWith(`</${targetCollection.toUpperCase()}>`)) { //check if line is end of collection item
                        isParsingCollection = false; //reset flag
                    }
                    else if (isParsingCollection && /\<([_A-Z]+)\sTYPE=\"([a-zA-Z]+)\"\>([^\<]*)\<\/[_A-Z]+\>/.test(line)) { //check if line is field data with data type
                        let reField = /\<([_A-Z]+)\sTYPE=\"([a-zA-Z]+)\"\>([^\<]*)\<\/[_A-Z]+\>/g.exec(line);
                        //extract field name, data type & raw value
                        let fieldName = reField ? reField[1].toLowerCase() : '';
                        let dataType = reField ? reField[2] : '';
                        let rawValue = reField ? reField[3] : '';
                        let value = this.parseTallyDataTypeValue(dataType, rawValue); //convert raw value to appropriate data type
                        //assign positive / negative quantity state flag using IsDeemedPositive field
                        if (fieldName == 'isdeemedpositive' && dataType == 'Logical') {
                            isQtyPositive = !!value;
                        }
                        //assign quantity sign based on IsDeemedPositive field (only for sub-list field)
                        if (isParsingSubList && dataType == 'Quantity' && !isQtyPositive) {
                            value = -Math.abs(value);
                        }
                        //assign field to current object
                        let targetObject = extractTargetObject(); //get target object to which field belongs
                        Object.defineProperty(targetObject, fieldName, { value: value, writable: true, enumerable: true, configurable: true });
                    }
                    else if (isParsingCollection && /\<([_A-Z]+)\>([^\<]*)\<\/[_A-Z]+\>/.test(line)) { //check if line is field data without data type
                        let reField = /\<([_A-Z]+)\>([^\<]*)\<\/[_A-Z]+\>/g.exec(line);
                        //extract field name & raw value
                        let fieldName = reField ? reField[1].toLowerCase() : '';
                        let rawValue = reField ? reField[2] : '';
                        let value = this.parseTallyDataTypeValue(isParsingArrayList ? lastDataType : 'String', rawValue); //convert raw value to appropriate data type using last known data type
                        //push value to current object
                        let targetObject = extractTargetObject(); //get target object to which field belongs
                        if (isParsingArrayList && Array.isArray(targetObject[fieldName])) {
                            targetObject[fieldName].push(value);
                        }
                        else {
                            Object.defineProperty(targetObject, fieldName, { value: value, writable: true, enumerable: true, configurable: true });
                        }
                    }
                    else if (isParsingCollection && /^\<[A-Z]+\.LIST(\sTYPE=\"[\w]+\")?\>$/g.test(line)) { //check if line is start of sub-list
                        isParsingSubList = true;
                        let reList = /^\<([A-Z]+)\.LIST(\sTYPE=\"[\w]+\")?\>$/g.exec(line);
                        let listName = reList ? reList[1].toLowerCase() : ''; //extract sub-collection name
                        //check if list has data type attribute
                        if (reList && reList.length > 2 && reList[2]) {
                            lastDataType = reList[2].replace(' TYPE="', '').replace('"', ''); //store last data type
                            isParsingArrayList = true; //plain data type array list
                        }
                        else {
                            isParsingArrayList = false;
                        }
                        let targetObject = extractTargetObject(); //get target object to which sub-list belongs
                        //check if sub-list property is already present, if not create new array property
                        if (!(listName in targetObject)) {
                            Object.defineProperty(targetObject, listName, { value: [], writable: true, enumerable: true, configurable: true });
                        }
                        if (!isParsingArrayList) {
                            targetObject[listName].push({}); //append new object to sub-list array
                            lstPathTree.push(listName); //push to path tree
                        }
                    }
                    else if (isParsingCollection && /^\<\/[A-Z]+\.LIST\>$/g.test(line)) { //check if line is end of sub-list
                        isParsingSubList = false; //reset sub-list flag
                        isParsingArrayList = false; //reset array list flag
                        lstPathTree.pop(); //pop from path tree
                    }
                    else
                        ;
                });
                rl.on('close', () => {
                    resolve(retval);
                });
            }
            catch (err) {
                reject(err);
                logger.logError(`tally.parseXmlToJsonCollection()`, err);
            }
        });
    }
    generateVoucherDatewiseCount() {
        return new Promise(async (resolve, reject) => {
            try {
                let retval = [];
                let objTallyCollectionConfig = {
                    collection: 'voucher',
                    filters: [
                        {
                            name: 'IsNonOptionalCancelledVchs'
                        }
                    ],
                    by: ['Date : $Date'],
                    aggrcompute: ['Count : SUM : $$Number:1']
                };
                let xmlPayload = this.generateCollectionRequestXMLPayload(objTallyCollectionConfig);
                let xmlContent = await this.postTallyXML(xmlPayload);
                let collectionData = await this.parseXmlToJsonCollection('object', xmlContent);
                for (let i = 0; i < collectionData.length; i++) {
                    let itemDate = utility.Date.parse(collectionData[i]['date'], 'd-MMM-yy') || new Date(0);
                    let itemCount = parseInt(collectionData[i]['count']);
                    retval.push([itemDate, itemCount]);
                }
                resolve(retval);
            }
            catch (err) {
                logger.logError(`tally.generateVoucherDatewiseCount()`, err);
                reject(err);
            }
        });
    }
}
let tally = new _tally();
export { tally };
//# sourceMappingURL=tally.mjs.map