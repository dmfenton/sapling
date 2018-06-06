const centroid = require('@turf/centroid')
const extent = require('@turf/bbox')
const projection = require('@turf/projection')
const bbox2Polygon = require('@turf/bbox-polygon')
const EmptyMap = require('emptymap.js')
const MapTheTiles = require('map-the-tiles')
const d3 = require('d3')
const { compact, flatten, get } = require('lodash')
const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const template = fs.readFileSync(path.join(__dirname, './template.hbs')).toString()
const render = Handlebars.compile(template)
const ZOOM_CONST = 2 ** 20
const BASEMAPS = require('./basemaps')
const DEFAULT_STYLE = require('./style')

class Sapling {
  constructor (options = {}) {
    this.size = options.size || { width: 256, height: 256 }
    this.zoomBias = options.zoomBias
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
    this.zoom = calculateZoom(this.extent, { bias: this.zoomBias })
  }

  createDom () {
    // calculate transformation matrix
    this.map.setView({
      center: projection.toMercator(this.center),
      zoom: this.zoom
    })

    const paths = createPaths(
      this.features,
      {
        size: this.size,
        center: this.center,
        extent: calculateExtent(this.map.getExtent())
      }
    )

    const tiles = this.getTiles()
    return render({
      paths,
      tiles,
      size: this.size
    })
  }

  getTiles () {
    const tileOpts = this.tiler.getTiles(projection.toMercator(this.center), this.zoom)
    return tileOpts.map(t => {
      return {
        url: this.basemap.replace('${z}', t.z).replace('${x}', t.x).replace('${y}', t.y), // eslint-disable-line
        top: t.top,
        left: t.left
      }
    })
  }
 }

function calculateCenter (extent) {
  return centroid(bbox2Polygon(extent))
}

function calculateZoom (bbox, options = {}) {
  const [xMin, yMin, xMax, yMax] = bbox
  const bias = options.bias || 0

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
  return zoomLevel + bias
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
