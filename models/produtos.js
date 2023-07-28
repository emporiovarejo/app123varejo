const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const produto = new Schema({
    id: String,
    categ_id: String,
    title: String,
    createDate: Date,
    permalink: String,
    thumbnail: String,
    fulfillment: Boolean,
    reputation: String,
    brand_id: Number,
    brand_name: String,
    seller_id: Number,
    seller_nickname: String,
    path_from_root: Object,
})

module.exports = mongoose.model('Produto', produto);