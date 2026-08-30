/**
 * @param {number} deg 
 * @returns {number} radians
 */
function radians(deg) { return deg * (Math.PI / 180); }

/** 
 * @param {GeolocationPosition} p1 
 * @param {GeolocationPosition} p2
*/
function haversine(p1, p2) {

    const avgEarthRadius = 6371.2 * 1000;// meters

    const dLat = radians(p2.coords.latitude - p1.coords.latitude);
    const dLon = radians(p2.coords.longitude - p1.coords.longitude);
    const lat1 = radians(p1.coords.latitude);
    const lat2 = radians(p2.coords.latitude);

    const a = Math.pow(Math.sin(dLat / 2), 2)
        + Math.cos(lat1)
        * Math.cos(lat2)
        * Math.pow(Math.sin(dLon / 2), 2);

    const c = 2 * Math.asin(Math.sqrt(a));

    return avgEarthRadius * c;
}


/** 
@typedef {Object} GeoidAPIResponse
@property {string} geoidModel  "GEOID12B",
@property {string} station  "UserStation",
@property {number} lat  40.0,
@property {string} latDms  "N400000.00000",
@property {number} lon  -80.0,
@property {string} lonDms  "W0800000.00000",
@property {number} geoidHeight  -33.185,
@property {number} error  0.07
*/

class GeoidCache {

    constructor() {
        /** @type {GeolocationPosition} */
        this.position = null;

        /** @type {GeoidAPIResponse} */
        this.geoid = null;
    }

    /**
     * @param {GeolocationPosition} position 
     * @returns {Promise<number|undefined>}
     */
    getGeoidHeight(position) {
        if (this.geoid !== null && this.position !== null) {
            const updateDistance = 100; // meters
            const movedDistance = haversine(position, this.position);
            console.log(`moved ${movedDistance}`);
            if (movedDistance < updateDistance)
                return Promise.resolve(this.geoid.geoidHeight);
        }

        const url = `https://geodesy.noaa.gov/api/geoid/ght?lat=${position.coords.latitude}&lon=${position.coords.longitude}`;
        const bypassCORS = `https://corsproxy.io/?key=webdemo1&url=${encodeURIComponent(url)}`;
        console.log(bypassCORS);
        return fetch(bypassCORS)
            .then(r => r.json())
            .then(d => this.onSuccess(d, position))
            .catch(this.onFailure);
    }

    /** 
     * @param {GeoidAPIResponse} geoid 
     * @param {GeolocationPosition} position
    */
    onSuccess(geoid, position) {
        this.position = position;
        this.geoid = geoid;
        console.log(`update geoid: ${geoid.geoidHeight}`);
        return geoid.geoidHeight;
    }

    onFailure(reason) {
        console.error(reason);
        return undefined;
    }
}


class MapView {

    /**
     * @param {string} mapID html ID tag for map element
     */
    constructor(mapID = "map") {
        this._initialLoc = [0, 0];
        this._initialZoom = 4;
        this._flyZoom = 19;
        this._locations = [];

        this.map = L.map(mapID).setView(this._initialLoc, this._initialZoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        this.currentLocationMarker = null;
        this.historyPath = null;
    }

    /**
     * @param {GeolocationPosition} position 
     */
    addPosition(position) {
        this._locations.push(position);
        if (this._locations.length > 2)
            this._locations = this._locations.slice(-2); // keep only most recent 2 here
        this._updatePath();
        this._updateCircle();
    }

    _updateCircle() {

        if (this._locations.length < 1)
            return;

        const p = this._locations.at(-1);
        const latlon = [p.coords.latitude, p.coords.longitude];
        const radius = p.coords.accuracy;

        if (this.currentLocationMarker)
            this.currentLocationMarker.remove();

        this.currentLocationMarker = L.circle(
            latlon, {
            color: "#0af",
            fillColor: "#0af",
            fillOpacity: 0.25,
            radius: radius
        }).addTo(this.map);

        this.map.flyTo(latlon, this._flyZoom, { duration: 0.5 });
    }

    _updatePath() {

        if (this._locations.length < 2)
            return;

        if (this.historyPath === null) {
            const coords = this._locations.map(p => [p.coords.latitude, p.coords.longitude]);
            this.historyPath = L.polyline(
                coords, {
                color: "#0af",
                opacity: 0.20
            }).addTo(this.map);
        }
        else {
            const p = this._locations.at(-1);
            const latlon = [p.coords.latitude, p.coords.longitude];
            this.historyPath.addLatLng(latlon);
        }
    }

    reset() {
        this.historyPath?.remove();
        this.historyPath = null;
        this.currentLocationMarker?.remove();
        this.currentLocationMarker = null;
    }
}

class Stat {
    constructor() {
        this.count = 0;
        this.sum = 0;
        this.min = Infinity;
        this.max = -Infinity;
    }

    /** @returns {number} */
    get avg() {
        return this.sum / (this.count || 1); // meh
    }

    /**
     * @param {number} x 
     */
    update(x) {
        if (x === null || x === undefined) return;
        this.count++;
        this.sum += x;
        this.min = Math.min(this.min, x);
        this.max = Math.max(this.max, x);
    }
}


class StatView {
    constructor(statID = "stats") {
        this.container = document.getElementById(statID);
        this.reset();
    }

    /**
     * @param {GeolocationPosition} position 
     */
    addPosition(position) {
        this.x.update(position.coords.longitude);
        this.y.update(position.coords.latitude);
        this.z.update(position.coords.altitude);
        this.a.update(position.coords.accuracy);
        this._updateContent();
    }

