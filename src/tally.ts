import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as http from 'http';
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
}

interface tableInfo {
    tableName: string;
    columnList: string;
    datatypeList: string;
}

class _tally {

    private config: tallyConfig;
    private lstMasters: string[] = ['mst_group', 'mst_ledger', 'mst_vouchertype', 'mst_uom', 'mst_godown', 'mst_stock_group', 'mst_stock_item', 'trn_closingstock_ledger'];
    private lstTransactions: string[] = ['trn_voucher', 'trn_accounting', 'trn_inventory'];
    private lstTableInfo: tableInfo[] = [];
    private flgWriteColumnHeader = true; // [ true = write column header to CSV / false = skip it ]

    constructor() {
        this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['tally'];
        this.lstTableInfo = JSON.parse(fs.readFileSync('./table-info.json', 'utf-8'));
    }

    updateCommandlineConfig(lstConfigs: Map<string, string>): void {
        if (lstConfigs.has('tally-server')) this.config.server = lstConfigs.get('tally-server') || '';
        if (lstConfigs.has('tally-port')) this.config.port = parseInt(lstConfigs.get('tally-port') || '9000');
        if (lstConfigs.has('tally-master')) this.config.master = lstConfigs.get('tally-master') == 'true';
        if (lstConfigs.has('tally-transaction')) this.config.transaction = lstConfigs.get('tally-transaction') == 'true';
        if (lstConfigs.has('tally-batch')) this.config.batch = lstConfigs.get('tally-batch') || '';
        if (lstConfigs.has('tally-fromdate') && lstConfigs.has('tally-todate')) {
            let fromDate = lstConfigs.get('tally-fromdate') || '';
            let toDate = lstConfigs.get('tally-todate') || '';
            this.config.fromdate = /^\d{4}-\d{2}-\d{2}$/g.test(fromDate) ? fromDate : 'auto';
            this.config.todate = /^\d{4}-\d{2}-\d{2}$/g.test(toDate) ? toDate : 'auto';
        }
    }

