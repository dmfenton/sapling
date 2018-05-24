const Sapling = require('./')
const fetch = require('node-fetch')
const input = process.argv[2]
const size = process.argv[3] || 500

async function main () {
  const features = await fetch(input).then(r => { return r.json() })
  const dom = Sapling.createMap(features, { size: { height: size, width: size } })
  console.log(dom)
}

main()
