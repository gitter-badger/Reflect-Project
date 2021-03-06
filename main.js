var fs = require('fs');
var path = require('path');

var db;

db = fs.existsSync(path.resolve(__dirname, 'embedded.db')) ? JSON.parse(fs.readFileSync(path.resolve(__dirname, 'embedded.db'))) : {};

function saveDB() {
  fs.writeFileSync(path.resolve(__dirname, 'embedded.db'), JSON.stringify(db));
}

var dbInterval = setInterval(saveDB, 60 * 1000);

// some defaults
if (typeof db.config !== 'object' || db.config === null)
  db.config = {};

if (typeof db.config.ports !== 'object' || db.config.ports === null)
  db.config.ports = {'http': 1867, 'ws': 1808};

if (typeof db.classrooms !== 'object' || db.classrooms === null)
    db.classrooms = [];

// models
function Classroom(args) {
  for (var prop in args)
    this[prop] = args[prop];

  this.props = {
    'name': 'props' in args ? args.props.name || '' : '',
    'deviceIndex': 'props' in args ? args.props.deviceIndex || 0 : 0
  };
  this.id = args.id;
  this.devices = args.devices || [];
  this.appRoot = args.appRoot || {};
}

function Device(args) {
  for (var prop in args)
    this[prop] = args[prop];

  this.name = args.name || 'New device';
  this.id = args.id;
  this.color = args.color || 'green';
  this.screen = {
    'height': 'screen' in args ? args.screen.height || 1 : 1,
    'width': 'screen' in args ? args.screen.width || 1 : 1
  };
  this.location = {
    'x': 'location' in args ? args.location.x || 0 : 0,
    'y': 'location' in args ? args.location.y || 0 : 0,
    'angle': 'location' in args ? args.location.angle || 0 : 0
  };
}

var assoc = {};
var checkerboard = new (require('checkerboard')).Server(db.config.ports.ws, db);

var express = require('express'),
    http = express();

// Set Last-Modified to avoid 304 Not Modified statuses
http.get('/*', function(req, res, next) {
  res.setHeader('Last-Modified', (new Date()).toUTCString());
  next();
});

http.get('/', express.static(path.resolve(__dirname, 'client')));
http.use('/', express.static(path.resolve(__dirname)));

http.listen(db.config.ports.http);

function normalize(state) {
  if (typeof state.classroomIndex === 'undefined')
    state.classroomIndex = 0;

  state.classrooms.forEach(function(classroom, index) {
    classroom = new Classroom(classroom);

    if (typeof classroom.id === 'undefined')
      classroom.id = state.classroomIndex++;

    classroom.devices.forEach(function(device, index) {
      device = new Device(device);

      if (typeof device.id === 'undefined')
        device.id = classroom.props.deviceIndex++;

      if (typeof device.app !== 'undefined' && !(device.app in classroom.appRoot))
        classroom.appRoot[device.app] = {};

      classroom.devices[index] = device;
    });

    state.classrooms[index] = classroom;

  });
}

function getApps() {
  var toReturn = {};
  fs.readdirSync(path.resolve(__dirname, 'apps'))
    .filter(function(maybeDir) {
      return fs.statSync(path.resolve(__dirname, 'apps', maybeDir)).isDirectory();
    })
    .forEach(function(dir) {
      toReturn[dir] = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'apps', dir, 'package.json')));
    });
  return toReturn;
}

checkerboard.on('open', function(conn, message) {
  assoc[conn.uuid] = {'classroom': undefined, 'device': undefined};
  conn.state = function(state) {
    normalize(state);

    var toReturn = {'classrooms': []};

    state.classrooms.forEach(function(classroom) {
      toReturn.classrooms.push({'id': classroom.id, 'props': classroom.props, 'devices': classroom.devices});
    });

    return toReturn;
  };
});

checkerboard.on('data-associate', function(conn, message) {
  assoc[conn.uuid] = {'classroom': message.classroom, 'device': message.device, 'conn': conn};
  var classroom = db.classrooms[db.classrooms.map(function(c) { return c.id; }).indexOf(parseInt(message.classroom))];
  var device = typeof classroom !== 'undefined' ? classroom.devices[classroom.devices.map(function(d) { return d.id; }).indexOf(parseInt(message.device))] : undefined;

  if (typeof device !== 'undefined')
    device.connected = true;

  conn.state = function(state) {
    normalize(state);

    classroom = state.classrooms[db.classrooms.map(function(c) { return c.id; }).indexOf(parseInt(message.classroom))];
    device = typeof classroom !== 'undefined' ? classroom.devices[classroom.devices.map(function(d) { return d.id; }).indexOf(parseInt(message.device))] : undefined;

    if (typeof classroom === 'undefined')
      return {};

    if (typeof message.device !== 'undefined') {
      if (typeof device === 'undefined')
        return {};

      return {'device': device, 'global': typeof device.app !== 'undefined' ? classroom.appRoot[device.app] : {}, 'app': typeof device.app !== 'undefined' ? getApps()[device.app] : undefined};
    }
    else {
      var toReturn = {};
      for (var prop in classroom)
        toReturn[prop] = classroom[prop];

      toReturn.apps = getApps();
      return toReturn;
    }
  };

  Object.keys(assoc).forEach(function(key) {
    if (assoc[key].classroom === message.classroom)
      assoc[key].conn.overwriteState();
  });
});

checkerboard.on('close', function(conn) {
  var savedAssoc = assoc[conn.uuid];
  delete assoc[conn.uuid];
  var classroom = db.classrooms[db.classrooms.map(function(c) { return c.id; }).indexOf(parseInt(savedAssoc.classroom))];
  if (typeof classroom === 'undefined')
    return;

  var device = classroom.devices[classroom.devices.map(function(d) { return d.id; }).indexOf(parseInt(savedAssoc.device))];
  if (typeof device === 'undefined')
    return;
  device.connected = false;

  var lastDevice = true;
  Object.keys(assoc).forEach(function(key) {
    if (assoc[key].classroom === savedAssoc.classroom && assoc[key].device === savedAssoc.device)
      lastDevice = false;
  });

  if (lastDevice)
    Object.keys(assoc).forEach(function(key) {
      if (assoc[key].classroom === savedAssoc.classroom)
        assoc[key].conn.overwriteState();
    });
});


function exit() {
  clearInterval(dbInterval);

  db.classrooms.forEach(function(classroom) {
    classroom.appRoot = {};
    classroom.devices.forEach(function(device) {
      device.connected = false;
      device.app = undefined;
      device.project = undefined;
    });
  });

  saveDB();
  process.exit();
}

process.on('exit', exit);
process.on('SIGINT', exit);
process.on('uncaughtException', exit);
