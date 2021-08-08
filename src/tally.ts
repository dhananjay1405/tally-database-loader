import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as http from 'http';
import * as yaml from 'js-yaml';
import { utility } from './utility.js';
import { logger } from './logger.js';
import { database } from './database.js';

interface tallyConfig {
    server: string;
    port: number;
    master: boolean;
    transaction: boolean;
    batch: string;
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
        this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['tally'];
        let objYAML: any = yaml.load(fs.readFileSync('./tally-export-config.yaml', 'utf-8'));
        this.lstTableMaster = objYAML['master'];
        this.lstTableTransaction = objYAML['transaction'];
    }

    updateCommandlineConfig(lstConfigs: Map<string, string>): void {
        if (lstConfigs.has('tally-server')) this.config.server = lstConfigs.get('tally-server') || '';
        if (lstConfigs.has('tally-port')) this.config.port = parseInt(lstConfigs.get('tally-port') || '9000');
        if (lstConfigs.has('tally-master')) this.config.master = lstConfigs.get('tally-master') == 'true';
        if (lstConfigs.has('tally-transaction')) this.config.transaction = lstConfigs.get('tally-transaction') == 'true';
        if (lstConfigs.has('tally-fromdate') && lstConfigs.has('tally-todate')) {
            let fromDate = lstConfigs.get('tally-fromdate') || '';
            let toDate = lstConfigs.get('tally-todate') || '';
            this.config.fromdate = /^\d{4}-\d{2}-\d{2}$/g.test(fromDate) ? fromDate : 'auto';
            this.config.todate = /^\d{4}-\d{2}-\d{2}$/g.test(toDate) ? toDate : 'auto';
        }
        if (lstConfigs.has('tally-company')) this.config.company = lstConfigs.get('tally-company') || '';
    }

    importData(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {

                if (/^(mssql|mysql)$/g.test(database.config.technology)) {
                    //update active company information before starting import
                    logger.logMessage('Updating company information configuration table [%s]', new Date().toLocaleDateString());
                    await this.saveCompanyInfo();
                }

                //prepare substitution list of runtime values to reflected in TDL XML
                let configTallyXML = new Map<string, any>();
                configTallyXML.set('fromDate', utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                configTallyXML.set('toDate', utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));
                configTallyXML.set('targetCompany', this.config.company ? utility.String.escapeHTML(this.config.company) : '##SVCurrentCompany');

                if (/^(mssql|mysql)$/g.test(database.config.technology)) {
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

                if (/^(mssql|mysql)$/g.test(database.config.technology)) {
                    //perform CSV file based bulk import into database
                    logger.logMessage('Loading CSV files to database tables [%s]', new Date().toLocaleString());
                    if (this.config.master)
                        for (let i = 0; i < this.lstTableMaster.length; i++) {
                            let targetTable = this.lstTableMaster[i].name;
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.csv`), targetTable);
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                        }
                    if (this.config.transaction)
                        for (let i = 0; i < this.lstTableTransaction.length; i++) {
                            let targetTable = this.lstTableTransaction[i].name;
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.csv`), targetTable);
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                        }
                }
                else {
                    //remove special character of date from CSV files, which was inserted for null dates
                    if (this.config.master)
                        for (let i = 0; i < this.lstTableMaster.length; i++) {
                            let targetTable = this.lstTableMaster[i].name;
                            let content = fs.readFileSync(`./csv/${targetTable}.csv`, 'utf-8');
                            content = content.replace(/\"ñ\"/g, '\"\"');
                            fs.writeFileSync(`./csv/${targetTable}.csv`, '\ufeff' + content);
                        }
                    if (this.config.transaction)
                        for (let i = 0; i < this.lstTableTransaction.length; i++) {
                            let targetTable = this.lstTableTransaction[i].name;
                            let content = fs.readFileSync(`./csv/${targetTable}.csv`, 'utf-8');
                            content = content.replace(/\"ñ\"/g, '\"\"');
                            fs.writeFileSync(`./csv/${targetTable}.csv`, '\ufeff' + content);
                        }
                }

                resolve();
            } catch (err) {
                logger.logError('tally.processMasters()', err);
                reject();
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
        return retval;
    }

    private processTdlOutputManipulation(txt: string): string {
        let retval = txt;
        retval = retval.replace(/[\r\n\t]/g, ''); //remove line terminators and tabs
        retval = retval.replace(/õ/g, ''); //remove empty character indicator (as defined in TDL)
        retval = retval.replace(/\\/g, '\\\\'); //escape single backslash with double
        retval = retval.replace(/,\"†\",/g, '\r\n'); //substitute end of field terminators indicator (as defined in TDL) with proper line terminators
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
                fs.writeFileSync(`./csv/${targetTable}.csv`, columnHeaders + output);

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
                let xmlCompany = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReport</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:ASCII</SVEXPORTFORMAT><SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReport"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart</PARTS></FORM><PART NAME="MyPart"><LINES>MyLine</LINES><REPEAT>MyLine : MyCollection</REPEAT><SCROLLED>Vertical</SCROLLED></PART><LINE NAME="MyLine"><FIELDS>FldGuid,FldName,FldBooksFrom,FldLastVoucherDate,FldEOL</FIELDS></LINE><FIELD NAME="FldGuid"><SET>$Guid</SET></FIELD><FIELD NAME="FldName"><SET>$$StringFindAndReplace:$Name:'"':'""'</SET></FIELD><FIELD NAME="FldBooksFrom"><SET>(($$YearOfDate:$BooksFrom)*10000)+(($$MonthOfDate:$BooksFrom)*100)+(($$DayOfDate:$BooksFrom)*1)</SET></FIELD><FIELD NAME="FldLastVoucherDate"><SET>(($$YearOfDate:$LastVoucherDate)*10000)+(($$MonthOfDate:$LastVoucherDate)*100)+(($$DayOfDate:$LastVoucherDate)*1)</SET></FIELD><FIELD NAME="FldEOL"><SET>†</SET></FIELD><COLLECTION NAME="MyCollection"><TYPE>Company</TYPE><FILTER>FilterActiveCompany</FILTER></COLLECTION><SYSTEM TYPE="Formulae" NAME="FilterActiveCompany">$$IsEqual:##SVCurrentCompany:$Name</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
                xmlCompany = xmlCompany.replace('{targetCompany}', this.config.company ? this.config.company : '##SVCurrentCompany');
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
                    await database.execute('truncate table config;');
                    await database.execute(`insert into config(name,value) values("Update Timestamp","${new Date().toLocaleString()}"),("Company Name","${companyName}"),("Period From","${this.config.fromdate}"),("Period To","${this.config.todate}");`);
                }
                else {
                    reject('Cannot detect First/Last voucher date from company');
                }
                resolve();
            } catch (err) {
                logger.logError(`tally.saveCompanyInfo()`, err);
                reject(err);
            }
        });
    }

    private generateXMLfromYAML(tblConfig: tableConfigYAML): string {
        //XML header
        let retval = `<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>MyReportLedgerTable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:ASCII</SVEXPORTFORMAT><SVFROMDATE>{fromDate}</SVFROMDATE><SVTODATE>{toDate}</SVTODATE><SVCURRENTCOMPANY>{targetCompany}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><REPORT NAME="MyReportLedgerTable"><FORMS>MyForm</FORMS></REPORT><FORM NAME="MyForm"><PARTS>MyPart01</PARTS></FORM>`;

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
            if (iField.type == 'text')
                fieldXML += `<SET>if $$IsEmpty:$${iField.field} then $$StrByCharCode:245 else $$StringFindAndReplace:$${iField.field}:'"':'""'</SET>`;
            else if (iField.type == 'logical')
                fieldXML += `<SET>if $${iField.field} then 1 else 0</SET>`;
            else if (iField.type == 'date')
                fieldXML += `<SET>if $$IsEmpty:$${iField.field} then $$StrByCharCode:241 else $$PyrlYYYYMMDDFormat:$${iField.field}:"-"</SET>`;
            else if (iField.type == 'number')
                fieldXML += `<SET>if $$IsEmpty:$${iField.field} then 0 else $${iField.field}</SET>`;
            else if (iField.type == 'amount')
                fieldXML += `<SET>$$StringFindAndReplace:(if $$IsDebit:$${iField.field} then -$$NumValue:$${iField.field} else $$NumValue:$${iField.field}):"(-)":"-"</SET>`;
            else if (iField.type == 'quantity')
                fieldXML += `<SET>$$StringFindAndReplace:(if $$IsInwards:$${iField.field} then $$Number:$$String:$${iField.field}:"TailUnits" else -$$Number:$$String:$${iField.field}:"TailUnits"):"(-)":"-"</SET>`;
            else if (iField.type == 'rate')
                fieldXML += `<SET>if $$IsEmpty:$${iField.field} then 0 else $$Number:$${iField.field}</SET>`;
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

        return retval;
    }

}
let tally = new _tally();

export { tally };