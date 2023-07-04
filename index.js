"use strict"

import dotenv from 'dotenv'
import express from 'express'
import axios from 'axios'
import fs from 'fs'

dotenv.config()

let imgDir = process.env.IMG_DIR || './imgs'
let logDir = process.env.LOG_DIR || './logs'

if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
}

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const token = process.env.WHATSAPP_TOKEN
const port = process.env.PORT || 3000

const whatsappMediaUrl = "https://graph.facebook.com/v17.0"
const app = express()

app.use(express.json())

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
            const message = req.body.entry[0].changes[0].value.messages[0];
            let imgData
            if (message.type === "document" && message.document.mime_type.match(/image\/.*/)) {
                imgData = message.document
            } else if (message.type === "image") {
                imgData = message.image
            } else {
                res.sendStatus(200);
                return;
            }
            let response = await fetch(`${whatsappMediaUrl}/${imgData.id}`, {
                method: 'GET',
                headers: new Headers({
                    'Authorization': `Bearer ${token}`
                })
            })
            let img = await response.json()
            let imgType = imgData.mime_type.split('/')[1]
            if (!img.url) {
                console.log("No image url found");
                res.sendStatus(200);
                return;
            }
            try {
                await downloadFile(img.url, `${imgDir}/${imgData.id}.${imgType}`, `Bearer ${token}`)
            } catch (error) {
                console.log(error);
            }
        }
        res.sendStatus(200);
    } else {
        // Return a '404 Not Found' if event is not from a WhatsApp API
        res.sendStatus(404);
    }
});

app.get("/webhook", (req, res) => {
    /**
     * UPDATE YOUR VERIFY TOKEN
     *This will be the Verify Token value when you set up webhook
    **/
    const verify_token = process.env.VERIFY_TOKEN;
    console.log("verify_token: " + verify_token);

    // Parse params from the webhook verification request
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    // Check if a token and mode were sent
    if (mode && token) {
        // Check the mode and token sent are correct
        if (mode === "subscribe" && token === verify_token) {
            // Respond with 200 OK and challenge token from the request
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

app.listen(port, () => {
    console.log(`webhook listening at port ${port}`)
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
        });

        while (response.status >= 300 && response.status <= 399) {
            const redirectUrl = response.headers.location;
            response = await axios({
                method: 'GET',
                url: redirectUrl,
                maxRedirects: 0,
                responseType: 'arraybuffer',
                headers: {
                    Authorization: authorizationHeader
                }
            });
        }

        fs.writeFileSync(outputPath, response.data);
        console.log('File has been downloaded and saved.');
    } catch (error) {
        console.error('Error downloading the file:', error);
    }
}