    reset() {
        this.container.innerHTML = "";
        this.x = new Stat();
        this.y = new Stat();
        this.z = new Stat();
        this.a = new Stat();
    }

    _updateContent() {
        const digits = 6;
        this.container.innerHTML = `
        <span>N=${this.x.count}</span><b>Min</b><b>Avg</b><b>Max</b>
        <b>Lon</b><span>${this.x.min.toFixed(digits)}</span><span>${this.x.avg.toFixed(digits)}</span><span>${this.x.max.toFixed(digits)}</span>
        <b>Lat</b><span>${this.y.min.toFixed(digits)}</span><span>${this.y.avg.toFixed(digits)}</span><span>${this.y.max.toFixed(digits)}</span>
        <b>Alt</b><span>${this.z.min.toFixed(digits)}</span><span>${this.z.avg.toFixed(digits)}</span><span>${this.z.max.toFixed(digits)}</span>
        <b>Acc</b><span>${this.a.min.toFixed(digits)}</span><span>${this.a.avg.toFixed(digits)}</span><span>${this.a.max.toFixed(digits)}</span>
        `;
    }
}


class TableView {
    /**
     * 
     * @param {string} tableID html element ID of position table
     */
    constructor(tableID = "table") {
        /** @type {HTMLTableElement} */
        this.table = document.getElementById(tableID);
        this.tableBody = this.table.createTBody();
        this.reset();
    }

    /**
     * @param {GeolocationPosition} position 
     */
    addPosition(position) {
        const digits = 6;
        const row = this.tableBody.insertRow(0);
        row.insertCell().append(new Date(position.timestamp).toLocaleTimeString());
        row.insertCell().append(position.coords.longitude?.toFixed(digits));
        row.insertCell().append(position.coords.latitude?.toFixed(digits));
        row.insertCell().append(position.coords.altitude?.toFixed(digits));
    }

    reset() {
        while (this.tableBody.rows.length != 0) {
            this.tableBody.deleteRow(-1);
        }
    }
}


/**
 * @callback updateCallback
 * @param {GeolocationPosition} position 
 */

/**
 * GPS log and save functionality.
 */
class Logger {

    /**
     * @param {string} mapID html ID tag for map element
     */
    constructor() {
        /** @type {GeolocationPosition[]} */
        this.locations = [];

        /** @type {number|null} */
        this.watchHandle = null;

        /** @type {updateCallback[]} */
        this._updateListeners = [];
    }

    /**
     * 
     * @param {updateCallback} listener 
     */
    addUpdateListener(listener) {
        this._updateListeners.push(listener);
    }

    /**
     * @param {GeolocationPosition} position 
     */
    addPosition(position) {
        this.locations.push(position);
        for (const listener of this._updateListeners) {
            listener(position);
        }
    }

    /**
     * @param {string} filename 
     */
    saveLocations(filename) {
        const json = JSON.stringify(this.locations);
        const blob = new Blob([json], { type: "text/plain;charset=utf-8" });
        localStorage.setItem(filename, json);
        saveAs(blob, filename); // FileSaver.js
    }

    startWatch() {
        this.stopWatch();

        this.watchHandle = navigator.geolocation.watchPosition(
            (position) => {
                console.log(position);
                this.addPosition(position);
            },
            (err) => {
                console.error(err);
            },
            { enableHighAccuracy: true }
        );

        console.log(`started watch ${this.watchHandle}`)
    }

    stopWatch() {
        if (this.watchHandle !== null) {
            navigator.geolocation.clearWatch(this.watchHandle);
            console.log(`cleared watch ${this.watchHandle}`)
            this.watchHandle = null;
        }
    }

    reset() {
        this.stopWatch();
        this.locations = [];
    }
};

class App {

    constructor() {
        this.btnStart = document.getElementById("btnStart");
        this.btnStop = document.getElementById("btnStop");
        this.btnSave = document.getElementById("btnSave");
        this.btnReset = document.getElementById("btnReset");

        this.btnStart.addEventListener("click", () => this.start());
        this.btnStop.addEventListener("click", () => this.stop());
        this.btnSave.addEventListener("click", () => this.save());
        this.btnReset.addEventListener("click", () => this.reset());

        this.mapView = new MapView("map");
        this.tableView = new TableView("table");
        this.statView = new StatView("stats");
        this.logger = new Logger();
        this.logger.addUpdateListener(position => this.mapView.addPosition(position));
        this.logger.addUpdateListener(position => this.tableView.addPosition(position));
        this.logger.addUpdateListener(position => this.statView.addPosition(position));
    }

    /** @returns {string} a datetime based filename */
    get logFilename() {
        const datestring = (new Date()).toISOString().replaceAll(":", "-");
        const filename = `log_${datestring}.json`;
        return filename;
    }

    start() {
        this.btnStart.disabled = true;
        this.btnStop.disabled = false;
        this.btnSave.disabled = true;
        this.btnReset.disabled = true;

        this.logger.startWatch();
    }

    stop() {
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
        this.btnSave.disabled = false;
        this.btnReset.disabled = false;

        this.logger.stopWatch();
    }

    save() {
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
        this.btnSave.disabled = true;
        this.btnReset.disabled = false;

        this.logger.saveLocations(this.logFilename);
    }

    reset() {
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
        this.btnSave.disabled = true;
        this.btnReset.disabled = true;

        this.logger.reset();
        this.mapView.reset();
        this.tableView.reset();
        this.statView.reset();
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.app = new App();
    console.log("started app");
});