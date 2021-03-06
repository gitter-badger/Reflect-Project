var Home = (function() {
  var Home = {
    controller: function(ctrl) {
      return {
        'toggleTrash': m.prop(false)
      };
    },
    view: function(ctrl, args) {
      return (
        m('div', [
          m('div.row', [
            m('div.panel.panel-default#device-well', {
                'style': 'width: 60vw; height: 40vw'
              }, [
                classroom('devices').map(function(device, index) {
                  return m.component(DeviceView, {'device': device, 'toggleTrash': ctrl.toggleTrash});
                }),
                m.component(AddDevice, {'toggleTrash': ctrl.toggleTrash})
              ]
            )
          ]),
          m.component(AppDock)
        ])
      );
    }
  };

  var AppDock = {
    'view': function(ctrl) {
      return (
        m('div#dock-container', {'style': 'position: absolute; z-index: 5'}, [
          m('div#dock', [
            m('ul', Object.keys(classroom('apps')).map(function(path) {
              var app = classroom.apps(path);
              return (
                m('li', [
                  m('span', [app.title]),
                  m('div', [
                    m('img.docked.appIcon', {'src': '/apps/' + path + '/' + app.icon, 'data-path': path})
                  ])
                ])
              );
            })),
            m('div.base')
          ])
        ])
      );
    }
  };

  var DeviceView = {
    controller: function(args) {
      return {
        'toggled': false,
        'edit': false,
        'newName': m.prop(args.device.name),
        'mousedown': false,
        'newColor': m.prop(args.device.color),
        'angle': m.prop(args.device.location.angle)
      };
    },
    view: function(ctrl, args) {
      var mousedown = 0;
      var device = args.device;
      var x = device.location.x / 100 * (60 / 100 * document.documentElement.clientWidth),
          y = device.location.y / 100 * (40 / 100 * document.documentElement.clientWidth),
          a = parseInt(ctrl.angle());
      var transform = 'translate(' + x + 'px, ' + y + 'px);';
      return (
        m('div.deviceTile' + (device.connected ? '.deviceActive' : ''), {
          'style': 'z-index: 2; position: absolute; webkit-transform: ' + transform + ' transform:' + transform,
          'data-x': x,
          'data-y': y,
          'data-id': device.id,
          'ontouchstart': function(e) {
            args.toggleTrash(!device.connected);
            if (!ctrl.edit)
              ctrl.toggle = true;
          },
          'onmousedown': function(e) {
            ctrl.mousedown = !device.connected;
          },
          'onmousemove': function(e) {
            if (ctrl.mousedown) {
              args.toggleTrash(true);
            }
          },
          'onmouseup': function(e) {
            ctrl.mousedown = false;
            args.toggleTrash(false);
          },
          'onclick': function(e) {
            if (!ctrl.edit)
              ctrl.toggle = true;
          },
          'onmouseleave': function(event) {
            ctrl.toggle = false;
            ctrl.edit = false;
            args.toggleTrash(false);
            if (event.target.getAttribute('data-deleted') != '1')
              stm.try(function(state) {
                var curDevice = state.devices[state('devices').map(function(d) { return d.id; }).indexOf(parseInt(device.id))];
                curDevice('name', ctrl.newName());
                curDevice('color', ctrl.newColor());
                curDevice.location('angle', ctrl.angle());
              });
          },
          'ontouchend': function(e) {
            args.toggleTrash(false);
          }
        }, [
          m('div.panel.panel-default' + (!device.connected ? '.resizeTile.trashable' : '.resizeTile'), {
            'style':
              'z-index: 2;' +
              'position: relative; ' +
              'webkit-transform: rotate(' + ctrl.angle() + 'deg); transform: rotate(' + ctrl.angle() + 'deg);' +
              'background-color: ' + (args.device.connected ? args.device.color : 'gray') + ';' +
              'width: ' + device.screen.width + 'vw;' +
              'height: ' + device.screen.height + 'vw;',
          }, [
            typeof device.app !== 'undefined' && device.connected && !device.project ?
            m('img', {
              'src': '/apps/' + device.app + '/' + classroom.apps(device.app).icon,
              'style': 'margin: auto; width: 64px; height: 64px; position: absolute; top: 0; left: 0; bottom: 0; right: 0'
            }) : ''
          ]),
          m('div.deviceName', {'style': 'z-index: 3; position: relative'}, [
            ctrl.edit
              ? [
                  m('input.form-control.input-sm', {'value': ctrl.newName(), 'oninput': m.withAttr('value', ctrl.newName)}),
                  m('input.form-control.input-sm', {'style': '-webkit-font-smoothing: antialiased; color: #fff; text-shadow: #000 0px 0px 4px; background-color: ' + ctrl.newColor(), 'value': ctrl.newColor(), 'oninput': m.withAttr('value', ctrl.newColor)}),
                  m('input.form-control.input-sm', {'type': 'range', 'min': 0, 'max': 360, 'step': 15, 'value': ctrl.angle(), 'oninput': m.withAttr('value', ctrl.angle)})
                ]
              : m('div', {'style': 'background-color: white; border: 1px solid black; border-radius: 10px; opacity: 0.9', 'onclick': function(e) { ctrl.toggle = false; ctrl.edit = true; }}, [device.name + (device.project ? ' (projecting ' + classroom.devices[classroom('devices').map(function(d) { return d.id; }).indexOf(device.project)]('name') + ')' : '')])
          ]),
          m('div.btn-group.btn-group-sm', {
            'style': (ctrl.toggle ? 'visibility: visible' : 'visibility: hidden') + '; z-index: 3; display: table; margin-left: auto; margin-right: auto'
            }, [
              m('button.btn.btn-default', {
                'onclick': function() {
                  window.open((window.location.origin || 'http://localhost:1867') + '/#' + m.route.param('classroom') + '/' + device.id, '_blank');
                }
              }, ['Peek']),
              m('div.btn-group.btn-group-sm', {
                'config': function(element) {
                  element.onclick = function() { element.classList.add('open'); };
                  element.onmouseleave = function(e) { element.classList.remove('open'); };
                }
              }, [
                m('button.btn.btn-default', ['Project to ', m('span.caret')]),
                m('ul.dropdown-menu.projectMenu', {

                }, [
                  classroom('devices').map(function(c) {
                    return m('li', [
                      m('a', {
                        'onclick': function() {
                          stm.try(function(state) {
                            state.devices[state('devices').map(function(d) { return d.id; }).indexOf(parseInt(c.id))]('project', device.id);
                          });
                        }
                      }, c.name)
                    ]);
                  })
                ])
              ]),
              m('button.btn.btn-default', {
                'onclick': function() {
                  stm.try(function(state) {
                    state.devices[state('devices').map(function(d) { return d.id; }).indexOf(parseInt(device.id))]('frozen', !device.frozen);
                  });
                }
              }, [device.frozen ? 'Unfreeze' : 'Freeze']),
              m('button.btn.btn-default', {
                'onclick': function() {
                  stm.try(function(state) {

                    var dev = state.devices[state('devices').map(function(d) { return d.id; }).indexOf(parseInt(device.id))];
                    dev('app', undefined);
                    dev('project', undefined);
                  });
                }
              }, ['Clear'])
          ])
        ])
      );
    }
  };

  var AddDevice = {
    view: function(ctrl, args) {
      if (!args.toggleTrash())
        return (
          m('button.btn.btn-lg.btn-success', {
            'style': 'padding: 20px 24px; border-radius: 50%; position: absolute; bottom: 0.5em; right: 0.5em',
            'onclick': function(e) {
              stm.try(function(state) {
                var devices = state('devices');
                devices.push({'id': state.props('deviceIndex'), 'name': 'New device', 'color': 'green', 'location': {'x': 75, 'y': 75, 'angle': 0}, 'screen': {'width': 5, 'height': 5}});
                state.props('deviceIndex', state.props('deviceIndex') + 1);
                state('devices', devices);
              });
            }
          }, [
            m('span.glyphicon.glyphicon-plus')
          ])
        );
      else
        return (
          m('button.btn.btn-lg.btn-danger.trash', {
            'style': 'z-index: 1; padding: 20px 24px; border-radius: 50%; position: absolute; bottom: 0.5em; right: 0.5em',
          }, [
            m('span.glyphicon.glyphicon-trash')
          ])
        );
    }
  };

  return Home;
}());
