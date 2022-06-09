import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as http from 'http';
import * as yaml from 'js-yaml';
import { utility } from './utility.js';
import { logger } from './logger.js';
import { database } from './database.js';
import { BigQuery } from '@google-cloud/bigquery';

let bigquery: BigQuery;

interface tallyConfig {
    server: string;
    port: number;
    master: boolean;
    transaction: boolean;
    fromdate: string;
    todate: string;
    company: string;
}

interface fieldConfigYAML {
    name: string;
    field: string;
    type: string;
}

interface tableConfigYAML {
    name: string;
    collection: string;
    fields: fieldConfigYAML[];
    filters?: string[];
    fetch?: string[];
}

class _tally {

    private config: tallyConfig;
    private lstTableMaster: tableConfigYAML[] = [];
    private lstTableTransaction: tableConfigYAML[] = [];

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
                master: true,
                transaction: true
            };
            logger.logError('tally()', err);
            throw err;
        }

    }

    updateCommandlineConfig(lstConfigs: Map<string, string>): void {
        try {
            if (lstConfigs.has('tally-server')) this.config.server = lstConfigs.get('tally-server') || '';
            if (lstConfigs.has('tally-port')) this.config.port = parseInt(lstConfigs.get('tally-port') || '9000');
            if (lstConfigs.has('tally-master')) this.config.master = lstConfigs.get('tally-master') == 'true';
            if (lstConfigs.has('tally-transaction')) this.config.transaction = lstConfigs.get('tally-transaction') == 'true';
            if (lstConfigs.has('tally-fromdate') && lstConfigs.has('tally-todate')) {
                let fromDate = lstConfigs.get('tally-fromdate') || '';
                let toDate = lstConfigs.get('tally-todate') || '';
                this.config.fromdate = /^\d{4}\d{2}\d{2}$/g.test(fromDate) ? fromDate : 'auto';
                this.config.todate = /^\d{4}\d{2}\d{2}$/g.test(toDate) ? toDate : 'auto';
            }
            if (lstConfigs.has('tally-company')) this.config.company = lstConfigs.get('tally-company') || '';
        } catch (err) {
            logger.logError('tally.updateCommandlineConfig()', err);
            throw err;
        }
    }

    importData(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {

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

                if (/^(mssql|mysql|postgres|bigquery)$/g.test(database.config.technology)) {
                    //truncate master/transaction tables
                    logger.logMessage('Erasing database');
                    for (let i = 0; i < this.lstTableMaster.length; i++) {
                        let targetTable = this.lstTableMaster[i].name;
                        await database.execute(`truncate table ${targetTable};`);
                    }
                    for (let i = 0; i < this.lstTableTransaction.length; i++) {
                        let targetTable = this.lstTableTransaction[i].name;
                        await database.execute(`truncate table ${targetTable};`);
                    }
                }

                //delete and re-create CSV folder
                if (fs.existsSync('./csv'))
                    fs.rmSync('./csv', { recursive: true });
                fs.mkdirSync('./csv');

                //dump data exported from Tally to CSV file required for bulk import
                logger.logMessage('Generating CSV files from Tally [%s]', new Date().toLocaleString());
                if (this.config.master)
                    for (let i = 0; i < this.lstTableMaster.length; i++) {
                        let timestampBegin = Date.now();
                        let targetTable = this.lstTableMaster[i].name;
                        await this.processReport(targetTable, this.lstTableMaster[i], configTallyXML);
                        let timestampEnd = Date.now();
                        let elapsedSecond = utility.Number.round((timestampEnd - timestampBegin) / 1000, 3);
                        logger.logMessage('  saving file %s.csv [%f sec]', targetTable, elapsedSecond);
                    }

                if (this.config.transaction)
                    for (let i = 0; i < this.lstTableTransaction.length; i++) {
                        let timestampBegin = Date.now();
                        let targetTable = this.lstTableTransaction[i].name;
                        await this.processReport(targetTable, this.lstTableTransaction[i], configTallyXML);
                        let timestampEnd = Date.now();
                        let elapsedSecond = utility.Number.round((timestampEnd - timestampBegin) / 1000, 3);
                        logger.logMessage('  saving file %s.csv [%f sec]', targetTable, elapsedSecond);
                    }

                if (/^(mssql|mysql|postgres)$/g.test(database.config.technology)) {
                    //perform CSV file based bulk import into database
                    logger.logMessage('Loading CSV files to database tables [%s]', new Date().toLocaleString());
                    if (this.config.master)
                        for (let i = 0; i < this.lstTableMaster.length; i++) {
                            let targetTable = this.lstTableMaster[i].name;
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable);
                            fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                        }
                    if (this.config.transaction)
                        for (let i = 0; i < this.lstTableTransaction.length; i++) {
                            let targetTable = this.lstTableTransaction[i].name;
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.data`), targetTable);
                            fs.unlinkSync(path.join(process.cwd(), `./csv/${targetTable}.data`)); //delete raw file
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                        }
                    fs.rmdirSync('./csv'); //remove directory
                }
                else if (database.config.technology == 'csv' || database.config.technology == 'bigquery') {

                    if (database.config.technology == 'bigquery')
                        logger.logMessage('Loading CSV files to BigQuery tables [%s]', new Date().toLocaleString());

                    //remove special character of date from CSV files, which was inserted for null dates
                    if (this.config.master)
                        for (let i = 0; i < this.lstTableMaster.length; i++) {
                            let targetTable = this.lstTableMaster[i].name;
                            let content = fs.readFileSync(`./csv/${targetTable}.data`, 'utf-8');
                            content = this.substituteCSV(content);
                            fs.writeFileSync(`./csv/${targetTable}.csv`, '\ufeff' + content);
                            fs.unlinkSync(`./csv/${targetTable}.data`); //delete raw file
                            if (database.config.technology == 'bigquery') {
                                const [job] = await bigquery.dataset(database.config.schema).table(targetTable).load(`./csv/${targetTable}.csv`, {
                                    sourceFormat: 'CSV',
                                    skipLeadingRows: 1,
                                    writeDisposition: 'WRITE_TRUNCATE'
                                });
                                logger.logMessage('  %s: imported', targetTable);
                            }
                        }
                    if (this.config.transaction)
                        for (let i = 0; i < this.lstTableTransaction.length; i++) {
                            let targetTable = this.lstTableTransaction[i].name;
                            let content = fs.readFileSync(`./csv/${targetTable}.data`, 'utf-8');
                            content = this.substituteCSV(content);
                            fs.writeFileSync(`./csv/${targetTable}.csv`, '\ufeff' + content);
                            fs.unlinkSync(`./csv/${targetTable}.data`); //delete raw file
                            if (database.config.technology == 'bigquery') {
                                const [job] = await bigquery.dataset(database.config.schema).table(targetTable).load(`./csv/${targetTable}.csv`, {
                                    sourceFormat: 'CSV',
                                    skipLeadingRows: 1,
                                    writeDisposition: 'WRITE_TRUNCATE'
                                });
                                logger.logMessage('  %s: imported', targetTable);
                            }
                        }
                }
                else;

                resolve();
            } catch (err) {
                logger.logError('tally.processMasters()', err);
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

    private substituteCSV(content: string): string {
        content = content.replace(/ñ/g, ''); //replace blank date with empty text
        content = content.replace(/\"/g, '""'); //escape double quotes with 2 instance of double quotes (as per ISO)
        content = content.replace(/æ/g, '"'); //replace field quote with double quote
        return content;
    }

    private processTdlOutputManipulation(txt: string): string {
        let retval = txt;
        try {
            retval = retval.replace(/[\r\n\t]/g, ''); //remove line terminators and tabs
            retval = retval.replace(/\x04\s/g, ''); //remove system reserved symbols
            retval = retval.replace(/õ/g, ''); //remove empty character indicator (as defined in TDL)
            retval = retval.replace(/,\"†\",/g, '\r\n'); //substitute end of field terminators indicator (as defined in TDL) with proper line terminators
            retval = retval.replace(/\"/g, 'æ'); //get rid of double quotes used as field quotes
            retval = retval.replace(/ø/g, '"'); //restore back the double quotes inside field value
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

                let columnHeaders = tableConfig.fields.map(p => p.name).join(',') + '\r\n';
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
                        await database.execute('truncate table config;');
                        await database.execute(`insert into config(name,value) values('Update Timestamp','${new Date().toLocaleString()}'),('Company Name','${companyName}'),('Period From','${this.config.fromdate}'),('Period To','${this.config.todate}');`);
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
            retval = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReportLedgerTable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>ASCII (Comma Delimited)</SVEXPORTFORMAT><SVFROMDATE>{fromDate}</SVFROMDATE><SVTODATE>{toDate}</SVTODATE><SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReportLedgerTable"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart01</PARTS></FORM>`;

            if (!this.config.company) //remove complete SVCURRENTCOMPANY tag if no target company is specified
                retval = retval.replace('<SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY>', '');
            else
                retval = retval.replace('{targetCompany}', this.config.company);

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
            retval += `FldEOL</FIELDS></LINE>`; //End of Field declaration

            //loop through each field
            for (let i = 0; i < tblConfig.fields.length; i++) {
                let fieldXML = `<FIELD NAME="${utility.Number.format(i + 1, 'Fld00')}">`;
                let iField = tblConfig.fields[i];

                //set field TDL XML expression based on type of data
                if (/^(\.\.)?[a-zA-Z0-9_]+$/g.test(iField.field)) {
                    if (iField.type == 'text')
                        fieldXML += `<SET>if $$IsEmpty:$${iField.field} then "õ" else $$StringFindAndReplace:$${iField.field}:'"':"ø"</SET>`;
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

                fieldXML += `</FIELD>`;

                retval += fieldXML;
            }
            retval += `<FIELD NAME="FldEOL"><SET>†</SET></FIELD>`; //End of Field specification
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


/*
    Escape characters used
    ø 248 0xF8 = Substitution for double quote contained in text in Tally
    õ 245 0xF5 = Substitution of blank text in text field of Tally
    ñ 241 0xF1 = Substitution of blank date in Tally
    æ 230 0xE6 = Field quotes replacement for double quotes
*/