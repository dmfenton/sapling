const centroid = require('@turf/centroid')
const extent = require('@turf/bbox')
const projection = require('@turf/projection')
const bbox2Polygon = require('@turf/bbox-polygon')
const EmptyMap = require('emptymap.js')
const MapTheTiles = require('map-the-tiles')
const d3 = require('d3')
const { compact, flatMap, flatten, get } = require('lodash')
const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const template = fs.readFileSync(path.join(__dirname, './template.hbs')).toString()
const render = Handlebars.compile(template)
const ZOOM_CONST = 2 ** 20

const BASEMAPS = {
  esri: {
    topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}',
    street: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/{x}',
    natgeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/${z}/${y}/${x}',
    imagery: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}'
  },
  osm: {
    street: 'https://tile.openstreetmap.org/${z}/${x}/${y}'
  }, stamen: {
    toner: 'https://tile.stamen.com/toner/{z}/{x}/{y}',
    terrain: 'https://tile.stamen.com/terrain/{z}/{x}/{y}',
    watercolor: 'https://tile.stamen.com/watercolor/{z}/{x}/{y}'
  }
}

const DEFAULT_STYLE = {
  MultiPolygon: {
    stroke: 'blue',
    'stroke-width': '2px',
    // fill: 'transparent'
  },
  Polygon: {
    stroke: 'blue',
    'stroke-width': '2px',
    fill: 'transparent'
  },
  Point: {
    'stroke': 'rgb(220, 220, 220)',
    'stroke-opacity': '1',
    'stroke-width': '0.03',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': '4',
    fill: 'red',
    'fill-opacity': '0.882353',
    'fill-rule': 'evenodd'
  }
}

class Sapling {
  constructor (options = {}) {
    this.size = options.size || { width: 256, height: 256 }
    this.map = new EmptyMap(this.size)
    this.tiler = new MapTheTiles(this.size)
    this.basemap = options.basemap ? get(BASEMAPS, options.basemap) : get(BASEMAPS, 'esri.natgeo')
    this.style = options.style || DEFAULT_STYLE

    this.features = []
    this.center = [0, 0]

    if (options.features) {
      this.addFeatures(options.features)
    }
  }

  static createMap (features, options) {
    const sapling = new Sapling({...options, features})
    return sapling.createDom()
  }

  addFeatures (features, options = {}) {
    const style = options.style || DEFAULT_STYLE
    if (features.type === 'FeatureCollection') {
      features = features.features
    } else if (features.type === 'Feature') {
      features = [ features ]
    }
    this.features = this.features.concat(features.map(f => {
      if (!get(f, 'geometry.coordinates')) return
      f.style = f.style || style[f.geometry.type]
      return f
    }))
    this.recalculate()
  }

  addBboxes (bboxes, options) {
    this.addFeatures(bboxes.map(b => {
      return bbox2Polygon(flatten(b))
    }), options)
  }

  recalculate () {
    this.features = compact(this.features)
    this.extent = extent({type: 'FeatureCollection', features: this.features})
    this.center = calculateCenter(this.extent).geometry.coordinates
    this.zoom = calculateZoom(this.extent)
  }

  createDom () {
    // calculate transformation matrix
    this.map.setView({
      center: projection.toMercator(this.center),
      zoom: this.zoom
    })

    const paths = createPaths(this.features, {size: this.size, center: this.center, extent: calculateExtent(this.map.getExtent())})
    const tiles = this.getTiles()
    return render({
      paths,
      tiles,
      size: this.size
    })
  }

  getTiles () {
    const tileOpts = this.tiler.getTiles(projection.toMercator(this.center), this.zoom)
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
  const [xMin, yMin, xMax, yMax] = bbox

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
  zoomLevel = Math.round(zoomLevel)
  // return zoomLevel < 1 ? 1 : zoomLevel
  return zoomLevel + 2
}

function formatTiles (basemap, options) {
  return {
    url,
    top: options.top,
    left: options.left
  }
}

function calculateExtent (mapExtent) {
  const { ll, ur } = mapExtent
  const f = projection.toWgs84(bbox2Polygon([...ll, ...ur]))
  f.geometry.coordinates[0].reverse()
  return f
}

function createPaths (features, options) {
  const { width, height } = options.size
  const projection = d3.geoMercator()
    .center(options.center)
    .fitSize([width, height], options.extent)

  const path = d3.geoPath(projection)
  return features.map(f => {
    const style = createStyle(f)
    const attributes = Object.entries(style).reduce((attrString, [key, value]) => {
      return `${attrString}${key}="${value}" `
    }, '').slice(0, -1)
    return `<path ${attributes} d="${path(f)}"></path>`
  })
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