    importData(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {

                if (/^(mssql|mysql)$/g.test(database.config.technology)) {
                    //update active company information before starting import
                    logger.logMessage('Updating company information configuration table');
                    await this.saveCompanyInfo();
                }

                //prepare substitution list of runtime values to reflected in TDL XML
                let configPeriod = new Map<string, any>();
                configPeriod.set('fromDate', utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                configPeriod.set('toDate', utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));

                if (/^(mssql|mysql)$/g.test(database.config.technology)) {
                    //truncate master/transaction tables
                    logger.logMessage('Erasing database');
                    for (let i = 0; i < this.lstMasters.length; i++) {
                        let targetTable = this.lstMasters[i];
                        await database.execute(`truncate table ${targetTable};`);
                    }
                    for (let i = 0; i < this.lstTransactions.length; i++) {
                        let targetTable = this.lstTransactions[i];
                        await database.execute(`truncate table ${targetTable};`);
                    }
                }

                //delete and re-create CSV folder
                if (fs.existsSync('./csv'))
                    fs.rmSync('./csv', { recursive: true });
                fs.mkdirSync('./csv');

                //dump data exported from Tally to CSV file required for bulk import
                logger.logMessage('Generating CSV files from Tally');
                if (this.config.master)
                    for (let i = 0; i < this.lstMasters.length; i++) {
                        let targetTable = this.lstMasters[i];
                        await this.processMasterReport(targetTable, configPeriod);
                        logger.logMessage('  saving file %s.csv', targetTable);
                    }
                if (this.config.transaction) {
                    if (tally.config.batch == 'daily') {
                        for (let currDate = <Date>configPeriod.get('fromDate'); currDate <= <Date>configPeriod.get('toDate'); currDate.setDate(currDate.getDate() + 1)) {
                            let _configPeriod = new Map<string, any>();
                            _configPeriod.set('fromDate', currDate);
                            _configPeriod.set('toDate', currDate);
                            await this.processTransactionReport(_configPeriod);
                        }
                    }
                    else
                        await this.processTransactionReport(configPeriod);
                }

                if (/^(mssql|mysql)$/g.test(database.config.technology)) {
                    //perform CSV file based bulk import into database
                    logger.logMessage('Loading CSV files to database tables');
                    if (this.config.master)
                        for (let i = 0; i < this.lstMasters.length; i++) {
                            let targetTable = this.lstMasters[i];
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.csv`), targetTable);
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                        }
                    if (this.config.transaction)
                        for (let i = 0; i < this.lstTransactions.length; i++) {
                            let targetTable = this.lstTransactions[i];
                            let rowCount = await database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.csv`), targetTable);
                            logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
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

    private processMasterReport(targetTable: string, substitutions?: Map<string, any>): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let xml = fs.readFileSync(`./xml/${targetTable}.xml`, 'utf-8');
                if (substitutions && substitutions.size)
                    xml = this.substituteTDLParameters(xml, substitutions);

                let output = await this.postTallyXML(xml);
                output = this.processTdlOutputManipulation(output);

                let columnHeaders = this.lstTableInfo.find(p => p.tableName == targetTable)?.columnList + '\r\n';
                fs.writeFileSync(`./csv/${targetTable}.csv`, columnHeaders + output);

                resolve();
            } catch (err) {
                logger.logError(`tally.processMasterReport(${targetTable})`, err);
                reject(err);
            }
        });
    }

    private processTransactionReport(substitutions?: Map<string, any>): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let columnHeader = '';

                let xml = fs.readFileSync(`./xml/trn_voucher.xml`, 'utf-8');
                if (substitutions && substitutions.size)
                    xml = this.substituteTDLParameters(xml, substitutions);

                let output = await this.postTallyXML(xml);
                output = this.processTdlOutputManipulation(output);

                let csvVoucher = '', csvAccounting = '', csvInventory = '';
                let lstLines = output.split(/\r\n/g);
                for (let i = 0; i < lstLines.length; i++) {
                    let line = lstLines[i];
                    if (line.startsWith('"V"')) csvVoucher += line.substr(4) + '\r\n';
                    else if (line.startsWith('"A"')) csvAccounting += line.substr(4) + '\r\n';
                    else if (line.startsWith('"I"')) csvInventory += line.substr(4) + '\r\n';
                    else;
                }

                if (this.flgWriteColumnHeader) {
                    columnHeader = this.lstTableInfo.find(p => p.tableName == 'trn_voucher')?.columnList + '\r\n';
                    fs.writeFileSync('./csv/trn_voucher.csv', columnHeader + csvVoucher);
                    logger.logMessage('  saving file %s.csv', 'trn_voucher');

                    columnHeader = this.lstTableInfo.find(p => p.tableName == 'trn_accounting')?.columnList + '\r\n';
                    fs.writeFileSync('./csv/trn_accounting.csv', columnHeader + csvAccounting);
                    logger.logMessage('  saving file %s.csv', 'trn_accounting');

                    columnHeader = this.lstTableInfo.find(p => p.tableName == 'trn_inventory')?.columnList + '\r\n';
                    fs.writeFileSync('./csv/trn_inventory.csv', columnHeader + csvInventory);
                    logger.logMessage('  saving file %s.csv', 'trn_inventory');
                }
                else {
                    fs.appendFileSync('./csv/trn_voucher.csv', csvVoucher);
                    fs.appendFileSync('./csv/trn_accounting.csv', csvAccounting);
                    fs.appendFileSync('./csv/trn_inventory.csv', csvInventory);
                }

                this.flgWriteColumnHeader = false; //change back the column header write flag, so that header get written only once

                resolve();
            } catch (err) {
                logger.logError(`tally.processTransactionReport()`, err);
                reject(err);
            }
        });
    }

    private saveCompanyInfo(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let xmlCompany = fs.readFileSync('./xml/mst_company.xml', 'utf-8');
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
                    await database.execute(`insert into config(name,value) values("Update Timestamp","${new Date().toISOString()}"),("Company Name","${companyName}"),("Period From","${this.config.fromdate}"),("Period To","${this.config.todate}");`);
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

}
let tally = new _tally();

export { tally };