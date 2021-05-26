import React from 'react';
import PropTypes from 'prop-types';
import mapboxgl from 'mapbox-gl';
import {Card, CardBody, HeadingText, NrqlQuery, Spinner, AutoSizer} from 'nr1';

export default class RealtimeMapVisualization extends React.Component {
  static propTypes = {
    accountId: PropTypes.number,
    token: PropTypes.string,
  };

  map = null;

  constructor(props) {
    super(props);
    this.state = {
      lng: 41.2284,
      lat: 80.9098,
      zoom: 0
    };
    this.mapContainer = React.createRef();
  }

  componentDidUpdate(prevProps) {
    if (this.props.token !== prevProps.token) this.mapAndLoad(this.props.token);
    if (this.props.accountId !== prevProps.accountId) this.loadMapData(this.props.accountId);
  }

  componentDidMount() {
    const {accountId, token} = this.props;

    if (token) this.mapAndLoad(token);
  }

  mapAndLoad = token => {
    const { accountId } = this.props;

    this.setToken(token);
    this.renderMap();

    if (accountId) this.loadMapData(accountId);
  }

  setToken = token =>  mapboxgl.accessToken = token;

  renderMap = () => {
    if (!mapboxgl.accessToken) return;
    const { lng, lat, zoom } = this.state;

    try {
      this.map = new mapboxgl.Map({
        container: this.mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v10',
        center: [lng, lat],
        zoom: zoom
      });

      this.map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    } catch (e) {
      console.log(e);
    }
  }

  loadMapData = async accountId => {
    if (!accountId || !this.map) return;
    setTimeout(this.loadMapData, 30000, accountId);
    console.info(`polling data at ${(new Date()).toTimeString()}`);

    const dt = Date.now();

    let query = 'SELECT duration, asnLatitude, asnLongitude, timestamp ';
    query += `FROM BrowserInteraction SINCE ${dt-30000} UNTIL ${dt} LIMIT MAX`;

    const { data } = await NrqlQuery.query({query, accountId});

    if (data.length && data[0]['data']) {
      const mapData = data[0]['data'].reduce((acc, cur) => {
        const ago = dt - cur.timestamp;
        if (!(ago in acc)) acc[ago] = {};
        const [lat, lng] = [cur.asnLatitude, cur.asnLongitude].map(i => i.toFixed(1));
        if (lat && lng) {
          const latlng = `at${lat}x${lng}`;
          if (!(latlng in acc[ago])) acc[ago][latlng] = {durations: [], lnglat: [lng, lat]};
          acc[ago][latlng].durations.push(cur.duration);
        }
        return acc;
      }, {});

      Object.keys(mapData).map(ms => {
        setTimeout(this.animateMarkers, parseInt(ms, 10), mapData[ms]);
      });
    }
  }

  animateMarkers = data => {
    if (!this.map) return;

    Object.keys(data).map(loc => {
      const durations = data[loc]['durations'];
      const avgDur = durations.reduce((a, c) => a + c, 0) / durations.length;
      const color = avgDur > 4.8 ? 'red' : avgDur > 1.2 ? 'yellow' : 'green';

      const dot = document.createElement('div');
      dot.classList.add(`${color}-dot`);
      const marker = new mapboxgl.Marker(dot)
        .setLngLat(data[loc]['lnglat'])
        .addTo(this.map);
      //setTimeout(el => el.classList.add('in') , 0, dot);
      setTimeout(this.removeMarker, 3000, marker);
    });
  }

  removeMarker = marker => marker.remove();

  render() {
    const {accountId, token} = this.props;

    return (
      <AutoSizer>
        {({width, height}) => (
          <div ref={this.mapContainer} className="map-container" />
        )}
      </AutoSizer>
    );
  }
}

const EmptyState = () => (
  <Card className="EmptyState">
    <CardBody className="EmptyState-cardBody">
      <HeadingText
        spacingType={[HeadingText.SPACING_TYPE.LARGE]}
        type={HeadingText.TYPE.HEADING_3}
      >
        Mapbox access token & account ID are required to display the visualization
      </HeadingText>
    </CardBody>
  </Card>
);

const ErrorState = () => (
  <Card className="ErrorState">
    <CardBody className="ErrorState-cardBody">
      <HeadingText
        className="ErrorState-headingText"
        spacingType={[HeadingText.SPACING_TYPE.LARGE]}
        type={HeadingText.TYPE.HEADING_3}
      >
        Oops! Something went wrong.
      </HeadingText>
    </CardBody>
  </Card>
);
