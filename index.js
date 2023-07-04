"use strict"

import dotenv from 'dotenv'
import express from 'express'
import axios from 'axios'
import fs from 'fs'
import SftpClient from 'ssh2-sftp-client'
import path from 'path'

dotenv.config()

let imgDir = process.env.IMG_DIR || './imgs'
let logDir = process.env.LOG_DIR || './logs'

if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true })
}

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
}
const token = process.env.WHATSAPP_TOKEN
const port = process.env.PORT || 3000

const whatsappMediaUrl = "https://graph.facebook.com/v17.0"
const app = express()

app.use(express.json())

app.listen(port, () => {
    console.log(`webhook listening at port ${port}`)
})

const sftp_server = new SftpClient();
const sfpt_config = {
    host: process.env.SFTP_HOST,
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASSWORD,
}

try {
    await sftp_connect(sftp_server, sfpt_config)
} catch (error) {
    error_log(error.message)
    // throw error
}

process.on('exit', _ => {
    sftp_server.end()
})

process.on('uncatchException', error => {
    error_log(error.message)
    process.exit(1)
})

// Accepts POST requests at /webhook endpoint
app.post("/webhook", async (req, res) => {
    if (req.body.object) {
        if (
            req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value.messages &&
            req.body.entry[0].changes[0].value.messages[0]
        ) {
            const message = req.body.entry[0].changes[0].value.messages[0]
            let imgData
            if (message.type === "document" && message.document.mime_type.match(/image\/.*/)) {
                imgData = message.document
            } else if (message.type === "image") {
                imgData = message.image
            } else {
                info_log("Not an image")
                res.sendStatus(200)
                return
            }
            let response = await fetch(`${whatsappMediaUrl}/${imgData.id}`, {
                method: 'GET',
                headers: new Headers({
                    'Authorization': `Bearer ${token}`
                })
            })
            let img = await response.json()
            let imgType = imgData.mime_type.split('/')[1]
            let imgPath = `${imgDir}/WA_IMG_${imgData.id}.${imgType}`
            try {
                if (!img.url) {
                    throw `No image url: ${JSON.stringify(img)}`
                }
                await downloadFile(img.url, imgPath, `Bearer ${token}`)
                info_log(`Image downloaded: ${imgPath}`)
            } catch (error) {
                error_log(error.message)
            }
            try {
                if (!sftp_server.sftp) {
                    await sftp_connect(sftp_server, sfpt_config)
                }
                if (! await fileExists(imgPath, sftp_server)) {
                    await uploadFile(imgPath, sftp_server)
                    info_log(`Image uploaded: ${imgPath}`)
                } else {
                    info_log(`File already exists: ${imgPath}`)
                }
            } catch (error) {
                error_log(error.message)
                res.sendStatus(200)
                throw error
            }
        }
        res.sendStatus(200)
    } else {
        // Return a '404 Not Found' if event is not from a WhatsApp API
        error_log("Event is not from a WhatsApp API")
        res.sendStatus(404)
    }
})

app.get("/webhook", (req, res) => {
    /**
     * UPDATE YOUR VERIFY TOKEN
     *This will be the Verify Token value when you set up webhook
    **/
    const verify_token = process.env.VERIFY_TOKEN
    console.log("verify_token: " + verify_token)

    // Parse params from the webhook verification request
    let mode = req.query["hub.mode"]
    let token = req.query["hub.verify_token"]
    let challenge = req.query["hub.challenge"]

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === "subscribe" && token === verify_token) {
            // Respond with 200 OK and challenge token from the request
            console.log("WEBHOOK_VERIFIED")
            res.status(200).send(challenge)
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403)
        }
    }
})

async function downloadFile(url, outputPath, authorizationHeader) {
    try {
        let response = await axios({
            method: 'GET',
            url: url,
            maxRedirects: 0,
            responseType: 'arraybuffer',
            headers: {
                Authorization: authorizationHeader
            }
        })

        while (response.status >= 300 && response.status <= 399) {
            const redirectUrl = response.headers.location
            response = await axios({
                method: 'GET',
                url: redirectUrl,
                maxRedirects: 0,
                responseType: 'arraybuffer',
                headers: {
                    Authorization: authorizationHeader
                }
            })
        }

        fs.writeFileSync(outputPath, response.data)
    } catch (error) {
        // console.log(error)
        throw error
    }
}

async function fileExists(file, sftp_server) {
    let result
    try {
        result = await sftp_server.list(process.env.SFTP_REMOTE_DIR)
    } catch (error) {
        throw error
    }
    return result.some((f) => f.name === file)
}

async function uploadFile(file, sftp_server) {
    try {
        await sftp_server.put(file, `${process.env.SFTP_REMOTE_DIR}/${path.basename(file)}`)
    } catch (error) {
        throw error
    }
}

async function sftp_connect(sftp_server, sfpt_config) {
    try {
        await sftp_server.connect(sfpt_config)
        info_log(`Connected to SFTP server: ${process.env.SFTP_HOST}`)
    } catch (error) {
        throw error
    }
}

// TODO: save error in a single line
function error_log(message) {
    let date = new Date()
    let log = `${date.toISOString()} ${message}\n`
    if (process.env.NODE_ENV === 'production') {
        fs.appendFile(`${logDir}/error.log`, log, (err) => {
            if (err) {
                console.log(err)
            }
        })
        return
    }
    console.error(`\x1b[31m${log}\x1b[0m`)
}

function info_log(message) {
    let date = new Date()
    let log = `${date.toISOString()} ${message}\n`
    if (process.env.NODE_ENV === 'production') {
        fs.appendFile(`${logDir}/info.log`, log, (err) => {
            if (err) {
                console.log(err)
            }
        })
        return
    }
    console.log(log)
}
