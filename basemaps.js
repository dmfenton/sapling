 /* eslint-disable */

module.exports = {
  esri: {
    topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}', // eslint
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
