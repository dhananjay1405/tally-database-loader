import * as process from 'process';
import * as fs from 'fs';
import { tally } from './tally.js';
import { database } from './database.js';
import { logger } from './logger.js'


function parseCommandlineOptions(): Map<string, string> {
    let retval = new Map<string, string>();
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
database.updateCommandlineConfig(cmdConfig);
tally.updateCommandlineConfig(cmdConfig);

//start import process
tally.importData()
    .then(() => logger.logMessage('Import completed successfully...'))
    .catch(() => logger.logMessage('Error in importing data\r\nPlease check error-log.txt file for detailed errors'));