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
    bulkLoad(csvFile, targetTable) {
        return new Promise(async (resolve, reject) => {
            try {
                let sqlQuery = '';
                let rowCount = 0;
                if (this.config.loadmethod == 'insert') { //INSERT query based loading
                    let txtCSV = fs.readFileSync(csvFile, 'utf-8');
                    txtCSV = txtCSV.replace(/'/g, '\'\''); //escape single quote
                    txtCSV = txtCSV.replace(/æ/g, '\''); //set field quote as single quote
                    txtCSV = txtCSV.replace(/\'ñ\'/g, 'NULL'); //replace special character for null dates with NULL for insert
                    if (this.config.technology == 'mysql')
                        txtCSV = txtCSV.replace(/\\/g, '\\\\'); //MySQL requires escaping of backslash
                    let lstLines = txtCSV.split(/\r\n/g);
                    lstLines.pop(); //remove last empty item
                    let fieldList = lstLines.shift() || '';
                    while (lstLines.length) { //loop until row is found
                        sqlQuery = `insert into ${targetTable} (${fieldList}) values`;
                        //run a loop to keep on appending row to SQL Query values until max allowable size of query is exhausted
                        while (lstLines.length && (sqlQuery.length + lstLines[0].length + 3 < maxQuerySize))
                            sqlQuery += `(${lstLines.shift()}),`; //enclose row values into round braces
                        sqlQuery = sqlQuery.substr(0, sqlQuery.length - 1) + ';'; //remove last trailing comma and append colon
                        rowCount += await this.execute(sqlQuery);
                    }
                }
                else { //File based loading
                    //modify file to handle null values for date field
                    let fileContent = fs.readFileSync(csvFile, 'utf-8');
                    fileContent = fileContent.replace(/\"/g, '""'); //escape double quotes
                    fileContent = fileContent.replace(/æ/g, '"'); //replace field quotes with double quotes
                    fileContent = fileContent.replace(/\"ñ\"/g, this.config.technology == 'mysql' ? 'NULL' : ''); //replace empty dates with NULL
                    fs.writeFileSync(csvFile, fileContent); //write desired changes to file
                    fileContent = ''; //reset string to erase memory
                    if (this.config.technology == 'mysql') {
                        sqlQuery = `load data infile '${csvFile.replace(/\\/g, '\\\\')}' into table ${targetTable} fields terminated by ',' enclosed by '"' escaped by '' lines terminated by '\r\n' ignore 1 lines ;`;
                        rowCount = await this.execute(sqlQuery);
                    }
                    else if (this.config.technology == 'mssql') {
                        sqlQuery = `bulk insert ${targetTable} from '${csvFile}' with ( format = 'CSV', firstrow = 2, codepage = '65001' )`;
                        rowCount = await this.execute(sqlQuery);
                    }
                    else if (this.config.technology == 'postgres') {
                        sqlQuery = `copy ${targetTable} from '${csvFile}' csv header;`;
                        rowCount = await this.executePostgres(sqlQuery);
                    }
                    else
                        ;
                }
                resolve(rowCount);
            }
            catch (err) {
                reject(err);
                logger_js_1.logger.logError('database.bulkLoad()', err);
            }
        });
    }
    execute(sqlQuery, values) {
        return new Promise(async (resolve, reject) => {
            try {
                let rowCount = 0;
                if (this.config.technology.toLowerCase() == 'mysql')
                    rowCount = await this.executeMysql(sqlQuery);
                else if (this.config.technology.toLowerCase() == 'mssql')
                    rowCount = await this.executeMssql(sqlQuery);
                else if (this.config.technology.toLowerCase() == 'postgres')
                    rowCount = await this.executePostgres(sqlQuery);
                else
                    ;
                resolve(rowCount);
            }
            catch (err) {
                reject(err);
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
                                resolve(results['affectedRows']);
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
                        encrypt: this.config.ssl
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
                        connection.execSql(new mssql.Request(sqlQuery, (queryErr, rowCount) => {
                            if (queryErr)
                                reject(queryErr);
                            else
                                resolve(rowCount);
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
                    ssl: this.config.ssl
                });
                await connection.connect();
                let qryConfig = {
                    rowMode: 'array',
                    text: sqlQuery
                };
                let result = await connection.query(qryConfig);
                await connection.end();
                resolve(result.rowCount);
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