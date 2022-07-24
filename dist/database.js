"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = void 0;
const fs = require("fs");
const mysql = require("mysql");
const mssql = require("tedious");
const postgres = require("pg");
const logger_js_1 = require("./logger.js");
const maxQuerySize = 50000;
class _database {
    constructor() {
        try {
            this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['database'];
        }
        catch (err) {
            this.config = {
                technology: 'mysql',
                server: 'localhost',
                schema: 'tallydb',
                username: 'root',
                password: 'admin',
                port: 3306,
                ssl: false,
                loadmethod: 'insert'
            };
            logger_js_1.logger.logError('database()', err);
            throw err;
        }
    }
    updateCommandlineConfig(lstConfigs) {
        try {
            if (lstConfigs.has('database-technology'))
                this.config.technology = lstConfigs.get('database-technology') || '';
            if (lstConfigs.has('database-server'))
                this.config.server = lstConfigs.get('database-server') || '';
            if (lstConfigs.has('database-port'))
                this.config.port = parseInt(lstConfigs.get('database-port') || '0');
            if (lstConfigs.has('database-schema'))
                this.config.schema = lstConfigs.get('database-schema') || '';
            if (lstConfigs.has('database-username'))
                this.config.username = lstConfigs.get('database-username') || '';
            if (lstConfigs.has('database-password'))
                this.config.password = lstConfigs.get('database-password') || '';
            if (lstConfigs.has('database-ssl'))
                this.config.ssl = lstConfigs.get('database-ssl') == 'true';
        }
        catch (err) {
            logger_js_1.logger.logError('database.updateCommandlineConfig()', err);
            throw err;
        }
    }
    convertCSV(content, lstFieldType, doubleQuote = false) {
        let lstLines = content.split(/\r\n/g);
        for (let r = 0; r < lstLines.length; r++) {
            let line = lstLines[r];
            line = line.replace(/ñ/g, ''); //replace blank date with empty text
            line = line.replace(/\"/g, '""'); //escape double quotes with 2 instance of double quotes (as per ISO)
            let lstValues = line.split('\t');
            for (let c = 0; c < lstValues.length; c++) {
                let targetFieldType = lstFieldType[c];
                let targetFieldValue = lstValues[c];
                if (doubleQuote)
                    lstValues[c] = `"${targetFieldValue}"`;
                else if (targetFieldType == 'text' || targetFieldType == 'date')
                    lstValues[c] = `"${targetFieldValue}"`;
            }
            lstLines[r] = lstValues.join(',');
        }
        return lstLines.join('\r\n');
    }
    bulkLoad(csvFile, targetTable, lstFieldType) {
        return new Promise(async (resolve, reject) => {
            let sqlQuery = '';
            try {
                sqlQuery = '';
                let rowCount = 0;
                if (this.config.loadmethod == 'insert') { //INSERT query based loading
                    let txtCSV = fs.readFileSync(csvFile, 'utf-8');
                    let lstLines = txtCSV.split(/\r\n/g);
                    let fieldList = lstLines.shift() || ''; //extract header
                    fieldList = fieldList.replace(/\t/g, ','); //replace tab with comma for header
                    while (lstLines.length) { //loop until row is found
                        sqlQuery = `insert into ${targetTable} (${fieldList}) values`;
                        let countBatch = 0; //number of rows in batch
                        //run a loop to keep on appending row to SQL Query values until max allowable size of query is exhausted
                        while (lstLines.length && (sqlQuery.length + lstLines[0].length + 3 < maxQuerySize) && ++countBatch <= 1000) {
                            let activeLine = lstLines.shift() || '';
                            let lstValues = activeLine.split('\t');
                            for (let i = 0; i < lstValues.length; i++) {
                                let targetFieldType = lstFieldType[i];
                                let targetFieldValue = lstValues[i];
                                if (targetFieldType == 'text') {
                                    let hasUnicodeText = /[^\u0000-\u007f]/g.test(targetFieldValue);
                                    targetFieldValue = targetFieldValue.replace(/'/g, '\'\''); //escape single quote
                                    if (this.config.technology == 'mysql')
                                        targetFieldValue = targetFieldValue.replace(/\\/g, '\\\\'); //MySQL requires escaping of backslash
                                    targetFieldValue = `'${targetFieldValue}'`; //enclose value in single quotes for SQL query
                                    if (hasUnicodeText && this.config.technology == 'mssql')
                                        targetFieldValue = 'N' + targetFieldValue; //SQL Server requires prefixing quoted text with N if any Unicode character exists in string
                                    lstValues[i] = targetFieldValue;
                                }
                                else if (targetFieldType == 'date') {
                                    lstValues[i] = targetFieldValue == 'ñ' ? 'NULL' : `'${targetFieldValue}'`;
                                }
                                else
                                    ;
                            }
                            activeLine = lstValues.join(','); //prepare SQL statement with values separated by comma
                            sqlQuery += `(${activeLine}),`; //enclose row values into round braces
                        }
                        sqlQuery = sqlQuery.substr(0, sqlQuery.length - 1) + ';'; //remove last trailing comma and append colon
                        rowCount += await this.executeNonQuery(sqlQuery);
                    }
                }
                else { //File based loading
                    //modify file to handle null values for date field
                    if (this.config.technology == 'postgres') {
                        let fileContent = fs.readFileSync(csvFile, 'utf-8');
                        fileContent = fileContent.replace(/ñ/g, 'ø'); //substitute NULL with placeholder
                        fileContent = this.convertCSV(fileContent, lstFieldType);
                        fileContent = fileContent.replace(/\"ø\"/g, ''); //replace placeholder with nothing along with enclosing double quotes
                        fs.writeFileSync(csvFile, '\ufeff' + fileContent);
                    }
                    else if (this.config.technology == 'mysql') {
                        let fileContent = fs.readFileSync(csvFile, 'utf-8');
                        fileContent = fileContent.replace(/ñ/g, 'ø'); //substitute NULL with placeholder
                        fileContent = this.convertCSV(fileContent, lstFieldType, true);
                        fileContent = fileContent.replace(/\"ø\"/g, 'NULL'); //replace placeholder with nothing along with enclosing double quotes
                        fs.writeFileSync(csvFile, '\ufeff' + fileContent); //write desired changes to file
                    }
                    else { //SQL Server
                        let fileContent = fs.readFileSync(csvFile, 'utf-8');
                        fileContent = fileContent.replace(/ñ/g, ''); //substitute NULL with placeholder
                        fileContent = fileContent.replace(/\"/g, '""'); //escape double quotes
                        fs.writeFileSync(csvFile, '\ufeff' + fileContent); //write desired changes to file
                    }
                    if (this.config.technology == 'mysql') {
                        sqlQuery = `load data infile '${csvFile.replace(/\\/g, '\\\\')}' into table ${targetTable} fields terminated by ',' enclosed by '"' escaped by '' lines terminated by '\r\n' ignore 1 lines ;`;
                        rowCount = await this.executeNonQuery(sqlQuery);
                    }
                    else if (this.config.technology == 'mssql') {
                        sqlQuery = `bulk insert ${targetTable} from '${csvFile}' with ( firstrow = 2, codepage = '65001')`;
                        rowCount = await this.executeNonQuery(sqlQuery);
                    }
                    else if (this.config.technology == 'postgres') {
                        sqlQuery = `copy ${targetTable} from '${csvFile}' csv header;`;
                        rowCount = await this.executeNonQuery(sqlQuery);
                    }
                    else
                        ;
                }
                resolve(rowCount);
            }
            catch (err) {
                reject(err);
                if (typeof err == 'object')
                    err['targetQuery'] = sqlQuery;
                logger_js_1.logger.logError('database.bulkLoad()', err);
            }
        });
    }
    executeNonQuery(sqlQuery, values) {
        return new Promise(async (resolve, reject) => {
            try {
                let retval = 0;
                if (this.config.technology.toLowerCase() == 'mysql')
                    retval = (await this.executeMysql(sqlQuery)).rowCount;
                else if (this.config.technology.toLowerCase() == 'mssql')
                    retval = (await this.executeMssql(sqlQuery)).rowCount;
                else if (this.config.technology.toLowerCase() == 'postgres')
                    retval = (await this.executePostgres(sqlQuery)).rowCount;
                else
                    ;
                resolve(retval);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    executeScalar(sqlQuery) {
        return new Promise(async (resolve, reject) => {
            try {
                let retval = undefined;
                if (this.config.technology.toLowerCase() == 'mysql') {
                    let result = await this.executeMysql(sqlQuery);
                    if (Array.isArray(result.data) && result.data.length == 1) {
                        let lstProps = Object.keys(result.data[0]);
                        retval = result.data[0][lstProps[0]];
                    }
                }
                else if (this.config.technology.toLowerCase() == 'mssql') {
                    let result = await this.executeMssql(sqlQuery);
                    if (Array.isArray(result.data) && result.data.length == 1)
                        retval = result.data[0][0].value;
                }
                else if (this.config.technology.toLowerCase() == 'postgres') {
                    let result = await this.executePostgres(sqlQuery);
                    if (Array.isArray(result.data) && result.data.length == 1)
                        retval = result.data[0][0];
                }
                else
                    ;
                resolve(retval);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    truncateTables(lstTables) {
        return new Promise(async (resolve, reject) => {
            try {
                for (let i = 0; i < lstTables.length; i++)
                    await this.executeNonQuery(`truncate table ${lstTables[i]};`);
                resolve();
            }
            catch (err) {
                reject(err);
                logger_js_1.logger.logError('database.truncateTables()', err);
            }
        });
    }
    executeMysql(sqlQuery) {
        return new Promise((resolve, reject) => {
            try {
                let connection = mysql.createConnection({
                    host: this.config.server,
                    port: this.config.port,
                    database: this.config.schema,
                    user: this.config.username,
                    password: this.config.password
                });
                connection.connect((connErr) => {
                    if (connErr) {
                        let errorMessage = '';
                        if (connErr.code == 'ECONNREFUSED')
                            errorMessage = 'Unable to make MySQL connection on specified port';
                        else if (connErr.code == 'ENOTFOUND')
                            errorMessage = 'Unable to make MySQL connection to servername or IP address';
                        else if (connErr.code == 'ER_BAD_DB_ERROR')
                            errorMessage = 'Invalid MySQL database name';
                        else if (connErr.code == 'ER_ACCESS_DENIED_ERROR')
                            errorMessage = 'Invalid MySQL password';
                        else if (connErr.code == 'ER_NOT_SUPPORTED_AUTH_MODE')
                            errorMessage = 'Invalid MySQL username/password/Authentication';
                        else
                            ;
                        logger_js_1.logger.logError('database.executeMysql()', errorMessage || connErr);
                        reject('');
                    }
                    else
                        connection.query(sqlQuery, (queryErr, results) => {
                            connection.end();
                            if (queryErr) {
                                reject(queryErr);
                            }
                            else
                                resolve({ rowCount: results['affectedRows'], data: results });
                        });
                });
            }
            catch (err) {
                reject(err);
                logger_js_1.logger.logError('database.executeMysql()', err);
            }
        });
    }
    executeMssql(sqlQuery) {
        return new Promise((resolve, reject) => {
            try {
                let connection = new mssql.Connection({
                    server: this.config.server,
                    authentication: {
                        options: {
                            userName: this.config.username,
                            password: this.config.password
                        },
                        type: 'default'
                    },
                    options: {
                        database: this.config.schema,
                        port: this.config.port,
                        trustServerCertificate: true,
                        encrypt: this.config.ssl,
                        rowCollectionOnRequestCompletion: true
                    }
                });
                connection.on('connect', (connErr) => {
                    if (connErr) {
                        let errorMessage = '';
                        if (connErr.message.includes('getaddrinfo ENOTFOUND'))
                            errorMessage = 'Unable to make SQL Server connection to specified servername or IP address';
                        else if (connErr.message.includes('Could not connect (sequence)'))
                            errorMessage = 'Unable to make SQL Server connection to specified port';
                        else if (connErr.message.includes('Login failed for user'))
                            errorMessage = 'Invalid Database / Username / Password';
                        else
                            ;
                        logger_js_1.logger.logError('database.executeMssql()', errorMessage || connErr);
                        reject(connErr);
                    }
                    else
                        connection.execSql(new mssql.Request(sqlQuery, (queryErr, rowCount, rows) => {
                            if (queryErr)
                                reject(queryErr);
                            else
                                resolve({ rowCount, data: rows });
                        }));
                });
                connection.connect();
            }
            catch (err) {
                reject(err);
                logger_js_1.logger.logError('database.executeMssql()', err);
            }
        });
    }
    executePostgres(sqlQuery) {
        return new Promise(async (resolve, reject) => {
            try {
                let connection = new postgres.Client({
                    host: this.config.server,
                    port: this.config.port,
                    database: this.config.schema,
                    user: this.config.username,
                    password: this.config.password,
                    ssl: !this.config.ssl ? false : {
                        rejectUnauthorized: false
                    },
                });
                await connection.connect();
                let qryConfig = {
                    rowMode: 'array',
                    text: sqlQuery
                };
                let result = await connection.query(qryConfig);
                await connection.end();
                resolve({ rowCount: result.rowCount, data: result.rows });
            }
            catch (err) {
                let errorMessage = '';
                let errSystemMessage = typeof err['message'] == 'string' ? err['message'] : '';
                if (errSystemMessage.startsWith('getaddrinfo ENOTFOUND'))
                    errorMessage = 'Unable to make PostgreSQL connection to servername or IP address';
                else if (errSystemMessage.startsWith('connect ECONNREFUSED'))
                    errorMessage = 'Unable to make PostgreSQL connection on specified port';
                else if (errSystemMessage.startsWith('database') && errSystemMessage.endsWith('does not exist'))
                    errorMessage = 'Invalid PostgreSQL database';
                else if (errSystemMessage.startsWith('password authentication failed for user'))
                    errorMessage = 'Invalid PostgreSQL username or password';
                else if (errSystemMessage == 'The server does not support SSL connections')
                    errorMessage = 'Specified PostgreSQL Database Server does not support secure connection';
                else
                    ;
                reject(err);
                logger_js_1.logger.logError('database.executePostgres()', errorMessage || err);
            }
        });
    }
}
let database = new _database();
exports.database = database;
//# sourceMappingURL=database.js.map