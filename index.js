const express = require("express");
const axios = require("axios");
const axiosRetry = require('axios-retry');
const app = express();
var port = 7000
process.env.TZ = "Brazil/Sao_Paulo";

var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


const mongoose = require('mongoose');
require('./database/mongoose')
require('./models/historico')
require('./models/produtos')

const Historico = mongoose.model('Historico')
const Produto = mongoose.model('Produto')

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

app.post("/product/create", async (req, res) => {
    const products = req.body
    if (products instanceof Array) {

        var start = new Date();
        var end = new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const response = await Promise.all(

            products.map(async (produto) => {
                await Historico.deleteMany({
                    id: produto.id,
                    data: {
                        $gte: start,
                        $lt: end
                    }
                })
                // .then((data) => console.log('Regitro excluido com sucesso.'))

                Historico({
                    id: produto.id,
                    data: new Date(),
                    sold: produto.sold,
                    price: produto.price
                }).save()
                //.then((data) => console.log('Regitro salvo com sucesso.'))

                await Produto.deleteMany({ id: produto.id })
                return Produto(produto).save()

            })
        )
        res.send(response)
    } else {
        res.send({ error: true, message: 'Nao recebeu uma array de produtos' })
    }


})

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
                    if (data.initialState.app == 'vip') {
                        data.translations.process = { process_id: process.pid }
                        data.translations.process.duration = (new Date() - startTime) / 1000
                        var seller = data.initialState.components.seller.seller
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
                            "official_store_id": seller ? +seller.official_store_id : null,
                            "official_store_name": seller ? seller.name : null,
                            "path_from_root": data.initialState.track.analytics_event.custom_dimensions.pathFromRoot,
                        }

                        return product
                    } else {
                        return { id: id, error: true, message: 'Produto de catálogo.', duration: (new Date() - startTime) / 1000 }
                    }
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
    if (req.query.write) {
        var start = new Date();
        var end = new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        response = response.filter((e) => e !== null && !e.error)

        const res = await Promise.all(

            response.map(async (produto) => {
                await Historico.deleteMany({
                    id: produto.id,
                    data: {
                        $gte: start,
                        $lt: end
                    }
                })
                // .then((data) => console.log('Regitro excluido com sucesso.'))

                Historico({
                    id: produto.id,
                    data: new Date(),
                    sold: produto.sold,
                    price: produto.price
                }).save()
                //.then((data) => console.log('Regitro salvo com sucesso.'))

                await Produto.deleteMany({ id: produto.id })
                return Produto(produto).save()

            })
        )
        // console.log(res)
    }

    res.send(response);
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
