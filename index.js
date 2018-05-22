const centroid = require('@turf/centroid')
const extent = require('@turf/bbox')
const projection = require('@turf/projection')
const bbox2Polygon = require('@turf/bbox-polygon')
const EmptyMap = require('emptymap.js')
const geojson2svg = require('geojson2svg')
const MapTheTiles = require('map-the-tiles')
const { flatMap, flatten, get } = require('lodash')
const Handlebars = require('handlebars')
const fs = require('fs')
const template = fs.readFileSync('./template.hbs').toString()
const render = Handlebars.compile(template)
const ZOOM_CONST = 2 ** 20

const BASEMAPS = {
  esri: {
    topo: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}',
    street: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/{x}',
    natgeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/${z}/${y}/${x}',
    imagery: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}'
  },
  osm: {
    street: 'https://tile.openstreetmap.org/${z}/${x}/${y}'
  },
  stamen: {
    toner: 'http://tile.stamen.com/toner/{z}/{x}/{y}',
    terrain: 'http://tile.stamen.com/terrain/{z}/{x}/{y}',
    watercolor: 'http://tile.stamen.com/watercolor/{z}/{x}/{y}'
  }
}

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
    this.basemap = options.basemap ? get(BASEMAPS, options.basemap) : get(BASEMAPS, 'esri.natgeo')

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
    this.recalculate()
    return true
  }

  addBboxes (bboxes) {
    this.features = this.concat(bboxes.map(b => {
      return projection.toMercator(bbox2Polygon(flatten(b)))
    }))
    this.recalculate()
    return true
  }

  recalculate () {
    this.extent = extent({type: 'FeatureCollection', features: this.features})
    this.center = calculateCenter(this.extent)
    this.zoom = calculateZoom(this.extent)
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
    const tiles = this.getTiles()

    return render({
      matrix,
      paths,
      tiles
    })
  }

  getTiles () {
    const tileOpts = this.tiler.getTiles(this.center.geometry.coordinates, Math.ceil(this.zoom))
    const basemap = this.basemap
    return tileOpts.map(t => {
      return {
        url: this.basemap.replace('${z}', t.z).replace('${x}', t.x).replace('${y}', t.y),
        top: t.top,
        left: t.left
      }
    })
  }
 }

function calculateCenter (extent) {
  return centroid(bbox2Polygon(extent))
}

function calculateZoom (bbox) {
  const wgsExtent = extent(projection.toWgs84(bbox2Polygon(bbox)))
  const [xMin, yMin, xMax, yMax] = wgsExtent

  const xDiff = xMax - xMin
  const yDiff = yMax - yMin

  const maxDiff = xDiff > yDiff ? xDiff : yDiff

  let zoomLevel
  if (maxDiff < 360 / ZOOM_CONST) {
    zoomLevel = 21
  } else {
    zoomLevel = -1 * ((Math.log(maxDiff) / Math.log(2)) - (Math.log(360) / Math.log(2)))
    if (zoomLevel < 1) zoomLevel = 1
  }

  return zoomLevel
}

function formatTiles (basemap, options) {
  return {
    url,
    top: options.top,
    left: options.left
  }
}

module.exports = Sapling
