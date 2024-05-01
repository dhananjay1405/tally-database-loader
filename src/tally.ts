import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as http from 'http';
import * as yaml from 'js-yaml';
import { utility } from './utility.js';
import { logger } from './logger.js';
import { database } from './database.js';
import { BigQuery } from '@google-cloud/bigquery';
import { tallyConfig, tableConfigYAML } from './definition.js';

let bigquery: BigQuery;

class _tally {

    private config: tallyConfig;
    private lstTableMaster: tableConfigYAML[] = [];
    private lstTableTransaction: tableConfigYAML[] = [];

    //hidden commandline flags
    private importMaster = true;
    private importTransaction = true;
    private truncateTable = true;

    constructor() {
        try {
            this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['tally'];
            let objYAML: any = yaml.load(fs.readFileSync('./tally-export-config.yaml', 'utf-8'));
            this.lstTableMaster = objYAML['master'];
            this.lstTableTransaction = objYAML['transaction'];
        } catch (err) {
            this.config = {
                server: 'localhost',
                port: 9000,
                company: '',
                fromdate: 'auto',
                todate: 'auto',
                sync: 'full'
            };
            logger.logError('tally()', err);
            throw err;
        }
    }

    updateCommandlineConfig(lstConfigs: Map<string, string>): void {
        try {
            if (lstConfigs.has('tally-server')) this.config.server = lstConfigs.get('tally-server') || '';
            if (lstConfigs.has('tally-port')) this.config.port = parseInt(lstConfigs.get('tally-port') || '9000');
            if (lstConfigs.has('tally-fromdate') && lstConfigs.has('tally-todate')) {
                let fromDate = lstConfigs.get('tally-fromdate') || '';
                let toDate = lstConfigs.get('tally-todate') || '';
                this.config.fromdate = /^\d{4}\d{2}\d{2}$/g.test(fromDate) ? fromDate : 'auto';
                this.config.todate = /^\d{4}\d{2}\d{2}$/g.test(toDate) ? toDate : 'auto';
            }
            if (lstConfigs.has('tally-sync')) this.config.sync = lstConfigs.get('tally-sync') || 'full';
            if (lstConfigs.has('tally-company')) this.config.company = lstConfigs.get('tally-company') || '';

            //flags
            if (lstConfigs.has('tally-master')) this.importMaster = lstConfigs.get('tally-master') == 'true';
            if (lstConfigs.has('tally-transaction')) this.importTransaction = lstConfigs.get('tally-transaction') == 'true';
            if (lstConfigs.has('tally-truncate')) this.truncateTable = lstConfigs.get('tally-truncate') == 'true';
        } catch (err) {
            logger.logError('tally.updateCommandlineConfig()', err);
            throw err;
        }
    }

