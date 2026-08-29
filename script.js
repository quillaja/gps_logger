class MapView {

    /**
     * @param {string} mapID html ID tag for map element
     */
    constructor(mapID = "map") {
        this.map = L.map(mapID).setView([0, 0], 18);
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
        this.locations.push(position);
        this._updatePath();
        this._updateCircle();
    }

    _updateCircle() {

        if (this.locations.length < 1)
            return;

        const p = this.locations.at(-1);
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

        this.map.flyTo(latlon);
    }

    _updatePath() {

        if (this.locations.length < 2)
            return;

        if (this.historyPath === null) {
            const coords = this.locations.map(p => [p.coords.latitude, p.coords.longitude]);
            this.historyPath = L.polyline(
                coords, {
                color: "#0af",
                opacity: 0.20
            }).addTo(this.map);
        }
        else {
            const p = this.locations.at(-1);
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


class Logger {

    /**
     * @param {string} mapID html ID tag for map element
     */
    constructor() {
        /** @type {GeolocationPosition[]} */
        this.locations = [];

        /** @type {number|null} */
        this.watchHandle = null;
    }

    /**
     * @param {GeolocationPosition} position 
     */
    addPosition(position) {
        this.locations.push(position);
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

        this.logger = new Logger();
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
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.app = new App();
    console.log("started app");
});