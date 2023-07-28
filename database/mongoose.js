const mongoose = require('mongoose')
const URI = 'mongodb+srv://123varejo:123varejo@cluster0.lb6auwt.mongodb.net/products?retryWrites=true&w=majority';
mongoose
    .connect(URI)
    .then(() => console.log('Database On-Line.'))
    .catch(() => console.log(err))