    importData(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {

                logger.logMessage('Tally to Database | version: 1.0.26');

                if (this.config.sync == 'incremental') {
                    if (/^(mssql|postgres)$/g.test(database.config.technology)) {

                        //set mandatory config required for incremental sync
                        this.config.fromdate = 'auto';
                        this.config.todate = 'auto';
                        database.config.loadmethod = 'insert';

                        //update active company information before starting import
                        logger.logMessage('Updating company information configuration table [%s]', new Date().toLocaleDateString());
                        await this.saveCompanyInfo();

                        //delete and re-create CSV folder
                        if (fs.existsSync('./csv'))
                            fs.rmSync('./csv', { recursive: true });
                        fs.mkdirSync('./csv');

                        //prepare substitution list of runtime values to reflected in TDL XML
                        let configTallyXML = new Map<string, any>();
                        configTallyXML.set('fromDate', utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                        configTallyXML.set('toDate', utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));
                        configTallyXML.set('targetCompany', this.config.company ? utility.String.escapeHTML(this.config.company) : '##SVCurrentCompany');

                        logger.logMessage('Performing incremental sync [%s]', new Date().toLocaleString());

                        //delete and re-create diff table
                        await database.executeNonQuery('drop table if exists _diff');
                        await database.executeNonQuery('create table _diff (guid varchar(64) not null, alterid int not null)');
                        await database.executeNonQuery('drop table if exists _delete');
                        await database.executeNonQuery('create table _delete (guid varchar(64) not null)');

                        //acquire last AlterID of master & transaction from database
                        let lstPrimaryMasterTableNames = this.lstTableMaster.filter(p => p.nature == 'Primary').map(p => p.name);
                        let sqlQuery = 'select max(coalesce(t.alterid,0)) from (';
                        lstPrimaryMasterTableNames.forEach(p => sqlQuery += ` select max(alterid) from ${p} union`);
                        sqlQuery = utility.String.strip(sqlQuery, 5);
                        sqlQuery += ') as t';
                        let lastAlterIdMaster = await database.executeScalar<number>(sqlQuery) || 0;
                        let lastAlterIdTransaction = await database.executeScalar<number>('select max(coalesce(alterid,0)) from trn_voucher') || 0;

                        //iterate through all the Primary type of tables
                        let lstPrimaryTables = this.lstTableMaster.filter(p => p.nature == 'Primary');
                        lstPrimaryTables.push(...this.lstTableTransaction.filter(p => p.nature == 'Primary'));
                        for (let i = 0; i < lstPrimaryTables.length; i++) {
                            let activeTable = lstPrimaryTables[i];
                            await database.executeNonQuery('truncate table _diff;');
                            await database.executeNonQuery('truncate table _delete;');
                            let tempTable: tableConfigYAML = {
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
                            if (Array.isArray(activeTable.cascade_delete) && activeTable.cascade_delete.length)
                                for (let j = 0; j < activeTable.cascade_delete.length; j++) {
                                    let targetTable = activeTable.cascade_delete[j].table;
                                    let targetField = activeTable.cascade_delete[j].field;
                                    await database.executeNonQuery(`delete from ${targetTable} where ${targetField} in (select guid from _delete);`);
                                }
                        }

                        // iterate through all Master and Transaction tables to extract modifed and added rows in Tally data
                        for (let i = 0; i < this.lstTableMaster.length; i++) {
                            let activeTable = this.lstTableMaster[i];

                            //add AlterID filter
                            if (!Array.isArray(activeTable.filters))
                                activeTable.filters = [];
                            activeTable.filters.push(`$AlterID > ${lastAlterIdMaster}`);

                            let targetTable = activeTable.name;
                            await this.processReport(targetTable, activeTable, configTallyXML);
                            await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable, activeTable.fields.map(p => p.type));
                            fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                            logger.logMessage('  syncing table %s', targetTable);
                        }

                        for (let i = 0; i < this.lstTableTransaction.length; i++) {
                            let activeTable = this.lstTableTransaction[i];

                            //add AlterID filter
                            if (!Array.isArray(activeTable.filters))
                                activeTable.filters = [];
                            activeTable.filters.push(`$AlterID > ${lastAlterIdTransaction}`);

                            let targetTable = activeTable.name;
                            await this.processReport(targetTable, activeTable, configTallyXML);
                            await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable, activeTable.fields.map(p => p.type));
                            fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                            logger.logMessage('  syncing table %s', targetTable);
                        }

                        // process foreign key updates to derived table fields
                        for (let i = 0; i < lstPrimaryTables.length; i++) {
                            let activeTable = lstPrimaryTables[i];
                            if (Array.isArray(activeTable.cascade_update) && activeTable.cascade_update.length)
                                for (let j = 0; j < activeTable.cascade_update.length; j++) {
                                    let targetTable = activeTable.cascade_update[j].table;
                                    let targetField = activeTable.cascade_update[j].field;
                                    await database.executeNonQuery(`update t set t.${targetField} = s.name from ${targetTable} as t join ${activeTable.name} as s on s.guid = t._${targetField} ;`);
                                }
                        }

                        //check if any Voucher Type is set to auto numbering
                        //automatic voucher number shifts voucher numbers of all subsequent date vouchers on insertion of in-between which requires updation
                        let countAutoNumberVouchers = await database.executeNonQuery(`select count(*) as c from mst_vouchertype where numbering_method like '%Auto%' ;`);
                        if (countAutoNumberVouchers) {
                            await database.executeNonQuery('drop table if exists _vchnumber;');
                            await database.executeNonQuery('create table _vchnumber (guid varchar(64) not null, voucher_number varchar(256) not null);');

                            //pull list of voucher numbers for all the vouchers
                            let activeTable = this.lstTableTransaction.filter(p => p.name = 'trn_voucher')[0];
                            if (Array.isArray(activeTable.filters))
                                activeTable.filters.splice(activeTable.filters.length - 1, 1); //remove AlterID filter
                            let tempTable: tableConfigYAML = {
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
                                filters: activeTable.filters
                            };

                            await this.processReport('_vchnumber', tempTable, configTallyXML);
                            await database.bulkLoad(path.join(process.cwd(), `./csv/_vchnumber.data`), '_vchnumber', tempTable.fields.map(p => p.type)); //upload to temporary table
                            fs.unlinkSync(path.join(process.cwd(), `./csv/_vchnumber.data`)); //delete temporary file

                            //update voucher number with fresh copy
                            await database.executeNonQuery('update t set t.voucher_number = s.voucher_number from trn_voucher as t join _vchnumber as s on s.guid = t.guid');
                        }

                        //drop all temporary types of tables created for incremental sync
                        await database.executeNonQuery('drop table _diff;');
                        await database.executeNonQuery('drop table _delete;');
                        await database.executeNonQuery('drop table _vchnumber;');

                    }
                    else
                        logger.logMessage('Incremental Sync is supported only for SQL Server / PostgreSQL');
                }
                else { // assume default as full
                    let lstTables: tableConfigYAML[] = [];
                    if (this.importMaster) {
                        lstTables.push(...this.lstTableMaster);
                    }
                    if (this.importTransaction) {
                        lstTables.push(...this.lstTableTransaction);
                    }

                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        //update active company information before starting import
                        logger.logMessage('Updating company information configuration table [%s]', new Date().toLocaleDateString());
                        await this.saveCompanyInfo();
                    }
                    else if (database.config.technology == 'bigquery') {
                        bigquery = new BigQuery({
                            keyFilename: './bigquery-credentials.json'
                        });
                    }
                    else;

                    //prepare substitution list of runtime values to reflected in TDL XML
                    let configTallyXML = new Map<string, any>();
                    configTallyXML.set('fromDate', utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                    configTallyXML.set('toDate', utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));
                    configTallyXML.set('targetCompany', this.config.company ? utility.String.escapeHTML(this.config.company) : '##SVCurrentCompany');

                    if (this.truncateTable) {
                        if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                            await database.truncateTables(lstTables.map(p => p.name)); //truncate tables
                        }
                    }
                        

