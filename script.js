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

        this.map.flyTo(latlon, this._flyZoom);
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
        <span>N=${this.x.count}</span><span>Min</span><span>Avg</span><span>Max</span>
        <span>Lon</span><span>${this.x.min.toFixed(digits)}</span><span>${this.x.avg.toFixed(digits)}</span><span>${this.x.max.toFixed(digits)}</span>
        <span>Lat</span><span>${this.y.min.toFixed(digits)}</span><span>${this.y.avg.toFixed(digits)}</span><span>${this.y.max.toFixed(digits)}</span>
        <span>Alt</span><span>${this.z.min.toFixed(digits)}</span><span>${this.z.avg.toFixed(digits)}</span><span>${this.z.max.toFixed(digits)}</span>
        <span>Acc</span><span>${this.a.min.toFixed(digits)}</span><span>${this.a.avg.toFixed(digits)}</span><span>${this.a.max.toFixed(digits)}</span>
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