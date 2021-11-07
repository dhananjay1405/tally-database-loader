import * as process from 'process';
import { tally } from './tally.js';
import { database } from './database.js';
import { logger } from './logger.js'


function parseCommandlineOptions(): Map<string, string> {
    let retval = new Map<string, string>();
    try {
        let lstArgs = process.argv;

        if (lstArgs.length > 2 && lstArgs.length % 2 == 0)
            for (let i = 2; i < lstArgs.length; i += 2) {
                let argName = lstArgs[i];
                let argValue = lstArgs[i + 2];
                if (/^--\w+-\w+$/g.test(argName))
                    retval.set(argName.substr(2), argValue);
            }
    } catch (err) {
        logger.logError('index.substituteTDLParameters()', err);
    }
    return retval;
}

//Update commandline overrides to configuration options
let cmdConfig = parseCommandlineOptions();
database.updateCommandlineConfig(cmdConfig);
tally.updateCommandlineConfig(cmdConfig);

//start import process
tally.importData()
    .then(() => {
        logger.logMessage('Import completed successfully [%s]', new Date().toLocaleString());
        setTimeout(() => process.exit(0), 100); //exit process success code

    })
    .catch(() => {
        logger.logMessage('Error in importing data\r\nPlease check error-log.txt file for detailed errors [%s]', new Date().toLocaleString());
        setTimeout(() => process.exit(1), 100); //exit process with error code
    });