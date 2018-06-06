const Sapling = require('./')
const fetch = require('node-fetch')
const input = process.argv[2]
const width = process.argv[3] || 500
const height = process.argv[4] || 500


async function main () {
  const features = await fetch(input).then(r => { return r.json() })
  const dom = Sapling.createMap(features, { size: { height, width } })
  console.log(dom)
}

main()
