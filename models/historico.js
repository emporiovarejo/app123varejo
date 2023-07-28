const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const historico = new Schema({
    id: String,
    data: Date,
    price: Number,
    sold: Number,
})

module.exports = mongoose.model('Historico', historico);