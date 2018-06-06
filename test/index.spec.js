const test = require('tape')
const Sapling = require('../')
const featureCollection = require('./fixtures/featureCollection.json')

test('Making a map', t => {
  const sapling = new Sapling({ size: {width: 1024, height: 768} })
  sapling.addFeatures(featureCollection.features)
  const dom = sapling.createDom()
  t.ok(dom.match(/<img/g).length > 4, 'has enough tiles')
  t.ok(/<svg/.test(dom), 'has opening svg tag')
  t.ok(/<\/svg>/.test(dom), 'has closing svg tag')
  t.equal(dom.match(/<path/g).length, 3, 'has 3 opening path tags')
  t.equal(dom.match(/<\/path>/g).length, 3, 'has 3 closing path tags')
  t.end()
})
