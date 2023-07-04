import fs from 'fs';
import path from 'path';
import SftpClient from 'ssh2-sftp-client';

async function saveFileToServer(localFilePath1, fileName, serverConfig) {
    // const serverConfig2 = {
    //     host: '10.171.25.94',
    //     username: 'mohit.kumar',
    //     password: 'SvlNonProd123$',
    //     remotePath: '/home/mohit.kumar/whatsapp-files"', // Optional
    // };
    const serverConfig2 = {
        host: '192.168.122.162',
        username: 'sftpuser',
        password: 'sftp',
        remotePath: '', // Optional
    };
    let localFolderPath = './imgs';
    console.log(serverConfig2);
    // if (!serverConfig || !serverConfig.host || !serverConfig.username || !serverConfig.password) {
    //     throw new Error('Incomplete server configuration.');
    // }

    const sftp = new SftpClient();

    try {
        await sftp.connect(serverConfig2);
        console.log('Connected to server.');
        const files = await getFilesInFolder(localFolderPath);
        const uploadPromises = files.map(async (file) => {
            const localFilePath = path.join(localFolderPath, file);
            const serverPath = `${serverConfig2.remotePath || '/sftpuser'}/${file}`;
            await sftp.fastPut(localFilePath, serverPath);


            // const loggerData = {
            //     loginStatus: 'SUCCESS',
            //     serverIP: serverConfig.host,
            //     userName: serverConfig.username,
            //     password: serverConfig.password,
            //     serverPath: serverConfig.remotePath,
            //     type: 'PUT',
            //     fileName: fileName,
            // };
            // console.log(JSON.stringify(loggerData));

            return { response: true, nwcServerPath: serverPath, fileName: file };
        });
        const results = await Promise.all(uploadPromises);

        return results;

    } catch (err) {

        // const loggerData = {
        //     loginStatus: 'FAILED',
        //     serverIP: serverConfig.host,
        //     userName: serverConfig.username,
        //     password: serverConfig.password,
        //     serverPath: serverConfig.remotePath,
        //     type: 'PUT',
        //     fileName: fileName,
        //     error: err.message || 'Unknown error occurred.',
        // };
        // console.error(JSON.stringify(loggerData));
        //
        return { response: false, nwcServerPath: '', fileName: fileName, error: err.message || 'Unknown error occurred.' };
    } finally {
        sftp.end();
    }
}


const serverConfig = {
    host: '192.168.122.162',
    username: 'sftpuser',
    password: 'sftp',
    remotePath: '', // Optional
};
const localFolderPath = 'D:/web-development/wp_clone';

// const localFilePath = 'D:\web-development\wp_clone';
// const fileName = 'test.txt';

function getFilesInFolder(localFolderPath) {
    return fs.promises.readdir(localFolderPath);
}

(async () => {
    try {
        console.log(serverConfig)
        const results = await saveFileToServer(localFolderPath, serverConfig);
        console.log('Upload results:', results);
    } catch (error) {
        console.error('Error occurred during upload:', error);
    }
})();
