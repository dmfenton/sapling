const centroid = require('@turf/centroid')
const extent = require('@turf/bbox')
const projection = require('@turf/projection')
const bbox2Polygon = require('@turf/bbox-polygon')
const EmptyMap = require('emptymap.js')
const geojson2svg = require('geojson2svg')
const MapTheTiles = require('map-the-tiles')
const { compact, flatMap, flatten, get } = require('lodash')
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

const DEFAULT_STYLE = {
  Polygon: {
    stroke: 'blue',
    'stroke-width': '0.05px',
    fill: 'transparent'
  },
  Point: {
    'stroke': 'rgb(220, 220, 220)',
    'stroke-opacity': '1',
    'stroke-width': '0.03',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': '4',
    fill: 'rgb(49, 130, 189)',
    'fill-opacity': '0.882353',
    'fill-rule': 'evenodd',
    transform: 'matrix(1, 0, 0, 1, 0, 0)'
  }
}

class Sapling {
  constructor (options = {}) {
    this.size = options.size || { width: 256, height: 256 }
    this.map = new EmptyMap(this.size)
    this.converter = geojson2svg(this.size)
    this.tiler = new MapTheTiles(this.size)
    this.basemap = options.basemap ? get(BASEMAPS, options.basemap) : get(BASEMAPS, 'esri.natgeo')
    this.style = options.style || DEFAULT_STYLE

    this.features = []
    this.center = Object.assign({}, nullIsland)

    if (options.features) {
      this.addFeatures(options.features)
    }
  }

  addFeatures (features, options = {}) {
    const style = options.style || DEFAULT_STYLE
    this.features = this.features.concat(features.map(f => {
      if (!get(f, 'geometry.coordinates')) return
      const projected = projection.toMercator(f)
      projected.style = style[f.geometry.type]
      return projected
    }))
    this.recalculate()
  }

  addBboxes (bboxes, options) {
    this.addFeatures(bboxes.map(b => {
      return projection.toMercator(bbox2Polygon(flatten(b)))
    }), options)
  }

  recalculate () {
    this.features = compact(this.features)
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
      return this.converter.convert(f, {
        attributes: createStyle(f),
        pointAsCircle: true,
        r: 0.05
      })
    })
    const tiles = this.getTiles()

    return render({
      matrix,
      paths,
      tiles,
      size: this.size
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

function createStyle (feature) {
  let style
  if (typeof feature.style === 'function') {
    style = feature.style(feature)
  } else {
    style = feature.style
  }
  return style
}

module.exports = Sapling
