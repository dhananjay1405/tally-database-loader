"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process = require("process");
const tally_js_1 = require("./tally.js");
const database_js_1 = require("./database.js");
const logger_js_1 = require("./logger.js");
function parseCommandlineOptions() {
    let retval = new Map();
    let lstArgs = process.argv;
    if (lstArgs.length > 2 && lstArgs.length % 2 == 0)
        for (let i = 2; i < lstArgs.length; i += 2) {
            let argName = lstArgs[i];
            let argValue = lstArgs[i + 2];
            if (/^--\w+-\w+$/g.test(argName))
                retval.set(argName.substr(2), argValue);
        }
    return retval;
}
//Update commandline overrides to configuration options
let cmdConfig = parseCommandlineOptions();
database_js_1.database.updateCommandlineConfig(cmdConfig);
tally_js_1.tally.updateCommandlineConfig(cmdConfig);
//start import process
tally_js_1.tally.importData()
    .then(() => {
    logger_js_1.logger.logMessage('Import completed successfully [%s]', new Date().toLocaleString());
    setTimeout(() => process.exit(0), 100); //exit process success code
})
    .catch(() => {
    logger_js_1.logger.logMessage('Error in importing data\r\nPlease check error-log.txt file for detailed errors [%s]', new Date().toLocaleString());
    setTimeout(() => process.exit(1), 100); //exit process with error code
});
//# sourceMappingURL=index.js.map