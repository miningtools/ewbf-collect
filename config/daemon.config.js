
var daemon = {
    main: "index.js",
    name: "ewbf-collect",
    pidfile: "/var/run/ewbf-collect.pid",
    user: "collector",
    group: "collector",
    silent: true
}


module.exports = daemon;
