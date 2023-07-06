const express = require("express");
const axios = require("axios");
const axiosRetry = require('axios-retry');
const app = express();
var port = 7000
axiosRetry(axios, {
    retries: 10,
    retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`);
        return retryCount //* 2000;
    },
    retryCondition: (error) => { return error.response.status !== 200 },
});

const cabecalho = async () => {
    const scrapeopsAPIKey = 'e3fa314e-ec21-4061-87e5-73b6ff7a33a2';
    const scrapeopsURL = `http://headers.scrapeops.io/v1/browser-headers?api_key=${scrapeopsAPIKey}`
    const HeadersList = await axios(scrapeopsURL).then(data => data.data).catch(err => ([]))
    const userHeaderList = HeadersList.result
    const header = userHeaderList ? userHeaderList[Math.floor(Math.random() * userHeaderList.length)] : {}
    return header
}


app.get("/", (req, res) => {
    axios.get('http://httpbin.org/ip')
        .then((response) => response.data)
        .then((response) => res.send(response))
        .catch((error) => res.send(error.message))
});

app.get('/getProductData', async (req, res) => {
    let ids = req.query.ids

    var startTime = new Date()
    ids = ids.split(',')
    ids = ids.map((id) => id.replace('MLB-', 'MLB').replace('MLB', 'MLB-'))

    var response = await Promise.all(
        ids.map(async (id) => axios.get(`https://produto.mercadolivre.com.br/${id}`, {
            headers: cabecalho()
        }, { timeout: 60000 }).then((response) => {
            try {
                const regex = /window\.__PRELOADED_STATE__\s*=\s*({.*?});/;
                const match = response.data.match(regex);
                if (match) {
                    const data = JSON.parse(match[1]);
                    data.translations.process = { process_id: process.pid }
                    data.translations.process.duration = (new Date() - startTime) / 1000

                    const diffInDays = Math.floor((new Date() - new Date(data.initialState.track.gtm_event.startTime)) / (1000 * 60 * 60 * 24));

                    var product =
                    {
                        "id": data.initialState.id,
                        "categ_id": data.initialState.track.melidata_event.event_data.category_id,
                        "title": data.initialState.share.title,
                        "price": +data.initialState.track.melidata_event.event_data.price,
                        "days": +diffInDays,
                        "sold": +data.initialState.track.gtm_event.soldStock,
                        "average": +Math.floor(data.initialState.track.gtm_event.soldStock / diffInDays),
                        "createDate": data.initialState.track.gtm_event.startTime,
                        "permalink": data.initialState.share.permalink,
                        "thumbnail": `https://http2.mlstatic.com/D_${data.initialState.share.picture.id}-I.jpg`,
                        "fulfillment": data.initialState.track.analytics_event.custom_dimensions.customDimensions.fulfillment == "YES",
                        "reputation": data.initialState.track.melidata_event.event_data.power_seller_status,
                        "official_store": data.initialState.track.melidata_event.event_data.official_store_id,
                        "brand_id": +data.initialState.track.melidata_event.event_data.item_attribute_brand_id || null,
                        "brand_name": data.initialState.track.gtm_event.brandId || null,
                        "seller_id": +data.initialState.track.melidata_event.event_data.seller_id,
                        "seller_nickname": data.initialState.track.analytics_event.custom_dimensions.customDimensions.collectorNickname,
                        "path_from_root": data.initialState.track.analytics_event.custom_dimensions.pathFromRoot,
                    }

                    return product
                } else {
                    return { id: id, error: true, message: 'Produto não encontrado.', duration: (new Date() - startTime) / 1000 }
                }
            } catch (err) {
                return { id: id, error: true, message: err.message, duration: (new Date() - startTime) / 1000 }
            }
        }).catch((err) => {
            return { id: id, error: true, message: err.message, duration: (new Date() - startTime) / 1000 }
        }))
    )
    res.send(response);
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
