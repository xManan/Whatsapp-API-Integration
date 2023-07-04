import fs from 'fs';
import path from 'path';
import SftpClient from 'ssh2-sftp-client';
import dotenv from 'dotenv';

dotenv.config();

// TODO: Add your server configuration .env
const serverConfig = {
    host: process.env.SFTP_HOST,
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASSWORD,
    remotePath: process.env.SFTP_REMOTE_DIR,
}

// const serverConfig = {
//     host: '192.168.122.162',
//     username: 'sftpuser',
//     password: 'sftp',
//     remotePath: '', // Optional
// };

const localFolderPath = './imgs';

(async () => {
    try {
        const results = await saveFileToServer(localFolderPath, serverConfig);
        console.log('Upload results:', results);
    } catch (error) {
        console.error('Error occurred during upload:', error);
    }
})();

function getFilesInFolder(localFolderPath) {
    return fs.promises.readdir(localFolderPath);
}

async function saveFileToServer(localFilePath, serverConfig) {
    if (!serverConfig || !serverConfig.host || !serverConfig.username || !serverConfig.password) {
        throw new Error('Incomplete server configuration.');
    }

    const sftp = new SftpClient();
    const loggerData = {
        loginStatus: 'SUCCESS',
        serverIP: serverConfig.host,
        userName: serverConfig.username,
        password: serverConfig.password,
        serverPath: serverConfig.remotePath,
        type: 'PUT',
    };
    const loggerDetailsFolder = './logs';
    const loggerFilePath = path.join(loggerDetailsFolder, 'logger_details');
    let filesInServer = []
    try {
        await sftp.connect(serverConfig);
        console.log('Connected to server.');
        const result = await sftp.list(serverConfig.remotePath || '/sftpuser');
        for (const sub of result) {
            filesInServer.push(sub.name)
        }
        let files = await getFilesInFolder(localFolderPath);
        files = files.filter(file => !filesInServer.includes(file))
        const uploadPromises = files.map(async (file) => {
            const localFilePath = path.join(localFolderPath, file);
            const serverPath = `${serverConfig.remotePath || '/sftpuser'}/${file}`;
            await sftp.put(localFilePath, serverPath);

            console.log(JSON.stringify(loggerData));

            return { response: true, serverPath: serverPath, fileName: file };
        });
        const results = await Promise.all(uploadPromises);
        // Create the "loggerDetails" folder if it doesn't exist
        if (!fs.existsSync(loggerDetailsFolder)) {
            fs.mkdirSync(loggerDetailsFolder);
        }

        // Create the "logger_details" file if it doesn't exist
        if (!fs.existsSync(loggerFilePath)) {
            fs.writeFileSync(loggerFilePath, '');
        }

        // Write logger data to the file
        fs.writeFileSync(loggerFilePath, JSON.stringify(loggerData, null, 2));


        return results;

    } catch (err) {
        const loggerDataError = {
            loginStatus: 'FAILED',
            serverIP: serverConfig.host,
            userName: serverConfig.username,
            password: serverConfig.password,
            serverPath: serverConfig.remotePath,
            type: 'PUT',
            error: err.message || 'Unknown error occurred.',
        };

        // Create the "loggerDetails" folder if it doesn't exist
        if (!fs.existsSync(loggerDetailsFolder)) {
            fs.mkdirSync(loggerDetailsFolder);
        }

        // Create the "logger_details" file if it doesn't exist
        if (!fs.existsSync(loggerFilePath)) {
            fs.writeFileSync(loggerFilePath, '');
        }

        // Write error logger data to the file
        fs.writeFileSync(loggerFilePath, JSON.stringify(loggerDataError, null, 2));

        return { response: false,serverPath: '', error: err.message || 'Unknown error occurred.' };
    } finally {
        sftp.end();
    }
}


