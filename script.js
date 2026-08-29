class Logger {

    constructor() {
        /** @type {GeolocationPosition[]} */
        this.locations = [];

        this.map = L.map("map").setView([0, 0], 18);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        this.currentLocationMarker = undefined;
        this.historyPath = undefined;

        /** @type {number} */
        this.watchHandle = undefined;
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

        if (this.historyPath === undefined) {
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

    saveLocations() {
        const json = JSON.stringify(this.locations);
        const blob = new Blob([json], { type: "text/plain;charset=utf-8" });
        const datestring = (new Date()).toISOString().replaceAll(":", "-");
        const filename = `log_${datestring}.json`;
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
        if (this.watchHandle !== undefined) {
            navigator.geolocation.clearWatch(this.watchHandle);
            console.log(`cleared watch ${this.watchHandle}`)
            this.watchHandle = undefined;
        }
    }
};

window.addEventListener("load", () => {

    const log = new Logger();

    document.getElementById("btnStart").addEventListener("click", () => log.startWatch());
    document.getElementById("btnStop").addEventListener("click", () => log.stopWatch());
    document.getElementById("btnSave").addEventListener("click", () => log.saveLocations());

    console.log("started app");
});