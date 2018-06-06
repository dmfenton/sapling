const Benchmark = require('benchmark');
const fs = require('fs')
const Sapling = require('./')
const featureCollection = require('./test/fixtures/featureCollection.json')

const bench = new Benchmark('Two Feature', function () {
  const sapling = new Sapling()
  sapling.addFeatures(featureCollection.features)
  return sapling.createDom()
})

bench.run()

console.log(bench.hz)