                    //delete and re-create CSV folder
                    if (fs.existsSync('./csv')) {
                        fs.rmSync('./csv', { recursive: true });
                    }
                    fs.mkdirSync('./csv');

                    //dump data exported from Tally to CSV file required for bulk import
                    logger.logMessage('Generating CSV files from Tally [%s]', new Date().toLocaleString());
                    for (let i = 0; i < lstTables.length; i++) {
                        let timestampBegin = Date.now();
                        let targetTable = lstTables[i].name;
                        await this.processReport(targetTable, lstTables[i], configTallyXML);
                        let timestampEnd = Date.now();
                        let elapsedSecond = utility.Number.round((timestampEnd - timestampBegin) / 1000, 3);
                        logger.logMessage('  saving file %s.csv [%f sec]', targetTable, elapsedSecond);
                    }


                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        //perform CSV file based bulk import into database
                        logger.logMessage('Loading CSV files to database tables [%s]', new Date().toLocaleString());
                        for (let i = 0; i < lstTables.length; i++) {
                            let targetTable = lstTables[i].name;
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable, lstTables[i].fields.map(p => p.type));
                            fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                        }
                        fs.rmdirSync('./csv'); //remove directory

                    }
                    else if (database.config.technology == 'csv' || database.config.technology == 'json' || database.config.technology == 'bigquery' || database.config.technology == 'adls') {

                        if (database.config.technology == 'bigquery') {
                            logger.logMessage('Loading CSV files to BigQuery tables [%s]', new Date().toLocaleString());
                        }

                        //remove special character of date from CSV files, which was inserted for null dates
                        for (let i = 0; i < lstTables.length; i++) {
                            let targetTable = lstTables[i].name;
                            let lstFieldTypes = lstTables[i].fields.map(p => p.type);
                            let content = fs.readFileSync(`./csv/${targetTable}.data`, 'utf-8');
                            if(database.config.technology == 'json') {
                                content = JSON.stringify(database.csvToJsonArray(content, targetTable, lstFieldTypes));
                            }
                            else {
                                content = database.convertCSV(content, lstFieldTypes);
                            }
                            fs.writeFileSync(`./csv/${targetTable}.${database.config.technology == 'json' ? 'json' : 'csv'}`, '\ufeff' + content);
                            fs.unlinkSync(`./csv/${targetTable}.data`); //delete raw file
                            if (database.config.technology == 'bigquery') {
                                const [job] = await bigquery.dataset(database.config.schema).table(targetTable).load(`./csv/${targetTable}.csv`, {
                                    sourceFormat: 'CSV',
                                    skipLeadingRows: 1,
                                    writeDisposition: 'WRITE_TRUNCATE'
                                });
                                logger.logMessage('  %s: imported %d rows', targetTable, parseInt(job.statistics?.load?.outputRows || '0'));
                            }

                        }

                        //upload CSV files to Azure Data Lake
                        if (database.config.technology == 'adls') {
                            await database.uploadAzureDataLake(lstTables);
                        }
                    }
                    else;
                }

                resolve();
            } catch (err) {
                logger.logError('tally.importData()', err);
                reject(err);
            }
        });
    }

    private postTallyXML(msg: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
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
                },
                    (res) => {
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
                                logger.logMessage('Unable to connect with Tally');
                                reject(httpErr);
                                logger.logError('tally.postTallyXML()', httpErr);
                            });
                    });
                req.on('error', (reqError) => {
                    reject(reqError);
                    logger.logError('tally.postTallyXML()', reqError);
                });
                req.write(msg, 'utf16le');
                req.end();
            } catch (err) {
                reject(err);
                logger.logError('tally.postTallyXML()', err);
            }
        });
    };

    private substituteTDLParameters(msg: string, substitutions: Map<string, any>): string {
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
                else;
            });

        } catch (err) {
            logger.logError('tally.substituteTDLParameters()', err);
        }
        return retval;
    }

    private processTdlOutputManipulation(txt: string): string {
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
        } catch (err) {
            logger.logError('tally.processTdlOutputManipulation()', err);
        }

        return retval;
    }

    private processReport(targetTable: string, tableConfig: tableConfigYAML, substitutions?: Map<string, any>): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let xml = this.generateXMLfromYAML(tableConfig);
                if (substitutions && substitutions.size)
                    xml = this.substituteTDLParameters(xml, substitutions);

                let output = await this.postTallyXML(xml);
                output = this.processTdlOutputManipulation(output);

                let columnHeaders = tableConfig.fields.map(p => p.name).join('\t');
                fs.writeFileSync(`./csv/${targetTable}.data`, columnHeaders + output);

                resolve();
            } catch (err) {
                logger.logError(`tally.processMasterReport(${targetTable})`, err);
                reject(err);
            }
        });
    }

    private saveCompanyInfo(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let xmlCompany = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReport</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>ASCII (Comma Delimited)</SVEXPORTFORMAT><SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReport"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart</PARTS></FORM><PART NAME="MyPart"><LINES>MyLine</LINES><REPEAT>MyLine : MyCollection</REPEAT><SCROLLED>Vertical</SCROLLED></PART><LINE NAME="MyLine"><FIELDS>FldGuid,FldName,FldBooksFrom,FldLastVoucherDate,FldEOL</FIELDS></LINE><FIELD NAME="FldGuid"><SET>$Guid</SET></FIELD><FIELD NAME="FldName"><SET>$$StringFindAndReplace:$Name:'"':'""'</SET></FIELD><FIELD NAME="FldBooksFrom"><SET>(($$YearOfDate:$BooksFrom)*10000)+(($$MonthOfDate:$BooksFrom)*100)+(($$DayOfDate:$BooksFrom)*1)</SET></FIELD><FIELD NAME="FldLastVoucherDate"><SET>(($$YearOfDate:$LastVoucherDate)*10000)+(($$MonthOfDate:$LastVoucherDate)*100)+(($$DayOfDate:$LastVoucherDate)*1)</SET></FIELD><FIELD NAME="FldEOL"><SET>†</SET></FIELD><COLLECTION NAME="MyCollection"><TYPE>Company</TYPE><FILTER>FilterActiveCompany</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="FilterActiveCompany">$$IsEqual:##SVCurrentCompany:$Name</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
                if (!this.config.company) //remove complete SVCURRENTCOMPANY tag if no target company is specified
                    xmlCompany = xmlCompany.replace('<SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY>', '');
                else
                    xmlCompany = xmlCompany.replace('{targetCompany}', this.config.company);
                let strCompanyInfo = await this.postTallyXML(xmlCompany); //extract active company information
                if (strCompanyInfo.endsWith(',"†",\r\n')) {
                    strCompanyInfo = strCompanyInfo.replace(/\",\"†\",\r\n/g, '').substr(1);
                    let lstCompanyInfoParts = strCompanyInfo.split(/\",\"/g);
                    let companyName = lstCompanyInfoParts[1];
                    companyName = companyName.replace(/'/g, '\\"');
                    if (this.config.fromdate == 'auto' || this.config.todate == 'auto') { //auto assign from/to from company info for detection mode
                        this.config.fromdate = lstCompanyInfoParts[2];
                        this.config.todate = lstCompanyInfoParts[3];
                    }

                    //clear config table of database and insert active company info to config table
                    if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                        await database.executeNonQuery('truncate table config;');
                        await database.executeNonQuery(`insert into config(name,value) values('Update Timestamp','${new Date().toLocaleString()}'),('Company Name','${companyName}'),('Period From','${this.config.fromdate}'),('Period To','${this.config.todate}');`);
                    }
                    else if (database.config.technology == 'bigquery') {
                        await bigquery.dataset(database.config.schema).createQueryJob('truncate table config');
                        await bigquery.dataset(database.config.schema).createQueryJob(`insert into config(name,value) values('Update Timestamp','${new Date().toLocaleString()}'),('Company Name','${companyName}'),('Period From','${this.config.fromdate}'),('Period To','${this.config.todate}');`);
                    }
                }
                else {
                    reject('Cannot detect First/Last voucher date from company');
                }
                resolve();
            } catch (err: any) {
                let errorMessage = '';
                if (err['code'] == 'ECONNREFUSED') errorMessage = 'Unable to communicate with Tally of specified port';

                logger.logError(`tally.saveCompanyInfo()`, errorMessage || err);
                reject('');
            }
        });
    }

    private generateXMLfromYAML(tblConfig: tableConfigYAML): string {

        let retval = '';
        try {
            //XML header
            retval = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReportLedgerTable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>XML (Data Interchange)</SVEXPORTFORMAT><SVFROMDATE>{fromDate}</SVFROMDATE><SVTODATE>{toDate}</SVTODATE><SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReportLedgerTable"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart01</PARTS></FORM>`;

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
        } catch (err) {
            logger.logError(`tally.generateXMLfromYAML()`, err);
        }
        return retval;
    }

}
let tally = new _tally();

export { tally };
