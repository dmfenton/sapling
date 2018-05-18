const centroid = require('@turf/centroid')
const extent = require('@turf/bbox')
const EmptyMap = require('emptymap.js')
const bbox2Polygon = require('@turf/bbox-polygon')
const geojson2svg = require('geojson2svg')
const MapTheTiles = require('map-the-tiles')
const projection = require('@turf/projection')
const { flatMap } = require('lodash')
const Handlebars = require('handlebars')
const fs = require('fs')
const template = fs.readFileSync('./template.hbs').toString()
const render = Handlebars.compile(template)

const nullIsland = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [0, 0]
  }
}

class Sapling {
  constructor (options = {}) {
    const size = options.size || { width: 500, height: 500 }
    this.map = new EmptyMap(size)
    this.converter = geojson2svg(size)
    this.tiler = new MapTheTiles(size)

    this.features = []
    this.center = Object.assign({}, nullIsland)

    if (options.features) {
      this.addFeatures(options.features)
    }
  }

  addFeatures (features) {
    this.features = this.features.concat(features.map(f => {
      return projection.toMercator(f)
    }))
    this.extent = extent({type: 'FeatureCollection', features: this.features})
    this.center = calculateCenter(this.extent)
    this.zoom = calculateZoom(this.extent)
    console.log(this.center.geometry.coordinates)
    console.log(this.extent)
    console.log(this.zoom)
    console.log(JSON.stringify(this.features))
    return true
  }

  createDom () {
    // calculate transformation matrix
    this.map.setView({
      center: this.center.geometry.coordinates,
      zoom: this.zoom
    })
    const matrix = `matrix(${this.map.matrix.m.join(', ')})`
    const paths = flatMap(this.features, f => {
      return this.converter.convert(f,
      {attributes: {class: 'default'}})
    })
    const tiles = this.tiler.getTiles(this.center.geometry.coordinates, this.zoom)
    return render({
      matrix,
      paths,
      tiles
    })
  }
 }

function calculateCenter (extent) {
  return centroid(bbox2Polygon(extent))
}

function calculateZoom () {
  return 6
}

//  int zoomLevel;
// double latDiff = latMax - latMin;
// double lngDiff = lngMax - lngMin;
//
// double maxDiff = (lngDiff > latDiff) ? lngDiff : latDiff;
// if (maxDiff < 360 / Math.pow(2, 20)) {
//     zoomLevel = 21;
// } else {
//     zoomLevel = (int) (-1*( (Math.log(maxDiff)/Math.log(2)) - (Math.log(360)/Math.log(2))));
//     if (zoomLevel < 1)
//         zoomLevel = 1;
// }

module.exports = Sapling
