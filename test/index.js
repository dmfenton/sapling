const fs = require('fs')
const Sapling = require('../')

const featureCollection = require('./fixtures/featureCollection.json')

const sapling = new Sapling()
sapling.addFeatures(featureCollection.features)
const dom = sapling.createDom()
console.log(dom)

const html = `
<html>
<head>
  <style>
    .default {
      stroke: red;
      stroke-width: 0.05px;
      fill: transparent;
    }
  </style>
</head>
<body>
${dom}
</body>
</html>
`

fs.writeFileSync('./test.html', html)
